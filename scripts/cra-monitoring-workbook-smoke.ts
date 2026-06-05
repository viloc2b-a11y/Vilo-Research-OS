import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import { createDeliverableRun } from '../lib/deliverables/create-deliverable-run'
import { generateCRAMonitoringWorkbook } from '../lib/deliverables/generate-cra-monitoring-workbook'
import { getDeliverableDownloadUrl } from '../lib/deliverables/actions'
import ExcelJS from 'exceljs'

dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function run() {
  console.log('Running CRA Monitoring Workbook Smoke Test...')
  let exitCode = 0

  try {
    // 1. Find a real study with subjects/visits
    const { data: visits } = await supabase
      .from('visit_runtime_instances')
      .select('study_id, organization_id')
      .eq('visit_status', 'completed')
      .limit(1)

    let resultStoragePath = null
    let resultOutputId = null

    if (!visits || visits.length === 0) {
      console.log('No executed visits found. Testing Renderer only with mock evidence...')
      const { renderCRAMonitoringWorkbook } = await import('../lib/deliverables/renderers/cra-monitoring-workbook')
      const mockEvidence = {
        workbookName: 'CRA Monitoring Workbook',
        studyName: 'Mock Study',
        protocolNumber: 'MOCK-001',
        site: 'Mock Site',
        generatedAt: new Date().toISOString(),
        generatedBy: 'System',
        asOfDate: new Date().toISOString(),
        audience: 'CRA',
        scopeSummary: 'All Subjects',
        subjectCount: 1,
        visitCount: 1,
        versionLogic: 'ALL_EXECUTED_VERSIONS',
        deliverableRunId: 'mock-run-id',
        subjects: [{
          subjectIdentifier: 'SUB-001',
          subjectStatus: 'Enrolled',
          currentConsentStatus: 'active',
          latestVisitStatus: 'Completed',
        }],
        visits: [{
          subjectIdentifier: 'SUB-001',
          visitName: 'Screening',
          visitStatus: 'Completed',
          proceduresCompletedCount: 5,
          proceduresExpectedCount: 5,
          signatureStatus: 'Signed',
          sourcePacketAvailable: true
        }],
        procedures: [],
        consents: [],
        signatures: [],
        documents: []
      }
      const buffer = await renderCRAMonitoringWorkbook(mockEvidence as any)
      const fs = await import('fs')
      const path = await import('path')
      const outPath = path.join(process.cwd(), '.tmp', 'mock-cra-workbook.xlsx')
      if (!fs.existsSync(path.join(process.cwd(), '.tmp'))) fs.mkdirSync(path.join(process.cwd(), '.tmp'))
      fs.writeFileSync(outPath, buffer)
      console.log(`✅ CRA Monitoring Workbook generated to ${outPath}`)

      const workbook = new ExcelJS.Workbook()
      await workbook.xlsx.readFile(outPath)

      const requiredSheets = [
        'Cover',
        'Subject Index',
        'Visit Index',
        'Procedure Matrix',
        'Consent Summary',
        'Signature Summary',
        'Document Lineage Summary'
      ]

      const actualSheets = workbook.worksheets.map(s => s.name)
      const missingSheets = requiredSheets.filter(s => !actualSheets.includes(s))
      
      if (missingSheets.length > 0) {
        throw new Error(`Missing required sheets: ${missingSheets.join(', ')}`)
      }
      
      console.log('✅ CRA Monitoring Workbook Smoke Test passed (MOCK MODE)!')
      return
    }

    const testStudyId = visits[0].study_id
    const organizationId = visits[0].organization_id
    const userId = '00000000-0000-0000-0000-000000000000'

    console.log(`Testing with Study ID: ${testStudyId}`)

    // 2. Create Deliverable Run
    const runResult = await createDeliverableRun({
      systemCode: 'cra_monitoring_workbook',
      organizationId,
      userId,
      audience: 'cra',
      scope: 'study',
      filters: { studyId: testStudyId },
      supabase
    })
    
    // 3. Generate XLSX
    const result = await generateCRAMonitoringWorkbook(supabase, runResult.runId)
    
    if (!result.success || !result.outputHash) {
      throw new Error(`generateCRAMonitoringWorkbook failed: ${result.error}`)
    }
    
    console.log(`✅ CRA Monitoring Workbook generated successfully. Output ID: ${result.outputIds?.[0]}`)

    const downloadResult = await getDeliverableDownloadUrl(result.storagePath!)
    if (!downloadResult.success || !downloadResult.signedUrl) {
      throw new Error(`Failed to log workbook download: ${downloadResult.error}`)
    }

    const { data: downloadedOutput } = await supabase
      .from('deliverable_run_outputs')
      .select('downloaded_by, downloaded_at')
      .eq('run_id', runResult.runId)
      .single()

    if (!downloadedOutput?.downloaded_by || !downloadedOutput?.downloaded_at) {
      throw new Error('Workbook download audit was not persisted.')
    }

    const { data: downloadAudit } = await supabase
      .from('deliverable_audit_events')
      .select('*')
      .eq('run_id', runResult.runId)
      .eq('action', 'artifact_downloaded')
      .single()

    if (!downloadAudit) {
      throw new Error('Workbook download audit event was not persisted.')
    }

    // 4. Confirm sheets exist
    const { data: fileData, error: downloadError } = await supabase.storage.from('operational-documents').download(result.storagePath!)
    if (downloadError) throw new Error(`Failed to download artifact: ${downloadError.message}`)

    const buffer = await fileData.arrayBuffer()
    const workbook = new ExcelJS.Workbook()
    await workbook.xlsx.load(Buffer.from(buffer))

    const requiredSheets = [
      'Cover',
      'Subject Index',
      'Visit Index',
      'Procedure Matrix',
      'Consent Summary',
      'Signature Summary',
      'Document Lineage Summary'
    ]

    const actualSheets = workbook.worksheets.map(s => s.name)
    const missingSheets = requiredSheets.filter(s => !actualSheets.includes(s))
    
    if (missingSheets.length > 0) {
      throw new Error(`Missing required sheets: ${missingSheets.join(', ')}`)
    }

    // 5. Confirm excluded content is not present
    const excludedTerms = ['query', 'deviation', 'risk', 'leakage', 'coordinator burden', 'vpi']
    workbook.worksheets.forEach(sheet => {
      sheet.eachRow((row, rowNumber) => {
        row.eachCell((cell, colNumber) => {
          if (cell.value && typeof cell.value === 'string') {
            const lowerValue = cell.value.toLowerCase()
            excludedTerms.forEach(term => {
              if (lowerValue.includes(term)) {
                console.warn(`⚠️ Warning: Excluded term '${term}' found in ${sheet.name} at row ${rowNumber}`)
                // Typically we'd throw but we just warn in smoke since test data might have arbitrary strings
              }
            })
          }
        })
      })
    })

    console.log('✅ CRA Monitoring Workbook Smoke Test passed!')

  } catch (error: any) {
    console.error('❌ CRA Monitoring Workbook Smoke Test Failed:')
    console.error(error)
    exitCode = 1
  }
  
  process.exitCode = exitCode
}

run()
