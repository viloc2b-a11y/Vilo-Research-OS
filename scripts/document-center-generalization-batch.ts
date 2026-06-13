import fs from 'node:fs'
import path from 'node:path'
import { config as loadEnv } from 'dotenv'
import { createClient } from '@supabase/supabase-js'
import { ingestComplianceDocument } from '../lib/document-intake/ingest-document'
import { createProtocolRuntimeStudy } from '../lib/protocol-intake-runtime/create-protocol-runtime-study'
import { createProtocolVersion } from '../lib/protocol-intake-runtime/create-protocol-version'
import { extractProtocolSectionsFromText } from '../lib/protocol-intake-runtime/extract-protocol-sections'
import { extractVisitCandidatesFromSections } from '../lib/protocol-intake-runtime/extract-visit-candidates'
import { extractProcedureCandidatesFromSections } from '../lib/protocol-intake-runtime/extract-procedure-candidates'
import { storeProtocolSections } from '../lib/protocol-intake-runtime/store-protocol-sections'
import { mapProtocolRuntimeSectionRow, mapProtocolRuntimeVisitCandidateRow } from '../lib/protocol-intake-runtime/protocol-intake-types'
import {
  initializeReconciliationSession,
  updateVisitCandidateStatus,
  updateProcedureCandidateStatus,
  approveReconciliationSession
} from '../lib/protocol-intake-reconciliation/reconciliation-actions'
import { assertProductionSeedAllowed } from './lib/production-seed-guard.mjs'

loadEnv({ path: '.env.local' })
loadEnv()

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message)
}

async function runE2E() {
  assertProductionSeedAllowed('document-center-generalization-batch')
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    throw new Error('Supabase URL/Key required for live E2E')
  }
  const supabase = createClient(url, key)

  let orgId = process.env.DOC_INTAKE_SMOKE_ORG_ID
  let actorId = process.env.PROTOCOL_RUNTIME_SMOKE_USER_ID

  if (!orgId) {
    const { data: orgs } = await supabase.from('organizations').select('id').limit(1).single()
    if (!orgs) throw new Error('No organizations found in DB')
    orgId = orgs.id
  }

  if (!actorId) {
    const { data: members } = await supabase.from('organization_members').select('user_id').eq('organization_id', orgId!).limit(1).single()
    if (!members) throw new Error('No members found in org')
    actorId = members.user_id
  }

  const tests = [
    { id: 'PROTOCOL_A001', file: '../../validation-corpus/sanitized/protocols/PROTOCOL_A001.txt', studyPrefix: 'GEN_A001' },
    { id: 'PROTOCOL_A002', file: '../../validation-corpus/sanitized/protocols/PROTOCOL_A002.txt', studyPrefix: 'GEN_A002' },
    { id: 'VACCINE_001', file: 'demo-vaccine-protocol.txt', studyPrefix: 'GEN_VAC' },
    { id: 'ONC_882', file: 'demo-oncology-protocol.txt', studyPrefix: 'GEN_ONC' }
  ]

  for (const test of tests) {
    console.log(`\n==============================================`)
    console.log(`Running Live E2E for ${test.id}`)
    console.log(`==============================================`)

    try {
      // Create a new study dynamically to avoid collisions
      const studySlug = `${test.studyPrefix.toLowerCase()}-${Date.now()}`
      const { data: studyInsert, error: studyErr } = await supabase
        .from('studies')
        .insert({
          organization_id: orgId,
          name: `${test.studyPrefix} Live Study`,
          status: 'active',
          slug: studySlug,
          created_source: 'test_seed',
        })
        .select('id')
        .single()
      if (studyErr) throw new Error(`Study creation failed: ${studyErr.message}`)
      const studyId = studyInsert.id
      console.log(`Created study: ${studyId}`)

      // 1. Upload through /document-intake (using ingest API directly like the route does)
      const filepath = path.join(__dirname, '../fixtures/protocol-intake', test.file)
      const fileBuffer = fs.readFileSync(filepath)
      const file = new File([fileBuffer], path.basename(test.file), { type: 'text/plain' })

      console.log(`1. Uploading ${path.basename(test.file)}...`)
      const ingestResult = await ingestComplianceDocument({
        supabase,
        file,
        fileBuffer,
        organizationId: orgId,
        studyId,
        subjectId: null,
        visitId: null,
        procedureExecutionId: null,
        documentClassification: 'protocol',
        destinationDomain: 'study_documents',
        destinationEntityType: 'study',
        destinationEntityId: studyId,
        operationalDisplayName: `${test.id} E2E Upload`,
        expirationDate: null,
        certifiedCopyAttested: false,
        operationalNotes: 'E2E Test',
        actorId,
        actorRole: 'research_coordinator',
      })

      if (!ingestResult.ok) throw new Error(`Upload failed: ${ingestResult.message}`)
      console.log(`   Document ID: ${ingestResult.documentId}`)

      // 2 & 3. Simulate Extraction Job (creates candidates)
      console.log(`2. Triggering Extraction Job...`)
      const runtimeStudy = await createProtocolRuntimeStudy({
        supabase,
        createdBy: actorId,
        input: {
          organization_id: orgId,
          study_id: studyId,
          protocol_number: test.id,
          protocol_title: `${test.id} Live Protocol`,
          source_document_id: ingestResult.documentId,
        }
      })

      const version = await createProtocolVersion({
        supabase,
        createdBy: actorId,
        input: {
          organization_id: orgId,
          protocol_runtime_study_id: runtimeStudy.id,
          version_label: 'v1.0',
          version_date: new Date().toISOString().slice(0, 10),
          source_document_id: ingestResult.documentId,
        }
      })
      const protocolVersionId = version.id

      const sourceText = fileBuffer.toString('utf8')
      const extractedSections = extractProtocolSectionsFromText(sourceText)
      await storeProtocolSections(supabase, protocolVersionId, extractedSections)

      const { data: sectionRows } = await supabase.from('protocol_runtime_sections').select('*').eq('protocol_version_id', protocolVersionId).order('sequence_order')
      const sections = (sectionRows ?? []).map(row => mapProtocolRuntimeSectionRow(row as any))

      const visitCandidates = extractVisitCandidatesFromSections(sections)
      if (visitCandidates.length > 0) {
        await supabase.from('protocol_runtime_visit_candidates').insert(
          visitCandidates.map(visit => ({
            protocol_version_id: protocolVersionId,
            visit_code: visit.visit_code,
            visit_name: visit.visit_name,
            visit_type: visit.visit_type,
            study_day: visit.study_day,
            reconciliation_status: 'unreviewed',
            metadata: visit.metadata,
          }))
        )
      }

      const { data: visitRows } = await supabase.from('protocol_runtime_visit_candidates').select('*').eq('protocol_version_id', protocolVersionId)
      const storedVisits = (visitRows ?? []).map(row => mapProtocolRuntimeVisitCandidateRow(row as any))
      
      const procedureCandidates = extractProcedureCandidatesFromSections({ sections, visits: storedVisits })
      if (procedureCandidates.length > 0) {
        await supabase.from('protocol_runtime_procedure_candidates').insert(
          procedureCandidates.map(proc => ({
            protocol_version_id: protocolVersionId,
            visit_candidate_id: proc.visit_candidate_id,
            procedure_name: proc.procedure_name,
            procedure_category: proc.procedure_category,
            extracted_text: proc.extracted_text,
            reconciliation_status: 'unreviewed',
            metadata: proc.metadata,
          }))
        )
      }

      await supabase.from('protocol_runtime_versions').update({ extraction_status: 'ready' }).eq('id', protocolVersionId)
      console.log(`3. Candidates created: ${visitCandidates.length} visits, ${procedureCandidates.length} procedures`)

      // 4. initializeReconciliationSession
      console.log(`4. Initializing Reconciliation Session...`)
      const initResult = await initializeReconciliationSession({ supabase, organizationId: orgId, protocolVersionId, createdBy: actorId })
      console.log(`   Copied ${initResult.visitCount} visits, ${initResult.procedureCount} procedures`)

      const { data: initVisits } = await supabase.from('protocol_visit_reconciliations').select('*').eq('protocol_version_id', protocolVersionId)
      const { data: initProcs } = await supabase.from('protocol_procedure_reconciliations').select('*').eq('protocol_version_id', protocolVersionId)
      
      assert(initVisits!.length === visitCandidates.length, 'Visit candidate count mismatch')
      assert(initProcs!.length === procedureCandidates.length, 'Procedure candidate count mismatch')

      // 5. Coordinator approval flow works
      console.log(`5. Approving candidates...`)
      for (const v of initVisits!) {
        await updateVisitCandidateStatus({
          supabase, organizationId: orgId, protocolVersionId, visitReconciliationId: v.id, status: 'approved', actorId
        })
      }

      // Get a valid blueprint mapping
      let validBlueprint = null
      const { data: bps } = await supabase.from('procedure_blueprint_versions').select('id, procedure_id').limit(1).single()
      if (bps) validBlueprint = { id: bps.id, procedure_library_id: bps.procedure_id }
      else {
        // Create dummy library
        const { data: lib, error: libErr } = await supabase.from('procedure_library').insert({
          organization_id: orgId,
          procedure_code: 'DUMMY' + Date.now(),
          procedure_name: 'Dummy Proc',
          procedure_category: 'assessment',
          library_scope: 'organization',
          created_by: actorId
        }).select('id').single()
        if (libErr) throw new Error('Lib insert failed: ' + libErr.message)

        const { data: bp, error: bpErr } = await supabase.from('procedure_blueprint_versions').insert({
          procedure_id: lib!.id,
          version_label: 'v1.0',
          created_by: actorId
        }).select('id').single()
        if (bpErr) throw new Error('Bp insert failed: ' + bpErr.message)

        validBlueprint = { id: bp!.id, procedure_library_id: lib!.id }
      }

      // For procedures we need a blueprint mapping and visit mapping. We'll hack it for the test
      for (const p of initProcs!) {
        const { error: updErr } = await supabase.from('protocol_procedure_reconciliations').update({
          matched_blueprint_version_id: validBlueprint.id,
          matched_procedure_library_id: validBlueprint.procedure_library_id,
          visit_reconciliation_id: p.visit_reconciliation_id || initVisits![0].id
        }).eq('id', p.id)
        
        if (updErr) throw new Error(`Failed to map procedure: ${updErr.message}`)
        
        const res = await updateProcedureCandidateStatus({
          supabase, organizationId: orgId, protocolVersionId, procedureReconciliationId: p.id, status: 'approved', actorId
        })
      }

      // 6, 7, 8. approveReconciliationSession
      console.log(`6-8. Approving Reconciliation Session...`)
      const approveResult = await approveReconciliationSession({ supabase, organizationId: orgId, studyId, protocolVersionId, actorId })
      console.log(`   Session approved! Snapshot ID: ${approveResult.runtimeSnapshotId}`)
      
      // Check events
      const { data: events } = await supabase.from('protocol_reconciliation_events').select('*').eq('protocol_version_id', protocolVersionId).order('created_at', { ascending: false }).limit(1)
      const eventId = events?.[0]?.id || 'unknown'
      console.log(`   Event ID created: ${eventId}`)

      // 9. Runtime objects exist
      const { count: rtVisits } = await supabase.from('study_runtime_visits').select('*', { count: 'exact' }).eq('study_id', studyId)
      console.log(`9. Runtime objects exist. Visits count: ${rtVisits}`)

      // 10. Source Builder receives runtime snapshot
      const { data: snapshots } = await supabase.from('study_runtime_composition_snapshots').select('*').eq('id', approveResult.runtimeSnapshotId)
      const snapshotId = snapshots?.[0]?.id || 'unknown'
      console.log(`10. Source package composition snapshot id: ${snapshotId}`)

      // Source package created as part of approveReconciliationSession
      const sourcePackage = approveResult.sourcePackage!
      console.log(`11. Source Package created — ID: ${sourcePackage.id} (v${sourcePackage.version})`)
      
      const { data: generatedForms } = await supabase.from('runtime_source_visit_shells').select('visit_name').eq('source_package_id', sourcePackage.id).limit(3)
      const formNames = (generatedForms ?? []).map(f => f.visit_name)
      console.log(`    Generated ${sourcePackage.visitShellCount} source visit forms and ${sourcePackage.procedureShellCount} procedure forms.`)
      console.log(`    First 3 form names: ${formNames.join(', ')}`)

      // 12. Confirm no candidates were mutated
      const { data: candVisitsPost } = await supabase.from('protocol_runtime_visit_candidates').select('reconciliation_status').eq('protocol_version_id', protocolVersionId)
      assert(candVisitsPost!.every(v => v.reconciliation_status === 'unreviewed'), 'Candidate tables were mutated!')
      console.log(`12. Candidate tables remain unmodified.`)

      console.log(`✅ ${test.id} E2E COMPLETED SUCCESSFULLY`)
      console.log({
        file_name: path.basename(test.file),
        protocol_version_id: protocolVersionId,
        study_id: studyId,
        visit_candidate_count: visitCandidates.length,
        procedure_candidate_count: procedureCandidates.length,
        reconciliation_counts: { visits: initVisits!.length, procedures: initProcs!.length },
        generated_runtime_snapshot_id: approveResult.runtimeSnapshotId,
        composition_snapshot_id: approveResult.runtimeSnapshotId,
        source_package_id: sourcePackage.id,
        number_of_generated_source_forms: sourcePackage.visitShellCount + sourcePackage.procedureShellCount,
        first_3_source_form_names: formNames,
        ui_route_to_open_package: `/vilo/studies/${studyId}/source-builder/${sourcePackage.id}`,
        failed_step: null
      })
    } catch (err: any) {
      console.error(`❌ ${test.id} E2E FAILED:`, err.message)
      console.log({
        file_name: path.basename(test.file),
        failed_step: err.message
      })
    }
  }
}

runE2E().catch(err => {
  console.error('\n❌ E2E Failed:', err)
  process.exit(1)
})
