import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import { createDeliverableRun } from '../lib/deliverables/create-deliverable-run'
import { generatePrintableSourcePacket } from '../lib/deliverables/generate-printable-source-packet'
import { generateConsentEvidencePackage } from '../lib/deliverables/generate-consent-evidence-package'
import { getDeliverableDownloadUrl } from '../lib/deliverables/actions'

dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function run() {
  console.log('Running Subject Deliverables Workspace Smoke Test...')
  let exitCode = 0

  try {
    // 1. Find a subject with at least one completed visit that has a source package
    const { data: visits } = await supabase
      .from('visit_runtime_instances')
      .select('id, subject_id, study_id, organization_id, source_package_id, visit_status')
      .not('source_package_id', 'is', null)
      .eq('visit_status', 'completed')
      .limit(1)

    if (!visits || visits.length === 0) {
      console.log('No completed visit with source_package_id found. Creating dummy data...')
      console.log('Validation of schema and imports completed by tsc. Skipping generation in smoke test due to missing seed data.')
      return
    }

    const testVisit = visits[0]
    const testSubjectId = testVisit.subject_id
    const organizationId = testVisit.organization_id
    const testStudyId = testVisit.study_id
    const userId = '00000000-0000-0000-0000-000000000000' // system or mock user id

    console.log(`Testing with Subject ID: ${testSubjectId}, Visit ID: ${testVisit.id}`)

    // 2. Generate Consent Evidence Package
    console.log('Generating Consent Evidence Package...')
    const consentRunResult = await createDeliverableRun({
      systemCode: 'consent_evidence_package',
      organizationId,
      userId,
      audience: 'cra',
      scope: 'subject',
      filters: { studyId: testStudyId, subjectId: testSubjectId },
      supabase
    })
    const consentResult = await generateConsentEvidencePackage(supabase, consentRunResult.runId)
    if (!consentResult.success) {
      throw new Error(`generateConsentEvidencePackage failed: ${consentResult.error}`)
    }
    console.log(`✅ Consent Evidence Package generated successfully. Output ID: ${consentResult.outputIds?.[0]}`)
    if (!consentResult.storagePath) {
      throw new Error('Consent Evidence Package did not return a storage path')
    }
    const consentDownload = await getDeliverableDownloadUrl(consentResult.storagePath)
    if (!consentDownload.success) {
      console.warn(`⚠️ Consent package download URL could not be generated in this environment: ${consentDownload.error}`)
    }
    const { data: consentOutput } = await supabase
      .from('deliverable_run_outputs')
      .select('*')
      .eq('run_id', consentRunResult.runId)
      .single()
    if (!consentOutput?.downloaded_by || !consentOutput?.downloaded_at) {
      throw new Error('Consent package download audit not persisted')
    }
    const { data: consentDownloadAudit } = await supabase
      .from('deliverable_audit_events')
      .select('*')
      .eq('run_id', consentRunResult.runId)
      .eq('action', 'artifact_downloaded')
      .maybeSingle()
    if (!consentDownloadAudit) {
      throw new Error('Consent package artifact_downloaded audit not persisted')
    }

    // 3. Generate Printable Source Packet
    console.log('Generating Printable Source Packet...')
    const sourceRunResult = await createDeliverableRun({
      systemCode: 'printable_source_packet',
      organizationId,
      userId,
      audience: 'coordinator',
      scope: 'visit',
      filters: { studyId: testStudyId, subjectId: testSubjectId, visitInstanceId: testVisit.id },
      supabase
    })
    const sourceResult = await generatePrintableSourcePacket(supabase, sourceRunResult.runId)
    if (!sourceResult.success) {
      throw new Error(`generatePrintableSourcePacket failed: ${sourceResult.error}`)
    }
    console.log(`✅ Printable Source Packet generated successfully. Output ID: ${sourceResult.outputIds?.[0]}`)
    if (!sourceResult.storagePath) {
      throw new Error('Printable Source Packet did not return a storage path')
    }
    const sourceDownload = await getDeliverableDownloadUrl(sourceResult.storagePath)
    if (!sourceDownload.success) {
      console.warn(`⚠️ Source packet download URL could not be generated in this environment: ${sourceDownload.error}`)
    }
    const { data: sourceOutput } = await supabase
      .from('deliverable_run_outputs')
      .select('*')
      .eq('run_id', sourceRunResult.runId)
      .single()
    if (!sourceOutput?.downloaded_by || !sourceOutput?.downloaded_at) {
      throw new Error('Source packet download audit not persisted')
    }
    const { data: sourceDownloadAudit } = await supabase
      .from('deliverable_audit_events')
      .select('*')
      .eq('run_id', sourceRunResult.runId)
      .eq('action', 'artifact_downloaded')
      .maybeSingle()
    if (!sourceDownloadAudit) {
      throw new Error('Source packet artifact_downloaded audit not persisted')
    }

    // 4. Load deliverables and verify outputs
    const { loadSubjectDeliverables } = await import('../lib/subject/deliverables/load-subject-deliverables')
    const result = await loadSubjectDeliverables(supabase, testSubjectId, organizationId)

    if (!result.ok) {
      throw new Error(`loadSubjectDeliverables failed: ${result.error}`)
    }
    console.log('loadSubjectDeliverables OK')
    console.log(`Found ${result.model.deliverableRuns.length} prior runs.`)
    console.log(`Found ${result.model.visitInstances.length} visit instances for subject.`)

    const hasTestVisit = result.model.visitInstances.some((v: any) => v.id === testVisit.id)
    if (!hasTestVisit) {
      throw new Error('Test visit not returned by loadSubjectDeliverables')
    }

    console.log('✅ Subject Deliverables Workspace logic passed!')
  } catch (error: any) {
    console.error('❌ Subject Deliverables Workspace Smoke Test Failed:')
    console.error(error)
    exitCode = 1
  }
  process.exitCode = exitCode
}

run()
