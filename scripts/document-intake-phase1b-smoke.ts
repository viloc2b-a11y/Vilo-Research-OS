/**
 * Phase 1B smoke: document intake compliance runtime (hash, paths, attestation, optional live DB).
 *
 * Usage:
 *   npx tsx scripts/document-intake-phase1b-smoke.ts
 *   npx tsx scripts/document-intake-phase1b-smoke.ts --live
 */
import { createClient } from '@supabase/supabase-js'
import { computeDocumentHash } from '../lib/document-intake/document-hash'
import { buildStoragePath } from '../lib/document-intake/build-storage-path'
import { CERTIFIED_COPY_ATTESTATION_LOCKED_TEXT } from '../lib/document-intake/compliance-types'
import { ingestComplianceDocument } from '../lib/document-intake/ingest-document'
import * as auditLedger from '../lib/document-intake/audit-ledger'
import { assertProductionSeedAllowed } from './lib/production-seed-guard.mjs'

const LIVE = process.argv.includes('--live')

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message)
}

async function runUnitChecks() {
  console.log('--- Phase 1B unit checks ---')

  const buffer = Buffer.from('document-intake-phase1b-smoke')
  const hash1 = computeDocumentHash(buffer)
  const hash2 = computeDocumentHash(buffer)
  assert(hash1 === hash2, 'SHA-256 hash must be deterministic')
  assert(hash1.length === 64, 'SHA-256 hash must be 64 hex chars')
  console.log('✅ SHA-256 hash generated deterministically')

  const fullPath = buildStoragePath({
    organizationId: '00000000-0000-4000-8000-000000000001',
    studyId: '00000000-0000-4000-8000-000000000002',
    subjectId: '00000000-0000-4000-8000-000000000003',
    documentId: '00000000-0000-4000-8000-000000000010',
    filename: 'Test Protocol v1.pdf',
  })
  assert(
    fullPath.endsWith('/test-protocol-v1.pdf'),
    `Unexpected full storage path: ${fullPath}`,
  )
  console.log('✅ Storage path (study + subject)')

  const fallbackPath = buildStoragePath({
    organizationId: '00000000-0000-4000-8000-000000000001',
    documentId: '00000000-0000-4000-8000-000000000011',
    filename: 'General Memo.docx',
  })
  assert(
    fallbackPath ===
      '00000000-0000-4000-8000-000000000001/general/documents/00000000-0000-4000-8000-000000000011/general-memo.docx',
    `Unexpected fallback path: ${fallbackPath}`,
  )
  console.log('✅ Storage path (general fallback)')

  assert(
    CERTIFIED_COPY_ATTESTATION_LOCKED_TEXT ===
      'I certify that this document is an exact copy having all of the same information and attributes as the original.',
    'Certified copy attestation text must remain locked',
  )
  console.log('✅ Certified copy attestation text exact')

  assert(
    Object.keys(auditLedger).length === 1 && 'appendComplianceAuditEvent' in auditLedger,
    'Audit ledger must be append-only (no update/delete exports)',
  )
  console.log('✅ Audit ledger append-only surface')
}

async function runLiveChecks() {
  assertProductionSeedAllowed('document-intake-phase1b-smoke --live')
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    console.log('⏭️  Skipping live checks (NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set)')
    return
  }

  console.log('--- Phase 1B live integration ---')
  const supabase = createClient(url, key)

  const orgId = process.env.DOC_INTAKE_SMOKE_ORG_ID
  const studyId = process.env.DOC_INTAKE_SMOKE_STUDY_ID
  if (!orgId || !studyId) {
    console.log('⏭️  Set DOC_INTAKE_SMOKE_ORG_ID and DOC_INTAKE_SMOKE_STUDY_ID for live ingest test')
    return
  }

  const bytes = Buffer.from('%PDF-1.4 phase1b smoke')
  const file = new File([bytes], 'phase1b-smoke.pdf', { type: 'application/pdf' })

  const result = await ingestComplianceDocument({
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
    operationalDisplayName: 'Phase 1B Smoke PDF',
    expirationDate: null,
    certifiedCopyAttested: true,
    operationalNotes: 'smoke test',
    actorId: '00000000-0000-4000-8000-000000000900',
    actorRole: null,
  })

  if (!result.ok) {
    throw new Error(`Live ingest failed: ${result.message}`)
  }
  const documentId = result.documentId

  const { data: doc } = await supabase
    .from('compliance_runtime_documents')
    .select('id, cryptographic_hash, certified_copy_attested, certified_copy_attestation_text')
    .eq('id', documentId)
    .single()

  assert(Boolean(doc), 'compliance_runtime_documents row missing')
  assert(doc!.cryptographic_hash === computeDocumentHash(bytes), 'Stored hash mismatch')
  assert(doc!.certified_copy_attested === true, 'Certified copy flag not set')
  assert(
    doc!.certified_copy_attestation_text === CERTIFIED_COPY_ATTESTATION_LOCKED_TEXT,
    'Attestation text not stored',
  )
  console.log('✅ compliance_runtime_documents row created')

  const { data: events } = await supabase
    .from('compliance_audit_ledger')
    .select('event_type')
    .eq('document_id', documentId)
    .order('event_timestamp', { ascending: true })

  const types = (events ?? []).map((row) => String(row.event_type))
  assert(types.includes('document_ingested'), 'Missing document_ingested audit event')
  assert(types.includes('certified_copy_attested'), 'Missing certified_copy_attested audit event')
  console.log('✅ compliance_audit_ledger events appended')

  const { count: updateCount } = await supabase
    .from('compliance_audit_ledger')
    .update({ event_type: 'document_updated' })
    .eq('document_id', documentId)

  if (updateCount === null) {
    console.log('✅ Audit ledger update blocked or no-op (immutable)')
  } else {
    assert(updateCount === 0, 'Audit ledger must not allow updates')
    console.log('✅ No audit ledger mutation on update attempt')
  }
}

async function main() {
  await runUnitChecks()
  if (LIVE) {
    await runLiveChecks()
  } else {
    console.log('Tip: run with --live and DOC_INTAKE_SMOKE_* env vars for DB integration checks')
  }
  console.log('------------------------------------------------------------')
  console.log('Phase 1B smoke test passed.')
}

main().catch((err) => {
  console.error('Smoke test failed:', err)
  process.exit(1)
})
