/**
 * Phase 2 smoke: procedure library + blueprint engine.
 *
 * Usage:
 *   npx tsx scripts/procedure-library-phase2-smoke.ts
 *   npx tsx scripts/procedure-library-phase2-smoke.ts --live
 */
import { createClient } from '@supabase/supabase-js'
import { createProcedure } from '../lib/procedure-library/create-procedure'
import { createBlueprintVersion } from '../lib/procedure-library/create-blueprint-version'
import { publishBlueprintVersion } from '../lib/procedure-library/publish-blueprint-version'
import { assignBlueprintToStudy } from '../lib/procedure-library/assign-blueprint-to-study'
import {
  buildFieldSchemaFromBlueprint,
  buildMinimalBlueprint,
} from '../lib/procedure-library/procedure-types'

const LIVE = process.argv.includes('--live')

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message)
}

function runUnitChecks() {
  console.log('--- Phase 2 unit checks ---')
  const blueprint = buildMinimalBlueprint('vitals', 'Vital Signs', [
    { field_id: 'systolic_bp', type: 'vital_sign', required: true },
  ])
  assert(blueprint.sections.length === 1, 'Blueprint sections')
  assert(buildFieldSchemaFromBlueprint(blueprint).fields.length === 1, 'Field schema builder')
  console.log('✅ Blueprint model helpers')
}

async function runLiveChecks() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    console.log('⏭️  Skipping live checks (Supabase env not set)')
    return
  }

  const orgId = process.env.PROCEDURE_LIB_SMOKE_ORG_ID ?? process.env.DOC_INTAKE_SMOKE_ORG_ID
  const studyId = process.env.PROCEDURE_LIB_SMOKE_STUDY_ID ?? process.env.DOC_INTAKE_SMOKE_STUDY_ID
  const actorId =
    process.env.PROCEDURE_LIB_SMOKE_ACTOR_ID
    ?? process.env.DOC_INTAKE_SMOKE_ACTOR_ID
    ?? '00000000-0000-4000-8000-000000000900'

  if (!orgId || !studyId) {
    console.log('⏭️  Set PROCEDURE_LIB_SMOKE_ORG_ID and PROCEDURE_LIB_SMOKE_STUDY_ID for live checks')
    return
  }

  console.log('--- Phase 2 live integration ---')
  const supabase = createClient(url, key)

  const procedure = await createProcedure({
    supabase,
    createdBy: actorId,
    input: {
      library_scope: 'organization',
      organization_id: orgId,
      procedure_code: `SMOKE_${Date.now()}`,
      procedure_name: 'Smoke Test Procedure',
      procedure_category: 'assessment',
      operational_description: 'Phase 2 smoke procedure',
    },
  })
  console.log('✅ Created reusable procedure')

  const dependencySchema = {
    rules: [
      {
        if: { field: 'completed', equals: 'no' },
        then: { show_warning: 'Follow up with coordinator' },
      },
    ],
  }

  const blueprint = buildMinimalBlueprint('main', 'Smoke Test', [
    { field_id: 'completed', type: 'yes_no', required: true },
  ])

  const version1 = await createBlueprintVersion({
    supabase,
    procedureId: procedure.id,
    createdBy: actorId,
    input: {
      blueprint_json: blueprint,
      field_schema: buildFieldSchemaFromBlueprint(blueprint),
      dependency_schema: dependencySchema,
    },
  })
  assert(version1.versionNumber === 1, 'Version 1 created')
  console.log('✅ Created blueprint version')

  const published = await publishBlueprintVersion({
    supabase,
    procedureId: procedure.id,
    versionId: version1.id,
  })
  assert(published.procedure.activeVersionId === version1.id, 'active_version_id updated')
  console.log('✅ Published blueprint version')

  const blueprint2 = buildMinimalBlueprint('main', 'Smoke Test v2', [
    { field_id: 'completed', type: 'yes_no', required: true },
    { field_id: 'notes', type: 'textarea', required: false },
  ])
  const version2 = await createBlueprintVersion({
    supabase,
    procedureId: procedure.id,
    createdBy: actorId,
    input: {
      blueprint_json: blueprint2,
      field_schema: buildFieldSchemaFromBlueprint(blueprint2),
      dependency_schema: dependencySchema,
    },
  })
  assert(version2.versionNumber === 2, 'Version 2 created')

  const originalJson = version1.blueprintJson
  const { error: mutateError } = await supabase
    .from('procedure_blueprint_versions')
    .update({
      blueprint_json: { sections: [{ section_id: 'hack', title: 'Hack', fields: [] }] },
    })
    .eq('id', version1.id)
  assert(Boolean(mutateError), 'In-place blueprint mutation must be blocked')
  console.log('✅ Immutable version content enforced')

  const { data: reloadedV1 } = await supabase
    .from('procedure_blueprint_versions')
    .select('blueprint_json, dependency_schema')
    .eq('id', version1.id)
    .single()
  assert(
    JSON.stringify(reloadedV1?.blueprint_json) === JSON.stringify(originalJson),
    'Blueprint JSON unchanged after mutation attempt',
  )
  assert(
    JSON.stringify(reloadedV1?.dependency_schema) === JSON.stringify(dependencySchema),
    'dependency_schema preserved',
  )
  console.log('✅ dependency_schema preserved')

  await publishBlueprintVersion({
    supabase,
    procedureId: procedure.id,
    versionId: version2.id,
  })

  const assignment = await assignBlueprintToStudy({
    supabase,
    createdBy: actorId,
    input: {
      organization_id: orgId,
      study_id: studyId,
      procedure_id: procedure.id,
      blueprint_version_id: version1.id,
      visit_code: 'V1',
    },
  })
  assert(assignment.blueprintVersionId === version1.id, 'Study assignment pins exact version')
  console.log('✅ Assigned blueprint version to study')

  const { data: archivedV2 } = await supabase
    .from('procedure_blueprint_versions')
    .select('blueprint_status')
    .eq('id', version2.id)
    .single()
  assert(archivedV2?.blueprint_status === 'published', 'Latest published version remains published')

  const { data: activeProcedure } = await supabase
    .from('procedure_library')
    .select('active_version_id')
    .eq('id', procedure.id)
    .single()
  assert(activeProcedure?.active_version_id === version2.id, 'active_version_id points to v2')
  console.log('✅ active_version_id tracks latest publish')
}

async function main() {
  runUnitChecks()
  if (LIVE) {
    await runLiveChecks()
  } else {
    console.log('Tip: run with --live and PROCEDURE_LIB_SMOKE_* env vars for DB integration')
  }
  console.log('------------------------------------------------------------')
  console.log('Phase 2 procedure library smoke test passed.')
}

main().catch((err) => {
  console.error('Smoke test failed:', err)
  process.exit(1)
})
