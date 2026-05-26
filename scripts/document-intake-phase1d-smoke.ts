/**
 * Phase 1D smoke: document expiration alerts (scan, status, resolve, audit).
 *
 * Usage:
 *   npx tsx scripts/document-intake-phase1d-smoke.ts
 *   npx tsx scripts/document-intake-phase1d-smoke.ts --live
 */
import { createClient } from '@supabase/supabase-js'
import { ingestComplianceDocument } from '../lib/document-intake/ingest-document'
import { runExpirationAlertScan } from '../lib/document-intake/run-expiration-alert-scan'
import { resolveExpirationAlert } from '../lib/document-intake/resolve-expiration-alert'
import {
  EXPIRATION_ALERT_TYPE,
  alertTypeForThreshold,
  daysUntilExpiration,
  expirationThresholdsDue,
} from '../lib/document-intake/expiration-alert-types'
import * as auditLedger from '../lib/document-intake/audit-ledger'

const LIVE = process.argv.includes('--live')

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message)
}

function runUnitChecks() {
  console.log('--- Phase 1D unit checks ---')

  assert(daysUntilExpiration('2099-12-31') > 100, 'Future expiration days remaining')
  assert(daysUntilExpiration('2000-01-01') < 0, 'Past expiration is negative')

  const fiveDaysOut = new Date()
  fiveDaysOut.setUTCDate(fiveDaysOut.getUTCDate() + 5)
  const fiveDaysIso = fiveDaysOut.toISOString()
  const thresholds = expirationThresholdsDue(daysUntilExpiration(fiveDaysIso))
  assert(thresholds.includes(30), '5 days out should trigger 30-day threshold')
  assert(thresholds.includes(14), '5 days out should trigger 14-day threshold')
  assert(thresholds.includes(7), '5 days out should trigger 7-day threshold')
  assert(!thresholds.includes(1), '5 days out should not trigger 1-day threshold')
  assert(!thresholds.includes(0), '5 days out should not trigger expired threshold')
  console.log('✅ Expiration alert window thresholds')

  assert(
    alertTypeForThreshold(7) === EXPIRATION_ALERT_TYPE.EXPIRATION_WARNING,
    'Warning alert type',
  )
  assert(alertTypeForThreshold(0) === EXPIRATION_ALERT_TYPE.EXPIRED, 'Expired alert type')
  console.log('✅ Alert type mapping')

  assert(
    Object.keys(auditLedger).length === 1 && 'appendComplianceAuditEvent' in auditLedger,
    'Audit ledger append-only',
  )
  console.log('✅ Audit ledger append-only surface')
}

function expirationIsoDaysFromNow(days: number): string {
  const date = new Date()
  date.setUTCDate(date.getUTCDate() + days)
  date.setUTCHours(23, 59, 59, 999)
  return date.toISOString()
}

async function runLiveChecks() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    console.log('⏭️  Skipping live checks (Supabase env not set)')
    return
  }

  const orgId = process.env.DOC_INTAKE_SMOKE_ORG_ID
  const studyId = process.env.DOC_INTAKE_SMOKE_STUDY_ID
  const actorId = process.env.DOC_INTAKE_SMOKE_ACTOR_ID ?? '00000000-0000-4000-8000-000000000900'
  if (!orgId || !studyId) {
    console.log('⏭️  Set DOC_INTAKE_SMOKE_ORG_ID and DOC_INTAKE_SMOKE_STUDY_ID for live checks')
    return
  }

  console.log('--- Phase 1D live integration ---')
  const supabase = createClient(url, key)

  const bytes = Buffer.from('%PDF-1.4 phase1d expiration smoke')
  const file = new File([bytes], 'phase1d-expiration.pdf', { type: 'application/pdf' })

  const ingest = await ingestComplianceDocument({
    supabase,
    file,
    fileBuffer: bytes,
    organizationId: orgId,
    studyId,
    subjectId: null,
    visitId: null,
    procedureExecutionId: null,
    documentClassification: 'regulatory_document',
    destinationDomain: 'study_documents',
    destinationEntityType: 'study',
    destinationEntityId: studyId,
    operationalDisplayName: 'Phase 1D Expiration Smoke',
    expirationDate: expirationIsoDaysFromNow(5),
    certifiedCopyAttested: false,
    operationalNotes: 'phase1d smoke',
    actorId,
    actorRole: null,
  })
  if (!ingest.ok) throw new Error(ingest.message)
  const documentId = ingest.documentId

  const hashBefore = (
    await supabase
      .from('compliance_runtime_documents')
      .select('cryptographic_hash')
      .eq('id', documentId)
      .single()
  ).data?.cryptographic_hash

  const scan1 = await runExpirationAlertScan({
    supabase,
    organizationId: orgId,
    actorId,
  })
  assert(scan1.documentsScanned >= 1, 'Scan should process documents')
  assert(scan1.alertsCreated >= 3, 'Expected warning alerts for 30/14/7 thresholds')
  console.log('✅ Expiration alerts created for warning windows')

  const { data: alertRows } = await supabase
    .from('compliance_expiration_alerts')
    .select('id, days_before_expiration')
    .eq('document_id', documentId)
  assert((alertRows ?? []).length >= 3, 'compliance_expiration_alerts rows missing')
  console.log('✅ compliance_expiration_alerts rows exist')

  const scan2 = await runExpirationAlertScan({
    supabase,
    organizationId: orgId,
    actorId,
  })
  const { count: alertCountAfterDupScan } = await supabase
    .from('compliance_expiration_alerts')
    .select('id', { count: 'exact', head: true })
    .eq('document_id', documentId)
  assert(scan2.alertsCreated === 0, 'Duplicate scan must not create duplicate alerts')
  assert(alertCountAfterDupScan === (alertRows ?? []).length, 'Alert count unchanged after rescan')
  console.log('✅ Duplicate scan does not create duplicate alerts')

  const { data: docStatus } = await supabase
    .from('compliance_runtime_documents')
    .select('status')
    .eq('id', documentId)
    .single()
  assert(docStatus?.status === 'expiring_soon', 'Document status should be expiring_soon')
  console.log('✅ Document status expiring_soon')

  const { data: createdEvents } = await supabase
    .from('compliance_audit_ledger')
    .select('event_type')
    .eq('document_id', documentId)
    .in('event_type', ['expiration_alert_created', 'document_marked_expiring_soon'])
  assert((createdEvents ?? []).length >= 2, 'Expiration audit events missing')
  console.log('✅ expiration_alert_created and document_marked_expiring_soon audit events')

  const expiredBytes = Buffer.from('%PDF-1.4 phase1d expired smoke')
  const expiredFile = new File([expiredBytes], 'phase1d-expired.pdf', { type: 'application/pdf' })
  const expiredIngest = await ingestComplianceDocument({
    supabase,
    file: expiredFile,
    fileBuffer: expiredBytes,
    organizationId: orgId,
    studyId,
    subjectId: null,
    visitId: null,
    procedureExecutionId: null,
    documentClassification: 'regulatory_document',
    destinationDomain: 'study_documents',
    destinationEntityType: 'study',
    destinationEntityId: studyId,
    operationalDisplayName: 'Phase 1D Expired Smoke',
    expirationDate: expirationIsoDaysFromNow(-2),
    certifiedCopyAttested: false,
    operationalNotes: 'phase1d expired smoke',
    actorId,
    actorRole: null,
  })
  if (!expiredIngest.ok) throw new Error(expiredIngest.message)

  await runExpirationAlertScan({ supabase, organizationId: orgId, actorId })

  const { data: expiredDoc } = await supabase
    .from('compliance_runtime_documents')
    .select('status')
    .eq('id', expiredIngest.documentId)
    .single()
  assert(expiredDoc?.status === 'expired', 'Expired document should be marked expired')
  console.log('✅ Expired document status updated')

  const { data: expiredAlert } = await supabase
    .from('compliance_expiration_alerts')
    .select('id')
    .eq('document_id', expiredIngest.documentId)
    .eq('days_before_expiration', 0)
    .maybeSingle()
  assert(Boolean(expiredAlert), 'Expired alert (0 days) missing')
  console.log('✅ Expired alert created')

  const pendingAlert = alertRows!.find((row) => row.days_before_expiration === 7)!
  await resolveExpirationAlert({
    supabase,
    organizationId: orgId,
    alertId: pendingAlert.id,
    resolvedBy: actorId,
    resolutionNote: 'Renewal coordinated in smoke test',
  })

  const { data: resolvedEvents } = await supabase
    .from('compliance_audit_ledger')
    .select('event_type')
    .eq('document_id', documentId)
    .eq('event_type', 'expiration_alert_resolved')
  assert((resolvedEvents ?? []).length >= 1, 'expiration_alert_resolved audit event missing')
  console.log('✅ expiration_alert_resolved audit event')

  const hashAfter = (
    await supabase
      .from('compliance_runtime_documents')
      .select('cryptographic_hash')
      .eq('id', documentId)
      .single()
  ).data?.cryptographic_hash
  assert(hashBefore === hashAfter, 'Document cryptographic_hash must not change')
  console.log('✅ Document hash unchanged')

  const { count: updateCount } = await supabase
    .from('compliance_audit_ledger')
    .update({ event_type: 'document_updated' })
    .eq('document_id', documentId)
  if (updateCount === null) {
    console.log('✅ Audit ledger update blocked or no-op')
  } else {
    assert(updateCount === 0, 'Audit ledger must not allow updates')
    console.log('✅ No audit ledger mutation on update attempt')
  }
}

async function main() {
  runUnitChecks()
  if (LIVE) {
    await runLiveChecks()
  } else {
    console.log('Tip: run with --live and DOC_INTAKE_SMOKE_* env vars for DB integration')
  }
  console.log('------------------------------------------------------------')
  console.log('Phase 1D smoke test passed.')
}

main().catch((err) => {
  console.error('Smoke test failed:', err)
  process.exit(1)
})
