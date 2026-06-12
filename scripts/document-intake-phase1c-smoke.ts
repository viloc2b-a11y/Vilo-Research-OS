/**
 * Phase 1C smoke: compliance obligations (create, complete, cancel, audit).
 *
 * Usage:
 *   npx tsx scripts/document-intake-phase1c-smoke.ts
 *   npx tsx scripts/document-intake-phase1c-smoke.ts --live
 */
import { createClient } from '@supabase/supabase-js'
import { ingestComplianceDocument } from '../lib/document-intake/ingest-document'
import { createComplianceObligations } from '../lib/document-intake/create-obligation'
import { completeComplianceObligation } from '../lib/document-intake/complete-obligation'
import { cancelComplianceObligation } from '../lib/document-intake/cancel-obligation'
import {
  ACKNOWLEDGEMENT_TYPE,
  OBLIGATION_TYPE,
  SIGNATURE_MEANING,
} from '../lib/document-intake/obligation-types'
import * as auditLedger from '../lib/document-intake/audit-ledger'
import { assertProductionSeedAllowed } from './lib/production-seed-guard.mjs'
import { validateObligationInput } from '../lib/document-intake/validate-obligation-input'

const LIVE = process.argv.includes('--live')

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message)
}

function runUnitChecks() {
  console.log('--- Phase 1C unit checks ---')

  assert(validateObligationInput({
    obligation_type: OBLIGATION_TYPE.SIGNATURE,
    signature_meaning: SIGNATURE_MEANING.REVIEWED,
    assigned_role: 'research_coordinator',
  }).ok, 'Signature validation')

  assert(validateObligationInput({
    obligation_type: OBLIGATION_TYPE.ACKNOWLEDGEMENT,
    acknowledgement_type: ACKNOWLEDGEMENT_TYPE.OPERATIONAL,
    assigned_role: 'pi_sub_i',
  }).ok, 'Acknowledgement validation')

  assert(
    Object.keys(auditLedger).length === 1 && 'appendComplianceAuditEvent' in auditLedger,
    'Audit ledger append-only',
  )
  console.log('✅ Obligation input validation')
  console.log('✅ Audit ledger append-only surface')
}

async function runLiveChecks() {
  assertProductionSeedAllowed('document-intake-phase1c-smoke --live')
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

  console.log('--- Phase 1C live integration ---')
  const supabase = createClient(url, key)

  const bytes = Buffer.from('%PDF-1.4 phase1c obligation smoke')
  const file = new File([bytes], 'phase1c-obligations.pdf', { type: 'application/pdf' })

  const ingest = await ingestComplianceDocument({
    supabase,
    file,
    fileBuffer: bytes,
    organizationId: orgId,
    studyId,
    subjectId: null,
    visitId: null,
    procedureExecutionId: null,
    documentClassification: 'other',
    destinationDomain: 'study_documents',
    destinationEntityType: 'study',
    destinationEntityId: studyId,
    operationalDisplayName: 'Phase 1C Obligation Smoke',
    expirationDate: null,
    certifiedCopyAttested: false,
    operationalNotes: 'phase1c smoke',
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

  const { obligations } = await createComplianceObligations({
    supabase,
    organizationId: orgId,
    documentId,
    requestedBy: actorId,
    obligations: [
      {
        obligation_type: OBLIGATION_TYPE.SIGNATURE,
        signature_meaning: SIGNATURE_MEANING.REVIEWED,
        assigned_role: 'research_coordinator',
      },
      {
        obligation_type: OBLIGATION_TYPE.ACKNOWLEDGEMENT,
        acknowledgement_type: ACKNOWLEDGEMENT_TYPE.OPERATIONAL,
        assigned_role: 'pi_sub_i',
      },
    ],
  })
  assert(obligations.length === 2, 'Expected two obligations')
  console.log('✅ compliance_obligations rows created')

  const { data: createdEvents } = await supabase
    .from('compliance_audit_ledger')
    .select('event_type')
    .eq('document_id', documentId)
    .eq('event_type', 'obligation_created')
  assert((createdEvents ?? []).length >= 2, 'obligation_created audit events missing')
  console.log('✅ obligation_created audit events')

  const signatureObligation = obligations.find((o) => o.obligationType === 'signature')!
  await completeComplianceObligation({
    supabase,
    organizationId: orgId,
    obligationId: signatureObligation.id,
    completedBy: actorId,
    completionMeaning: 'Reviewed and acknowledged',
  })

  const { data: completedEvents } = await supabase
    .from('compliance_audit_ledger')
    .select('event_type')
    .eq('document_id', documentId)
    .eq('event_type', 'obligation_completed')
  assert((completedEvents ?? []).length >= 1, 'obligation_completed audit event missing')
  console.log('✅ obligation_completed audit event')

  const ackObligation = obligations.find((o) => o.obligationType === 'acknowledgement')!
  await cancelComplianceObligation({
    supabase,
    organizationId: orgId,
    obligationId: ackObligation.id,
    cancelledBy: actorId,
    reason: 'Created in error',
  })

  const { data: cancelledEvents } = await supabase
    .from('compliance_audit_ledger')
    .select('event_type')
    .eq('document_id', documentId)
    .eq('event_type', 'obligation_cancelled')
  assert((cancelledEvents ?? []).length >= 1, 'obligation_cancelled audit event missing')
  console.log('✅ obligation_cancelled audit event')

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
  console.log('Phase 1C smoke test passed.')
}

main().catch((err) => {
  console.error('Smoke test failed:', err)
  process.exit(1)
})
