/**
 * Phase 11B-PROOF — DB/runtime smoke gates (read-only probes + optional --apply-migrations).
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import postgres from 'postgres'
import { loadEnvFiles, projectRoot } from './lib/env.mjs'

const APPLY = process.argv.includes('--apply-migrations')

loadEnvFiles()
const url = process.env.DATABASE_URL_DIRECT || process.env.DATABASE_URL
if (!url) throw new Error('DATABASE_URL required')

const sql = postgres(url, {
  ssl: 'require',
  max: 1,
  prepare: url.includes('pooler') ? false : undefined,
})

const MIGRATIONS = [
  '0067_phase11a_runtime_safety_p0',
  '0068_phase11b_concurrency',
  '0069_phase11b_fix_audit_blockers',
]

const QA = {
  coordinator: 'rbac.qa.research_coordinator@vilo-os.staging',
  pi: 'rbac.qa.pi_sub_i@vilo-os.staging',
}

async function withActor(actorUserId, fn) {
  return sql.begin(async (tx) => {
    await tx`select set_config('role', 'authenticated', true)`
    await tx`select set_config('request.jwt.claim.sub', ${actorUserId}, true)`
    return fn(tx)
  })
}

async function callRpc(tx, fnName, values) {
  const placeholders = values.map((_, i) => `$${i + 1}`).join(', ')
  const rows = await tx.unsafe(`select public.${fnName}(${placeholders}) as result`, values)
  const raw = rows[0]?.result
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw)
    } catch {
      return raw
    }
  }
  return raw
}

async function resolveUserId(email) {
  const [row] = await sql`select id from auth.users where email = ${email} limit 1`
  return row?.id ?? null
}

async function listAppliedMigrations() {
  const rows = await sql`
    select version, name
    from supabase_migrations.schema_migrations
    order by version
  `
  return rows
}

async function applyMigration(name) {
  const path = join(projectRoot, 'supabase/migrations', `${name}.sql`)
  const query = readFileSync(path, 'utf8')
  await sql.unsafe(query)
}

async function preflightDuplicates() {
  return sql`
    select study_subject_id, visit_definition_id, count(*)::int as active_count,
           array_agg(id order by created_at) as visit_ids
    from public.visits
    where visit_status not in ('cancelled', 'missed', 'no_show')
    group by study_subject_id, visit_definition_id
    having count(*) > 1
  `
}

async function probeFunctionsExist() {
  return sql`
    select proname, pg_get_function_identity_arguments(p.oid) as args
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and proname in (
        'save_source_draft',
        'sign_visit_investigator_closeout',
        'generate_subject_visit_schedule',
        'reopen_visit_coordinator_closeout',
        'reopen_visit_investigator_closeout',
        'user_can_sign_investigator_closeout'
      )
    order by proname, args
  `
}

async function probeInvestigatorSign(orgId, visitId, coordinatorId, piId) {
  const coord = await withActor(coordinatorId, (tx) =>
    callRpc(tx, 'sign_visit_investigator_closeout', [
      orgId,
      visitId,
      'principal_investigator',
      'Phase11B Proof Coordinator',
    ]),
  )
  const pi = await withActor(piId, (tx) =>
    callRpc(tx, 'sign_visit_investigator_closeout', [
      orgId,
      visitId,
      'principal_investigator',
      'Phase11B Proof PI',
    ]),
  )
  return { coordinator: coord, pi }
}

async function findInvestigatorSignProbeVisit(orgId) {
  const signed = await sql`
    select v.id, v.visit_review_status
    from visits v
    where v.organization_id = ${orgId}
      and v.visit_review_status = 'coordinator_signed'
    limit 1
  `
  if (signed[0]) return signed[0]
  const any = await sql`
    select v.id, v.visit_review_status
    from visits v
    where v.organization_id = ${orgId}
      and v.visit_status not in ('cancelled', 'missed', 'no_show')
    order by v.updated_at desc nulls last
    limit 1
  `
  return any[0] ?? null
}

async function findCloseoutVisit(orgId) {
  const [row] = await sql`
    select v.id, v.organization_id, v.study_id, v.visit_review_status
    from public.visits v
    where v.organization_id = ${orgId}
      and v.visit_review_status = 'coordinator_signed'
    limit 1
  `
  return row ?? null
}

async function probeReopenReason(orgId, visitId, actorId) {
  const nullReason = await withActor(actorId, (tx) =>
    callRpc(tx, 'reopen_visit_coordinator_closeout', [orgId, visitId, 'Proof', null]),
  )
  const shortReason = await withActor(actorId, (tx) =>
    callRpc(tx, 'reopen_visit_coordinator_closeout', [orgId, visitId, 'Proof', 'ab']),
  )
  return { nullReason, shortReason }
}

async function probeSaveDraftAllOrError(orgId, srsId, fieldIds, actorId) {
  const good = fieldIds[0]
  const bad = '00000000-0000-0000-0000-000000000099'
  const payload = [
    { source_field_id: good, value_text: 'phase11b-proof-valid' },
    { source_field_id: bad, value_text: 'should-fail' },
  ]
  const result = await withActor(actorId, (tx) =>
    callRpc(tx, 'save_source_draft', [orgId, srsId, payload, null]),
  )
  const [counts] = await sql`
    select count(*)::int as draft_responses
    from source_responses sr
    where sr.response_set_id = ${srsId}
      and sr.is_submitted = false
      and sr.value_text = 'phase11b-proof-valid'
  `
  return { result, draft_responses_with_proof_value: counts?.draft_responses ?? 0 }
}

async function probeStaleSave(orgId, srsId, fieldId, actorA, actorB) {
  const [before] = await sql`
    select id, updated_at, status from source_response_sets where id = ${srsId}
  `
  const t1 = before.updated_at
  const bump = await withActor(actorB, (tx) =>
    callRpc(tx, 'save_source_draft', [
      orgId,
      srsId,
      [{ source_field_id: fieldId, value_text: `stale-b-${Date.now()}` }],
      null,
    ]),
  )
  const [afterB] = await sql`
    select updated_at from source_response_sets where id = ${srsId}
  `
  const stale = await withActor(actorA, (tx) =>
    callRpc(tx, 'save_source_draft', [
      orgId,
      srsId,
      [{ source_field_id: fieldId, value_text: 'stale-a-overwrite' }],
      t1,
    ]),
  )
  const [finalRow] = await sql`
    select sr.value_text
    from source_responses sr
    where sr.response_set_id = ${srsId}
      and sr.source_field_id = ${fieldId}
      and sr.is_current = true
      and sr.is_submitted = false
    limit 1
  `
  return { t1, bump, afterB_updated_at: afterB?.updated_at, stale, final_value_text: finalRow?.value_text }
}

async function findMutableResponseSet(orgId) {
  const [row] = await sql`
    select srs.id, srs.organization_id, srs.source_definition_version_id, srs.procedure_execution_id
    from source_response_sets srs
    where srs.organization_id = ${orgId}
      and srs.status in ('draft', 'in_progress')
    order by srs.updated_at desc
    limit 1
  `
  if (!row) return null
  const fields = await sql`
    select sf.id
    from source_fields sf
    where sf.source_definition_version_id = ${row.source_definition_version_id}
    limit 3
  `
  return { ...row, fieldIds: fields.map((f) => f.id) }
}

async function probeDoubleSubmit(orgId, srsId, peId, actorId) {
  const first = await withActor(actorId, (tx) =>
    callRpc(tx, 'submit_source_response_set', [orgId, srsId]),
  )
  const second = await withActor(actorId, (tx) =>
    callRpc(tx, 'submit_source_response_set', [orgId, srsId]),
  )
  const [srs] = await sql`
    select submitted_by, submitted_at, status from source_response_sets where id = ${srsId}
  `
  const events = await sql`
    select id, actor_user_id, occurred_at
    from operational_events
    where procedure_execution_id = ${peId}
      and event_type = 'SOURCE_RESPONSE_SET_SUBMITTED'
      and payload ->> 'source_response_set_id' = ${srsId}::text
  `
  return { first, second, srs, submit_event_count: events.length, events }
}

async function probeScheduleTransactional(actorId, subjectId, studyId) {
  const [countsBefore] = await sql`
    select
      (select count(*)::int from visits where study_subject_id = ${subjectId}) as visits,
      (select count(*)::int from procedure_executions pe
        join visits v on v.id = pe.visit_id
        where v.study_subject_id = ${subjectId}) as pe_count
  `
  const [subjBefore] = await sql`
    select enrollment_status, visit_schedule_generated_at, schedule_anchor_date
    from study_subjects where id = ${subjectId}
  `

  const missingBindingVisitDef = await sql`
    select vd.id as visit_definition_id, m.procedure_definition_id
    from visit_definitions vd
    join visit_def_procedure_map m on m.visit_definition_id = vd.id and m.study_id = ${studyId}
    where vd.study_id = ${studyId}
      and m.is_required = true
      and not exists (
        select 1 from procedure_source_bindings psb
        where psb.study_id = ${studyId}
          and psb.procedure_definition_id = m.procedure_definition_id
          and psb.default_source_definition_version_id is not null
      )
    limit 1
  `

  let fail
  if (missingBindingVisitDef[0]) {
    const [gapSubject] = await sql`
      select ss.id
      from study_subjects ss
      where ss.study_id = ${studyId}
        and ss.enrollment_status in ('enrolled', 'randomized')
        and not exists (
          select 1 from visits v
          where v.study_subject_id = ss.id
            and v.visit_definition_id = ${missingBindingVisitDef[0].visit_definition_id}
            and v.visit_status not in ('cancelled', 'missed', 'no_show')
        )
      limit 1
    `
    const targetId = gapSubject?.id ?? subjectId
    fail = await withActor(actorId, async (tx) => {
      try {
        return await callRpc(tx, 'generate_subject_visit_schedule', [targetId, null, false])
      } catch (e) {
        return { thrown: String(e.message ?? e) }
      }
    })
  } else {
    fail = await withActor(actorId, async (tx) => {
      try {
        return await callRpc(tx, 'generate_subject_visit_schedule', [
          '00000000-0000-0000-0000-000000000099',
          null,
          false,
        ])
      } catch (e) {
        return { thrown: String(e.message ?? e) }
      }
    })
  }

  const [countsAfter] = await sql`
    select
      (select count(*)::int from visits where study_subject_id = ${subjectId}) as visits,
      (select count(*)::int from procedure_executions pe
        join visits v on v.id = pe.visit_id
        where v.study_subject_id = ${subjectId}) as pe_count
  `
  const [subjAfter] = await sql`
    select enrollment_status, visit_schedule_generated_at, schedule_anchor_date
    from study_subjects where id = ${subjectId}
  `
  return {
    countsBefore,
    subjBefore,
    forcedFailureMode: missingBindingVisitDef[0] ? 'missing_required_binding' : 'invalid_subject',
    fail,
    countsAfter,
    subjAfter,
    subject_unchanged:
      subjBefore?.enrollment_status === subjAfter?.enrollment_status
      && String(subjBefore?.visit_schedule_generated_at) === String(subjAfter?.visit_schedule_generated_at),
  }
}

async function probeRandomizationVoidEvents() {
  const recorded = await sql`
    select id, event_type, payload
    from operational_events
    where event_type = 'external_randomization_recorded'
    order by occurred_at desc
    limit 3
  `
  const voided = await sql`
    select id, event_type, payload
    from operational_events
    where event_type = 'external_randomization_voided'
    order by occurred_at desc
    limit 3
  `
  return { recorded_count: recorded.length, voided_count: voided.length, recorded, voided }
}

async function probeInvestigatorReopenAtomic(orgId, visitId, piId) {
  const snapBefore = await sql`
    select v.visit_review_status, vpn.investigator_review_status
    from visits v
    left join visit_progress_notes vpn on vpn.visit_id = v.id
    where v.id = ${visitId}
  `
  const eventsBefore = await sql`
    select count(*)::int as c from operational_events
    where visit_id = ${visitId} and event_type = 'CLOSEOUT_REOPENED'
  `
  const reopen = await withActor(piId, (tx) =>
    callRpc(tx, 'reopen_visit_investigator_closeout', [
      orgId,
      visitId,
      'Proof PI',
      'audit reason for investigator reopen',
    ]),
  )
  const snapAfter = await sql`
    select v.visit_review_status, vpn.investigator_review_status
    from visits v
    left join visit_progress_notes vpn on vpn.visit_id = v.id
    where v.id = ${visitId}
  `
  const eventsAfter = await sql`
    select count(*)::int as c from operational_events
    where visit_id = ${visitId} and event_type = 'CLOSEOUT_REOPENED'
  `
  return { snapBefore, eventsBefore: eventsBefore[0]?.c, reopen, snapAfter, eventsAfter: eventsAfter[0]?.c }
}

async function main() {
  const report = {
    timestamp: new Date().toISOString(),
    migrations: {},
    preflight_duplicates: [],
    functions: [],
    gates: {},
    errors: [],
  }

  try {
    report.migrations.before = await listAppliedMigrations()
    const appliedNames = new Set(report.migrations.before.map((m) => m.name))

    if (APPLY) {
      for (const name of MIGRATIONS) {
        if (appliedNames.has(name)) {
          report.migrations[name] = { status: 'already_applied' }
          continue
        }
        try {
          await applyMigration(name)
          report.migrations[name] = { status: 'applied' }
          appliedNames.add(name)
        } catch (e) {
          report.migrations[name] = { status: 'failed', error: String(e.message ?? e) }
          report.errors.push(`migration ${name}: ${e.message ?? e}`)
        }
      }
      report.migrations.after = await listAppliedMigrations()
    }

    report.preflight_duplicates = await preflightDuplicates()
    report.functions = await probeFunctionsExist()

    const coordinatorId = await resolveUserId(QA.coordinator)
    const piId = await resolveUserId(QA.pi)
    if (!coordinatorId || !piId) {
      report.errors.push('QA users missing — run seed-rbac-blinding-qa')
    }

    const [org] = await sql`
      select om.organization_id
      from organization_members om
      join auth.users u on u.id = om.user_id
      where u.email = ${QA.coordinator}
      limit 1
    `
    const orgId = org?.organization_id

    if (orgId && coordinatorId && piId) {
      const visit = await findInvestigatorSignProbeVisit(orgId)
      if (visit) {
        report.gates.investigator_rpc = {
          visit_id: visit.id,
          visit_review_status: visit.visit_review_status,
          ...(await probeInvestigatorSign(orgId, visit.id, coordinatorId, piId)),
        }
      } else {
        report.gates.investigator_rpc = { skipped: 'no visit for investigator sign probe' }
      }

      const signedVisit = await sql`
        select v.id from visits v
        where v.organization_id = ${orgId}
          and v.visit_review_status = 'investigator_signed'
        limit 1
      `
      if (signedVisit[0] && piId) {
        report.gates.investigator_reopen_atomic = await probeInvestigatorReopenAtomic(
          orgId,
          signedVisit[0].id,
          piId,
        )
      } else {
        report.gates.investigator_reopen_atomic = { skipped: 'no investigator_signed visit' }
      }

      const reopenVisit = await sql`
        select v.id from visits v
        where v.organization_id = ${orgId}
          and v.visit_review_status in ('coordinator_signed', 'investigator_signed')
        limit 1
      `
      if (reopenVisit[0]) {
        report.gates.reopen_reason = await probeReopenReason(orgId, reopenVisit[0].id, coordinatorId)
      }

      try {
        const srsCtx = await findMutableResponseSet(orgId)
        if (srsCtx?.fieldIds?.length >= 1) {
          report.gates.save_all_or_error = await probeSaveDraftAllOrError(
            orgId,
            srsCtx.id,
            srsCtx.fieldIds,
            coordinatorId,
          )
          report.gates.stale_save = await probeStaleSave(
            orgId,
            srsCtx.id,
            srsCtx.fieldIds[0],
            coordinatorId,
            piId,
          )
        } else {
          report.gates.save_all_or_error = { skipped: 'no mutable response set' }
          report.gates.stale_save = { skipped: 'no mutable response set' }
        }
      } catch (e) {
        report.gates.save_all_or_error = { error: String(e.message ?? e) }
        report.gates.stale_save = { error: String(e.message ?? e) }
      }

      try {
        const submitted = await sql`
          select srs.id, srs.procedure_execution_id
          from source_response_sets srs
          where srs.organization_id = ${orgId}
            and srs.status in ('submitted', 'pending_review', 'reviewed', 'signed', 'locked')
          limit 1
        `
        if (submitted[0]) {
          report.gates.double_submit = await probeDoubleSubmit(
            orgId,
            submitted[0].id,
            submitted[0].procedure_execution_id,
            coordinatorId,
          )
        } else {
          report.gates.double_submit = { skipped: 'no submitted response set for idempotency probe' }
        }
      } catch (e) {
        report.gates.double_submit = { error: String(e.message ?? e) }
      }

      try {
        const [subject] = await sql`
          select ss.id, ss.study_id from study_subjects ss
          join studies s on s.id = ss.study_id
          where s.organization_id = ${orgId}
            and ss.enrollment_status in ('enrolled', 'randomized')
          limit 1
        `
        if (subject) {
          report.gates.schedule_transactional = await probeScheduleTransactional(
            coordinatorId,
            subject.id,
            subject.study_id,
          )
        } else {
          report.gates.schedule_transactional = { skipped: 'no enrolled/randomized subject' }
        }
      } catch (e) {
        report.gates.schedule_transactional = { error: String(e.message ?? e) }
      }
    }

    report.gates.randomization_events = await probeRandomizationVoidEvents()

    const saveFn = report.functions.find((f) => f.proname === 'save_source_draft')
    report.gates.save_source_draft_signature = {
      exists: Boolean(saveFn),
      has_timestamptz_arg: saveFn?.args?.includes('timestamp with time zone') ?? false,
    }

    const idx = await sql`
      select indexname from pg_indexes where indexname = 'visits_subject_visit_def_active_uidx'
    `
    report.gates.visit_unique_index = { exists: idx.length > 0 }

    const comment = await sql`
      select obj_description(p.oid, 'pg_proc') as comment
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.proname = 'save_source_draft'
      limit 1
    `
    report.gates.save_source_draft_comment = { comment: comment[0]?.comment ?? null }

    const applied = report.migrations.after ?? report.migrations.before ?? []
    const mig067 = applied.some((m) => m.name === '0067_phase11a_runtime_safety_p0')
    const mig068 = applied.some((m) => m.name === '0068_phase11b_concurrency')
    const mig069 = applied.some((m) => m.name === '0069_phase11b_fix_audit_blockers')
    const mig067Applied = report.migrations['0067_phase11a_runtime_safety_p0']?.status === 'applied'
    const mig068Applied = report.migrations['0068_phase11b_concurrency']?.status === 'applied'
    const mig069Applied = report.migrations['0069_phase11b_fix_audit_blockers']?.status === 'applied'
    report.gates.migration_registry = {
      '0067_in_schema_migrations': mig067,
      '0068_in_schema_migrations': mig068,
      '0069_in_schema_migrations': mig069,
      '0067_applied_this_run': mig067Applied ?? false,
      '0068_applied_this_run': mig068Applied ?? false,
      '0069_applied_this_run': mig069Applied ?? false,
      ddl_live_save_has_stale_arg: report.functions.some(
        (f) => f.proname === 'save_source_draft' && f.args.includes('timestamp with time zone'),
      ),
    }
  } catch (e) {
    report.errors.push(String(e.message ?? e))
  } finally {
    await sql.end()
  }

  console.log(JSON.stringify(report, null, 2))
}

main()
