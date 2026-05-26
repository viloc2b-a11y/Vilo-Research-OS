/**
 * Phase 3 smoke: study runtime composition layer.
 *
 * Usage:
 *   npx tsx scripts/study-runtime-composition-phase3-smoke.ts
 *   npx tsx scripts/study-runtime-composition-phase3-smoke.ts --live
 */
import { createClient } from '@supabase/supabase-js'
import { assignBlueprintToStudy } from '../lib/procedure-library/assign-blueprint-to-study'
import { createProcedure } from '../lib/procedure-library/create-procedure'
import { createBlueprintVersion } from '../lib/procedure-library/create-blueprint-version'
import { publishBlueprintVersion } from '../lib/procedure-library/publish-blueprint-version'
import {
  buildFieldSchemaFromBlueprint,
  buildMinimalBlueprint,
} from '../lib/procedure-library/procedure-types'
import { createRuntimeVisit } from '../lib/study-runtime-composition/create-runtime-visit'
import { addProcedureToVisit } from '../lib/study-runtime-composition/add-procedure-to-visit'
import { compileStudyRuntimeGraph } from '../lib/study-runtime-composition/compile-study-runtime-graph'
import { computeStudyRuntimeGraphHash } from '../lib/study-runtime-composition/graph-hash'

const LIVE = process.argv.includes('--live')

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message)
}

function runUnitChecks() {
  console.log('--- Phase 3 unit checks ---')
  const graph = {
    study_id: 'study-1',
    organization_id: 'org-1',
    visits: [
      {
        visit_id: 'v1',
        visit_code: 'V1',
        visit_name: 'Screening',
        visit_type: 'screening' as const,
        study_day: -7,
        window: { before_days: 3, after_days: 3 },
        sequence_order: 1,
        allowed_modes: ['onsite'],
        required: true,
        procedures: [
          {
            procedure_id: 'p1',
            procedure_code: 'VITAL_SIGNS',
            procedure_name: 'Vital Signs',
            blueprint_version_id: 'bv1',
            study_procedure_blueprint_id: 'spb1',
            procedure_order: 1,
            required: true,
            optionality_rule: {},
            dependency_rule: { rules: [{ if: { field: 'x' }, then: { show_warning: 'y' } }] },
            timing_rule: {},
            operational_overrides: {},
          },
        ],
      },
    ],
  }

  const hash1 = computeStudyRuntimeGraphHash(graph)
  const hash2 = computeStudyRuntimeGraphHash(graph)
  assert(hash1 === hash2, 'graph_hash must be deterministic')
  assert(hash1.length === 64, 'graph_hash must be SHA-256 hex')
  console.log('✅ Deterministic graph_hash')
}

async function runLiveChecks() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    console.log('⏭️  Skipping live checks (Supabase env not set)')
    return
  }

  const orgId = process.env.STUDY_RUNTIME_SMOKE_ORG_ID ?? process.env.PROCEDURE_LIB_SMOKE_ORG_ID
  const studyId = process.env.STUDY_RUNTIME_SMOKE_STUDY_ID ?? process.env.PROCEDURE_LIB_SMOKE_STUDY_ID
  const actorId =
    process.env.STUDY_RUNTIME_SMOKE_ACTOR_ID
    ?? process.env.PROCEDURE_LIB_SMOKE_ACTOR_ID
    ?? '00000000-0000-4000-8000-000000000900'

  if (!orgId || !studyId) {
    console.log('⏭️  Set STUDY_RUNTIME_SMOKE_ORG_ID and STUDY_RUNTIME_SMOKE_STUDY_ID for live checks')
    return
  }

  console.log('--- Phase 3 live integration ---')
  const supabase = createClient(url, key)

  const blueprint = buildMinimalBlueprint('main', 'Smoke Runtime Procedure', [
    { field_id: 'completed', type: 'yes_no', required: true },
  ])

  const procedure = await createProcedure({
    supabase,
    createdBy: actorId,
    input: {
      library_scope: 'organization',
      organization_id: orgId,
      procedure_code: `RT_SMOKE_${Date.now()}`,
      procedure_name: 'Runtime Smoke Procedure',
      procedure_category: 'assessment',
    },
  })

  const version = await createBlueprintVersion({
    supabase,
    procedureId: procedure.id,
    createdBy: actorId,
    input: {
      blueprint_json: blueprint,
      field_schema: buildFieldSchemaFromBlueprint(blueprint),
      dependency_schema: { rules: [] },
    },
  })

  const blueprintHashBefore = (
    await supabase
      .from('procedure_blueprint_versions')
      .select('blueprint_json')
      .eq('id', version.id)
      .single()
  ).data?.blueprint_json

  await publishBlueprintVersion({
    supabase,
    procedureId: procedure.id,
    versionId: version.id,
  })

  const assignment = await assignBlueprintToStudy({
    supabase,
    createdBy: actorId,
    input: {
      organization_id: orgId,
      study_id: studyId,
      procedure_id: procedure.id,
      blueprint_version_id: version.id,
    },
  })
  console.log('✅ Assigned published procedure blueprint to study')

  const visit = await createRuntimeVisit({
    supabase,
    createdBy: actorId,
    input: {
      organization_id: orgId,
      study_id: studyId,
      visit_code: `VSMOKE_${Date.now()}`,
      visit_name: 'Runtime Smoke Visit',
      visit_type: 'screening',
      study_day: 1,
      window_before_days: 2,
      window_after_days: 2,
      sequence_order: 99,
      allowed_modes: ['onsite', 'phone'],
    },
  })
  console.log('✅ Created runtime visit')

  await addProcedureToVisit({
    supabase,
    createdBy: actorId,
    input: {
      organization_id: orgId,
      study_id: studyId,
      visit_id: visit.id,
      study_procedure_blueprint_id: assignment.id,
      procedure_order: 1,
      dependency_rule: { rules: [{ if: { field: 'completed', equals: 'no' }, then: { show_warning: 'Follow up' } }] },
    },
  })
  console.log('✅ Added procedure to visit')

  const compiled1 = await compileStudyRuntimeGraph({ supabase, organizationId: orgId, studyId })
  const compiled2 = await compileStudyRuntimeGraph({ supabase, organizationId: orgId, studyId })
  assert(compiled1.graphHash === compiled2.graphHash, 'Compile graph_hash must be deterministic')

  const visitNode = compiled1.graph.visits.find((node) => node.visit_id === visit.id)
  assert(Boolean(visitNode), 'Compiled graph includes visit')
  assert(visitNode?.study_day === 1, 'Visit study_day preserved')
  assert(visitNode?.window.before_days === 2 && visitNode?.window.after_days === 2, 'Visit windows preserved')
  assert(visitNode?.procedures[0]?.blueprint_version_id === version.id, 'Exact blueprint_version_id pinned')
  assert(visitNode?.procedures[0]?.procedure_order === 1, 'Procedure order preserved')
  console.log('✅ Compiled runtime graph with pinned versions')

  const blueprintHashAfter = (
    await supabase
      .from('procedure_blueprint_versions')
      .select('blueprint_json')
      .eq('id', version.id)
      .single()
  ).data?.blueprint_json
  assert(
    JSON.stringify(blueprintHashBefore) === JSON.stringify(blueprintHashAfter),
    'Blueprint content must not mutate during composition',
  )
  console.log('✅ No blueprint mutation during composition')
}

async function main() {
  runUnitChecks()
  if (LIVE) {
    await runLiveChecks()
  } else {
    console.log('Tip: run with --live and STUDY_RUNTIME_SMOKE_* env vars for DB integration')
  }
  console.log('------------------------------------------------------------')
  console.log('Phase 3 study runtime composition smoke test passed.')
}

main().catch((err) => {
  console.error('Smoke test failed:', err)
  process.exit(1)
})
