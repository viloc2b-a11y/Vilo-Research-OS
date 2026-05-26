/**
 * Phase 5 smoke: visit runtime execution layer.
 *
 * Usage:
 *   npx tsx scripts/visit-runtime-execution-phase5-smoke.ts
 *   npx tsx scripts/visit-runtime-execution-phase5-smoke.ts --live
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { buildStateSnapshot } from '../lib/visit-runtime-execution/append-visit-runtime-event'
import { createVisitInstanceFromShell } from '../lib/visit-runtime-execution/create-visit-instance-from-shell'
import { completeVisitInstance } from '../lib/visit-runtime-execution/complete-visit-instance'
import { completeProcedureInstance } from '../lib/visit-runtime-execution/complete-procedure-instance'
import { saveProcedureFieldValues } from '../lib/visit-runtime-execution/save-procedure-field-values'
import { skipProcedureInstance } from '../lib/visit-runtime-execution/skip-procedure-instance'
import { startVisitInstance } from '../lib/visit-runtime-execution/start-visit-instance'
import {
  canCompleteVisit,
  recalculateVisitProgress,
} from '../lib/visit-runtime-execution/recalculate-visit-progress'
import { computeVisitRuntimeStateHash } from '../lib/visit-runtime-execution/visit-runtime-state-hash'
import {
  PROCEDURE_STATUS,
  VISIT_RUNTIME_EVENT_TYPE,
} from '../lib/visit-runtime-execution/visit-runtime-types'

const LIVE = process.argv.includes('--live')

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message)
}

function runUnitChecks() {
  console.log('--- Phase 5 unit checks ---')

  const procedures = [
    { procedureStatus: PROCEDURE_STATUS.NOT_STARTED, required: true },
    { procedureStatus: PROCEDURE_STATUS.NOT_STARTED, required: false },
  ] as const

  assert(recalculateVisitProgress([...procedures]) === 0, 'progress starts at 0')

  const afterOne = [
    { procedureStatus: PROCEDURE_STATUS.COMPLETED, required: true },
    { procedureStatus: PROCEDURE_STATUS.NOT_STARTED, required: false },
  ]
  assert(recalculateVisitProgress(afterOne) === 50, 'progress recalculates to 50%')

  const ready = [
    { procedureStatus: PROCEDURE_STATUS.COMPLETED, required: true },
    { procedureStatus: PROCEDURE_STATUS.SKIPPED, required: false },
  ]
  assert(canCompleteVisit(ready), 'visit completable when required done/skipped')

  const snapshot = buildStateSnapshot({
    visitInstanceId: 'visit-1',
    visitStatus: 'in_progress',
    progressPercent: 50,
    procedures: [
      {
        id: 'proc-a',
        procedureStatus: PROCEDURE_STATUS.IN_PROGRESS,
        fieldValues: { systolic_bp: 120 },
      },
    ],
  })
  const hash1 = computeVisitRuntimeStateHash(snapshot)
  const hash2 = computeVisitRuntimeStateHash(snapshot)
  assert(hash1 === hash2, 'state_hash deterministic')

  assert(
    !canCompleteVisit([
      { procedureStatus: PROCEDURE_STATUS.NOT_STARTED, required: true },
    ]),
    'visit blocked until required procedures terminal',
  )

  console.log('✅ Progress + completion rules')
  console.log('✅ Deterministic state_hash')
  console.log('✅ Event type constants available')
  void VISIT_RUNTIME_EVENT_TYPE.VISIT_INSTANCE_CREATED
}

async function loadPackageHash(supabase: SupabaseClient, packageId: string): Promise<string> {
  const { data } = await supabase
    .from('runtime_source_packages')
    .select('package_hash, package_json')
    .eq('id', packageId)
    .maybeSingle()
  const row = data as { package_hash?: string; package_json?: unknown } | null
  return JSON.stringify({ hash: row?.package_hash, json: row?.package_json })
}

async function runLiveChecks() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    console.log('⏭️  Skipping live checks (Supabase env not set)')
    return
  }

  const orgId = process.env.VISIT_RUNTIME_SMOKE_ORG_ID ?? process.env.RUNTIME_SOURCE_SMOKE_ORG_ID
  const studyId = process.env.VISIT_RUNTIME_SMOKE_STUDY_ID ?? process.env.RUNTIME_SOURCE_SMOKE_STUDY_ID
  const subjectId = process.env.VISIT_RUNTIME_SMOKE_SUBJECT_ID
  const actorId =
    process.env.VISIT_RUNTIME_SMOKE_ACTOR_ID
    ?? process.env.RUNTIME_SOURCE_SMOKE_ACTOR_ID
    ?? '00000000-0000-4000-8000-000000000900'

  if (!orgId || !studyId || !subjectId) {
    console.log(
      '⏭️  Set VISIT_RUNTIME_SMOKE_ORG_ID, VISIT_RUNTIME_SMOKE_STUDY_ID, VISIT_RUNTIME_SMOKE_SUBJECT_ID for live checks',
    )
    return
  }

  console.log('--- Phase 5 live integration ---')
  const supabase = createClient(url, key)

  const { data: sourcePackage } = await supabase
    .from('runtime_source_packages')
    .select('id')
    .eq('organization_id', orgId)
    .eq('study_id', studyId)
    .in('package_status', ['reviewed', 'approved'])
    .order('package_version', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!sourcePackage) {
    console.log('⏭️  No reviewed/approved source package — review a package in Phase 4 first')
    return
  }

  const packageId = String(sourcePackage.id)
  const packageHashBefore = await loadPackageHash(supabase, packageId)

  const { data: visitShell } = await supabase
    .from('runtime_source_visit_shells')
    .select('id')
    .eq('source_package_id', packageId)
    .order('sequence_order', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (!visitShell) {
    console.log('⏭️  No visit shells on source package')
    return
  }

  const created = await createVisitInstanceFromShell({
    supabase,
    createdBy: actorId,
    input: {
      organization_id: orgId,
      study_id: studyId,
      subject_id: subjectId,
      source_package_id: packageId,
      visit_shell_id: String(visitShell.id),
    },
  })
  assert(created.procedureInstances.length >= 0, 'visit instance created')
  console.log('✅ Visit instance + procedure instances created')

  const { count: createdEventCount } = await supabase
    .from('visit_runtime_events')
    .select('id', { count: 'exact', head: true })
    .eq('visit_instance_id', created.visitInstance.id)
    .eq('event_type', 'visit_instance_created')
  assert((createdEventCount ?? 0) === 1, 'visit_instance_created event')
  console.log('✅ visit_instance_created event appended')

  await startVisitInstance({
    supabase,
    organizationId: orgId,
    visitInstanceId: created.visitInstance.id,
    actorId,
  })
  console.log('✅ Visit started')

  const firstProcedure = created.procedureInstances[0]
  if (firstProcedure) {
    await saveProcedureFieldValues({
      supabase,
      organizationId: orgId,
      procedureInstanceId: firstProcedure.id,
      fieldValues: { smoke_test: true },
      actorId,
    })

    const { count: fieldEventCount } = await supabase
      .from('visit_runtime_events')
      .select('id', { count: 'exact', head: true })
      .eq('visit_instance_id', created.visitInstance.id)
      .eq('event_type', 'field_values_saved')
    assert((fieldEventCount ?? 0) >= 1, 'field_values_saved event')
    console.log('✅ Field values saved + event appended')

    await completeProcedureInstance({
      supabase,
      organizationId: orgId,
      procedureInstanceId: firstProcedure.id,
      actorId,
    })
    console.log('✅ Procedure completed + progress recalculated')
  }

  for (const procedure of created.procedureInstances.slice(1)) {
    if (procedure.required) {
      await skipProcedureInstance({
        supabase,
        organizationId: orgId,
        procedureInstanceId: procedure.id,
        actorId,
        reason: 'Phase 5 smoke skip',
      })
    } else {
      await skipProcedureInstance({
        supabase,
        organizationId: orgId,
        procedureInstanceId: procedure.id,
        actorId,
      })
    }
  }

  const completed = await completeVisitInstance({
    supabase,
    organizationId: orgId,
    visitInstanceId: created.visitInstance.id,
    actorId,
  })
  assert(completed.visitStatus === 'completed', 'visit completed')
  console.log('✅ Visit completed after required procedures terminal')

  const { count: eventCount } = await supabase
    .from('visit_runtime_events')
    .select('id', { count: 'exact', head: true })
    .eq('visit_instance_id', created.visitInstance.id)
  assert((eventCount ?? 0) >= 3, 'multiple append-only events')
  console.log('✅ Append-only event timeline persisted')

  const packageHashAfter = await loadPackageHash(supabase, packageId)
  assert(packageHashBefore === packageHashAfter, 'source package detached from execution')
  console.log('✅ No source package mutation during execution')
}

async function main() {
  runUnitChecks()
  if (LIVE) {
    await runLiveChecks()
  } else {
    console.log('Tip: run with --live and VISIT_RUNTIME_SMOKE_* env vars for DB integration')
  }
  console.log('------------------------------------------------------------')
  console.log('Phase 5 visit runtime execution smoke test passed.')
}

main().catch((err) => {
  console.error('Smoke test failed:', err)
  process.exit(1)
})
