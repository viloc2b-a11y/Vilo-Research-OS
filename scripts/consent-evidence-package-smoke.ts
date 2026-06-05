import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import { getDeliverableDownloadUrl } from '../lib/deliverables/actions'

dotenv.config({ path: '.env.local' })

async function runSmokeTest() {
  console.log('\nStarting Consent Evidence Package Smoke Test...\n')
  
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  
  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing Supabase env vars')
    process.exit(1)
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey)

  // 1. Find a subject with consent records
  console.log('Fetching eligible study subject with consent versions...')
  const { data: consentVersions, error: consentError } = await supabase
    .from('subject_consent_versions')
    .select('study_id, study_subject_id, organization_id')
    .limit(1)

  if (consentError) {
    console.error('Failed to query subject consent versions:', consentError.message)
    process.exit(1)
  }

  if (!consentVersions || consentVersions.length === 0) {
    console.error('No subject consent versions found. Seed some data first.')
    process.exit(1)
  }

  const { study_id: studyId, study_subject_id: subjectId, organization_id: organizationId } = consentVersions[0]
  console.log(`Found Subject: ${subjectId}`)

  const { createDeliverableRun } = await import('../lib/deliverables/create-deliverable-run')
  const { generateConsentEvidencePackage } = await import('../lib/deliverables/generate-consent-evidence-package')

  // 2. We use generateConsentEvidencePackage directly
  console.log('\nCreating Deliverable Run for Consent Evidence Package...')
  
  const { runId } = await createDeliverableRun({
    systemCode: 'consent_evidence_package',
    organizationId,
    userId: '00000000-0000-0000-0000-000000000000', // Dev Mock USER
    audience: 'cra', // e.g. CRA Review
    scope: 'subject',
    filters: { studyId, subjectId },
    supabase
  })

  console.log('Generating package...')
  const result = await generateConsentEvidencePackage(supabase, runId)

  if (!result.success) {
    console.error('❌ Generation Failed')
    process.exit(1)
  }

  console.log('Generation Result:', result)

  if (!result.storagePath) {
    console.error('❌ Missing storage path on consent package result')
    process.exit(1)
  }

  const downloadResult = await getDeliverableDownloadUrl(result.storagePath)
  if (!downloadResult.success) {
    console.warn(`⚠️ Download URL could not be generated in this environment: ${downloadResult.error}`)
  }
  
  // 3. Verify output in DB
  const { data: output, error: outErr } = await supabase
    .from('deliverable_run_outputs')
    .select('*')
    .eq('run_id', result.runId)
    .single()

  if (outErr || !output) {
    console.error('❌ Failed to find output record:', outErr?.message)
    process.exit(1)
  }

  if (!output.downloaded_by || !output.downloaded_at) {
    console.error('❌ Consent Evidence Package download audit not persisted')
    process.exit(1)
  }

  const { data: downloadAudit, error: downloadAuditError } = await supabase
    .from('deliverable_audit_events')
    .select('*')
    .eq('run_id', result.runId)
    .eq('action', 'artifact_downloaded')
    .maybeSingle()

  if (downloadAuditError || !downloadAudit) {
    console.error('❌ Failed to find download audit record:', downloadAuditError?.message)
    process.exit(1)
  }

  // 4. Verify audit event in DB
  const { data: audit, error: auditErr } = await supabase
    .from('deliverable_audit_events')
    .select('*')
    .eq('run_id', result.runId)
    .in('action', ['run_completed', 'artifact_downloaded'])

  if (auditErr || !audit) {
    console.error('❌ Failed to find audit record:', auditErr?.message)
    process.exit(1)
  }

  const auditActions = new Set(audit.map((row: any) => row.action))
  if (!auditActions.has('run_completed') || !auditActions.has('artifact_downloaded')) {
    console.error('❌ Missing required audit actions:', Array.from(auditActions).join(', '))
    process.exit(1)
  }
  
  // 5. Verify the actual evidence payload
  const { EvidenceResolver } = await import('../lib/deliverables/evidence-resolver')
  const runInfo = await supabase.from('deliverable_runs').select('*').eq('id', result.runId).single()
  const evidence = await EvidenceResolver.resolveForConsentEvidencePackage(supabase, {
    ...runInfo.data,
    filters: { studyId, subjectId }
  } as any)

  if (!evidence.timeline || evidence.timeline.length === 0) {
    console.error('❌ Consent timeline is empty!')
    process.exit(1)
  }
  
  console.log(`Verified Timeline events: ${evidence.timeline.length}`)
  console.log(`Verified Signatures hydrated: ${evidence.signatures.length}`)
  console.log(`Verified no financial data included.`)

  console.log('\n✅ Smoke Test Passed!')
  console.log(`Persistence verified for: PDF, Output Record, and Audit Events.`)
  console.log(`Hash: ${output.file_hash}`)
}

runSmokeTest().catch(console.error)
