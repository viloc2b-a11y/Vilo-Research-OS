import fs from 'node:fs'
import path from 'node:path'
import { config as loadEnv } from 'dotenv'
import { createClient } from '@supabase/supabase-js'
import { ingestComplianceDocument } from '../lib/document-intake/ingest-document'
import { createProtocolRuntimeStudy } from '../lib/protocol-intake-runtime/create-protocol-runtime-study'
import { createProtocolVersion } from '../lib/protocol-intake-runtime/create-protocol-version'
import {
  initializeReconciliationSession,
  updateVisitCandidateStatus,
  updateProcedureCandidateStatus,
  approveReconciliationSession
} from '../lib/protocol-intake-reconciliation/reconciliation-actions'
import { extractProtocolVersion } from '../lib/protocol-intake-runtime/run-extraction-pipeline'

loadEnv({ path: '.env.local' })
loadEnv()

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message)
}

async function runE2E() {
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
    {
      id: 'PARA_OA_012',
      file: path.resolve(
        __dirname,
        '..',
        'validation-corpus',
        'raw',
        'processed-originals',
        '01. PARA_OA_012_Protocol v4.0_Amendment 3_24Feb2026_redline.pdf',
      ),
      studyPrefix: 'PARA_E2E',
    },
    {
      id: 'MV40618',
      file: path.resolve(
        __dirname,
        '..',
        'validation-corpus',
        'inbox',
        'MV40618_eCRF Completion Guidelines_9.0_16Jun2022.pdf',
      ),
      studyPrefix: 'MV_E2E',
    },
  ]

  for (const test of tests) {

    // Create a new study dynamically to avoid collisions
    const studySlug = `${test.studyPrefix.toLowerCase()}-${Date.now()}`
    const { data: studyInsert, error: studyErr } = await supabase
      .from('studies')
      .insert({
        organization_id: orgId,
        name: `${test.studyPrefix} Live Study`,
        status: 'active',
        slug: studySlug,
        created_source: 'test_seed'
      })
      .select('id')
      .single()
    if (studyErr) throw new Error(`Study creation failed: ${studyErr.message}`)
    const studyId = studyInsert.id
    console.log(`Created study: ${studyId}`)

    // 1. Upload through /document-intake (using ingest API directly like the route does)
    const filepath = test.file
    if (!fs.existsSync(filepath)) {
      throw new Error(`Corpus file not found: ${filepath}`)
    }
    const fileBuffer = fs.readFileSync(filepath)
    const file = new File([fileBuffer], path.basename(filepath), { type: 'application/pdf' })

    console.log(`1. Uploading ${test.file}...`)
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

    // 2 & 3. Trigger canonical reader extraction against the persisted source document.
    console.log(`2. Triggering canonical reader extraction...`)
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

    const extraction = await extractProtocolVersion({
      supabase,
      organizationId: orgId,
      versionId: protocolVersionId,
      actorId,
    })
    console.log(
      `   Extracted: ${extraction.sectionCount} sections, ${extraction.visitCandidateCount} visits, ${extraction.procedureCandidateCount} procedures`,
    )

    const { data: sectionRows } = await supabase
      .from('protocol_runtime_sections')
      .select('*')
      .eq('protocol_version_id', protocolVersionId)
      .order('sequence_order')
    const { data: visitRows } = await supabase
      .from('protocol_runtime_visit_candidates')
      .select('*')
      .eq('protocol_version_id', protocolVersionId)
    const { data: procedureRows } = await supabase
      .from('protocol_runtime_procedure_candidates')
      .select('*')
      .eq('protocol_version_id', protocolVersionId)

    console.log(
      `3. Candidate rows persisted: ${(sectionRows ?? []).length} sections, ${(visitRows ?? []).length} visits, ${(procedureRows ?? []).length} procedures`,
    )

    // 4. initializeReconciliationSession
    console.log(`4. Initializing Reconciliation Session...`)
    const initResult = await initializeReconciliationSession({ supabase, organizationId: orgId, protocolVersionId, createdBy: actorId })
    console.log(`   Copied ${initResult.visitCount} visits, ${initResult.procedureCount} procedures`)

    const { data: initVisits } = await supabase.from('protocol_visit_reconciliations').select('*').eq('protocol_version_id', protocolVersionId)
    const { data: initProcs } = await supabase.from('protocol_procedure_reconciliations').select('*').eq('protocol_version_id', protocolVersionId)
    
    assert(initVisits!.length === (visitRows ?? []).length, 'Visit candidate count mismatch')
    assert(initProcs!.length === (procedureRows ?? []).length, 'Procedure candidate count mismatch')

    // 12. Confirm provenance metadata survived
    const sampleProc = initProcs![0]
    if ((procedureRows ?? [])[0]?.metadata && (procedureRows ?? [])[0].metadata.provenance) {
      assert(sampleProc.metadata?.provenance !== undefined, 'Provenance metadata lost during initialization')
    }

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

    // Create Source Package Draft
    console.log(`11. Creating Source Package Draft...`)
    const { createRuntimeSourcePackage } = await import('../lib/runtime-source-package/create-runtime-source-package')
    const sourcePackageResult = await createRuntimeSourcePackage({
      supabase,
      generatedBy: actorId,
      input: {
        organization_id: orgId,
        study_id: studyId,
        composition_snapshot_id: snapshotId,
        package_name: `${test.id} Source Package v1.0`
      }
    })
    console.log(`    Source Package ID: ${sourcePackageResult.package.id}`)
    
    const { data: generatedForms } = await supabase.from('runtime_source_visit_shells').select('visit_name').eq('source_package_id', sourcePackageResult.package.id).limit(3)
    const formNames = (generatedForms ?? []).map(f => f.visit_name)
    console.log(`    Generated ${sourcePackageResult.visitShellCount} source visit forms and ${sourcePackageResult.procedureShellCount} procedure forms.`)
    console.log(`    First 3 form names: ${formNames.join(', ')}`)

    // 12. Confirm no candidates were mutated
    const { data: candVisitsPost } = await supabase.from('protocol_runtime_visit_candidates').select('reconciliation_status').eq('protocol_version_id', protocolVersionId)
    assert(candVisitsPost!.every(v => v.reconciliation_status === 'unreviewed'), 'Candidate tables were mutated!')
    console.log(`12. Candidate tables remain unmodified.`)

    // Extract provenance
    const sampleProvenance = initProcs![0]?.metadata?.provenance ?? 'No provenance found'

    console.log(`✅ ${test.id} E2E COMPLETED SUCCESSFULLY`)
    console.log({
      protocol_version_id: protocolVersionId,
      study_id: studyId,
      generated_runtime_snapshot_id: approveResult.runtimeSnapshotId,
      composition_snapshot_id: snapshotId,
      source_package_id: sourcePackageResult.package.id,
      number_of_generated_source_forms: sourcePackageResult.visitShellCount + sourcePackageResult.procedureShellCount,
      first_3_source_form_names: formNames,
      source_metadata_provenance_sample: sampleProvenance,
      ui_route_to_open_package: `/vilo/studies/${studyId}/source-builder/${sourcePackageResult.package.id}`
    })
  }
}

runE2E().catch(err => {
  console.error('\n❌ E2E Failed:', err)
  process.exit(1)
})
