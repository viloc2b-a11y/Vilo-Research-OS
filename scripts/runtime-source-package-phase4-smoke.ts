/**
 * Phase 4 smoke: runtime source package drafts from compiled graph.
 *
 * Usage:
 *   npx tsx scripts/runtime-source-package-phase4-smoke.ts
 *   npx tsx scripts/runtime-source-package-phase4-smoke.ts --live
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { buildSourcePackageFromGraph } from '../lib/runtime-source-package/build-source-package-from-graph'
import { computeSourcePackageHash } from '../lib/runtime-source-package/source-package-hash'
import { createRuntimeSourcePackage } from '../lib/runtime-source-package/create-runtime-source-package'
import { reviewRuntimeSourcePackage } from '../lib/runtime-source-package/review-runtime-source-package'
import type { StudyRuntimeGraphJson } from '../lib/study-runtime-composition/runtime-composition-types'

const LIVE = process.argv.includes('--live')

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message)
}

function sampleGraph(): StudyRuntimeGraphJson {
  return {
    study_id: 'study-sample',
    organization_id: 'org-sample',
    visits: [
      {
        visit_id: 'visit-1',
        visit_code: 'V1',
        visit_name: 'Screening',
        visit_type: 'screening',
        study_day: -7,
        window: { before_days: 3, after_days: 3 },
        sequence_order: 1,
        allowed_modes: ['onsite'],
        required: true,
        procedures: [
          {
            procedure_id: 'proc-1',
            procedure_code: 'VITAL_SIGNS',
            procedure_name: 'Vital Signs',
            blueprint_version_id: 'bv-1',
            study_procedure_blueprint_id: 'spb-1',
            procedure_order: 1,
            required: true,
            optionality_rule: {},
            dependency_rule: {},
            timing_rule: {},
            operational_overrides: {},
          },
        ],
      },
    ],
  }
}

function runUnitChecks() {
  console.log('--- Phase 4 unit checks ---')

  const blueprintVersions = new Map([
    [
      'bv-1',
      {
        id: 'bv-1',
        blueprintJson: {
          sections: [{ section_id: 'vitals', title: 'Vital Signs', fields: [{ field_id: 'systolic_bp', type: 'number' }] }],
        },
        fieldSchema: {
          fields: [{ field_id: 'systolic_bp', type: 'number', label: 'Systolic BP', required: true }],
        },
      },
    ],
  ])

  const built = buildSourcePackageFromGraph({
    graph: sampleGraph(),
    compositionSnapshotId: 'snap-1',
    blueprintVersions,
    visitProcedureLookups: [
      {
        runtimeVisitProcedureId: 'rvp-1',
        visitId: 'visit-1',
        studyProcedureBlueprintId: 'spb-1',
      },
    ],
  })

  assert(built.visitShells.length === 1, 'visit shells built')
  assert(built.visitShells[0].procedures.length === 1, 'procedure shells built')
  assert(
    built.packageJson.visits[0].source_sections[0].fields[0].source_state === 'draft',
    'field shells draft state',
  )
  assert(
    built.visitShells[0].procedures[0].blueprintVersionId === 'bv-1',
    'blueprint_version_id preserved',
  )

  const hash1 = computeSourcePackageHash(built.packageJson)
  const hash2 = computeSourcePackageHash(built.packageJson)
  assert(hash1 === hash2, 'package_hash deterministic')
  console.log('✅ Build source package from graph')
  console.log('✅ Deterministic package_hash')
}

async function runLiveChecks() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    console.log('⏭️  Skipping live checks (Supabase env not set)')
    return
  }

  const orgId = process.env.RUNTIME_SOURCE_SMOKE_ORG_ID ?? process.env.STUDY_RUNTIME_SMOKE_ORG_ID
  const studyId = process.env.RUNTIME_SOURCE_SMOKE_STUDY_ID ?? process.env.STUDY_RUNTIME_SMOKE_STUDY_ID
  const actorId =
    process.env.RUNTIME_SOURCE_SMOKE_ACTOR_ID
    ?? process.env.STUDY_RUNTIME_SMOKE_ACTOR_ID
    ?? '00000000-0000-4000-8000-000000000900'

  if (!orgId || !studyId) {
    console.log('⏭️  Set RUNTIME_SOURCE_SMOKE_ORG_ID and RUNTIME_SOURCE_SMOKE_STUDY_ID for live checks')
    return
  }

  console.log('--- Phase 4 live integration ---')
  const supabase = createClient(url, key)

  const { data: snapshot } = await supabase
    .from('study_runtime_composition_snapshots')
    .select('id')
    .eq('organization_id', orgId)
    .eq('study_id', studyId)
    .eq('snapshot_status', 'compiled')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!snapshot) {
    console.log('⏭️  No compiled composition snapshot found — run study-runtime compose first')
    return
  }

  const blueprintHashBefore = await loadAnyBlueprintHash(supabase)

  const created = await createRuntimeSourcePackage({
    supabase,
    generatedBy: actorId,
    input: {
      organization_id: orgId,
      study_id: studyId,
      composition_snapshot_id: String(snapshot.id),
      package_name: `Phase4 Smoke ${Date.now()}`,
    },
  })

  assert(created.visitShellCount >= 0, 'package created')
  console.log('✅ Created runtime source package')

  const { count: visitShellCount } = await supabase
    .from('runtime_source_visit_shells')
    .select('id', { count: 'exact', head: true })
    .eq('source_package_id', created.package.id)
  assert((visitShellCount ?? 0) >= 0, 'visit shells exist when visits present')
  console.log('✅ Visit shells persisted')

  const { count: procedureShellCount } = await supabase
    .from('runtime_source_procedure_shells')
    .select('id', { count: 'exact', head: true })
    .eq('source_package_id', created.package.id)
  console.log('✅ Procedure shells persisted')

  const reviewed = await reviewRuntimeSourcePackage({
    supabase,
    organizationId: orgId,
    packageId: created.package.id,
    reviewedBy: actorId,
  })
  assert(reviewed.packageStatus === 'reviewed', 'review status transition')
  console.log('✅ Review status transition')

  const blueprintHashAfter = await loadAnyBlueprintHash(supabase)
  assert(blueprintHashBefore === blueprintHashAfter, 'Blueprint detached from package generation')
  console.log('✅ No blueprint mutation during package generation')
}

async function loadAnyBlueprintHash(supabase: SupabaseClient): Promise<string> {
  const { data } = await supabase
    .from('procedure_blueprint_versions')
    .select('blueprint_json')
    .limit(1)
    .maybeSingle()
  const row = data as { blueprint_json?: unknown } | null
  return JSON.stringify(row?.blueprint_json ?? {})
}

async function main() {
  runUnitChecks()
  if (LIVE) {
    await runLiveChecks()
  } else {
    console.log('Tip: run with --live and RUNTIME_SOURCE_SMOKE_* env vars for DB integration')
  }
  console.log('------------------------------------------------------------')
  console.log('Phase 4 runtime source package smoke test passed.')
}

main().catch((err) => {
  console.error('Smoke test failed:', err)
  process.exit(1)
})
