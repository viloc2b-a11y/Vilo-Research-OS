import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import { generatePrintableSourcePacket } from '../lib/deliverables/generate-printable-source-packet'
import { createDeliverableRun } from '../lib/deliverables/create-deliverable-run'
import { getDeliverableDownloadUrl } from '../lib/deliverables/actions'
import fs from 'fs'
import path from 'path'

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function runSmokeTest() {
  console.log('\nStarting Printable Source Packet Smoke Test...\n')

  try {
    // 1. Find a completed visit instance for PARA_OA_012 or MV40618
    console.log('Fetching eligible visit instance...')
    let visitInstanceId: string | null = null
    let studyId: string | null = null
    
    // Attempt to find any visit instance
    const { data: visits } = await supabase
      .from('visit_runtime_instances')
      .select('id, study_id, subject_id, organization_id')
      .not('source_package_id', 'is', null)
      .limit(1)

    if (!visits || visits.length === 0) {
      console.log('No eligible visit instances found. Skipping full generation test.')
      return
    }

    visitInstanceId = visits[0].id
    studyId = visits[0].study_id
    const subjectId = visits[0].subject_id
    const organizationId = visits[0].organization_id
    console.log(`Found Visit Instance: ${visitInstanceId}\n`)

    // 2. Create Run
    console.log('Creating Deliverable Run...')
    const userId = '00000000-0000-0000-0000-000000000000'

    const { runId } = await createDeliverableRun({
      systemCode: 'printable_source_packet',
      organizationId,
      userId: userId,
      audience: 'cra',
      scope: 'visit',
      filters: { studyId, subjectId, visitInstanceId },
      supabase
    })
    console.log(`Created Run ID: ${runId}\n`)

    // 3. Generate Artifact
    console.log('Generating Printable Source Packet...')
    const result = await generatePrintableSourcePacket(supabase, runId)
    console.log('Generation Result:', result, '\n')

    const downloadResult = await getDeliverableDownloadUrl(result.storagePath)
    if (!downloadResult.success) {
      console.warn(`⚠️ Download URL could not be generated in this environment: ${downloadResult.error}`)
    }

    // 4. Verify DB Records
    const { data: outputs } = await supabase.from('deliverable_run_outputs').select('*').eq('run_id', runId)
    if (!outputs || outputs.length === 0) {
      throw new Error('No output record found in deliverable_run_outputs')
    }

    const outputRow = outputs[0]
    if (!outputRow.downloaded_by || !outputRow.downloaded_at) {
      throw new Error('Printable Source Packet download audit not persisted')
    }

    const { data: downloadAudit } = await supabase
      .from('deliverable_audit_events')
      .select('*')
      .eq('run_id', runId)
      .eq('action', 'artifact_downloaded')
      .maybeSingle()

    if (!downloadAudit) {
      throw new Error('Printable Source Packet download audit event not persisted')
    }

    const { data: auditEvents } = await supabase.from('deliverable_audit_events').select('*').eq('run_id', runId)
    if (!auditEvents || auditEvents.length < 3) {
      throw new Error('Insufficient audit events found')
    }

    console.log('✅ Smoke Test Passed!')
    console.log(`Persistence verified for: PDF, Output Record, and Audit Events.`)
    console.log(`Hash: ${result.fileHash}`)

  } catch (error: any) {
    console.error('❌ Smoke Test Failed:', error)
    process.exit(1)
  }
}

runSmokeTest()
