/**
 * Phase 11B-CLOSE — runtime integrity proofs for remaining blockers.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import postgres from 'postgres'
import { loadEnvFiles, projectRoot } from './lib/env.mjs'

loadEnvFiles()
const url = process.env.DATABASE_URL_DIRECT || process.env.DATABASE_URL
const sql = postgres(url, {
  ssl: 'require',
  max: 1,
  prepare: url.includes('pooler') ? false : undefined,
})

const QA_COORD = 'rbac.qa.research_coordinator@vilo-os.staging'

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
  return rows[0]?.result
}

async function apply0070() {
  const path = join(projectRoot, 'supabase/migrations/0070_phase11b_save_all_or_error.sql')
  await sql.unsafe(readFileSync(path, 'utf8'))
  const exists = await sql`
    select 1 from supabase_migrations.schema_migrations where name = '0070_phase11b_save_all_or_error'
  `
  if (!exists.length) {
    await sql`
      insert into supabase_migrations.schema_migrations (version, name)
      values ('0070', '0070_phase11b_save_all_or_error')
    `
  }
}

async function probeAllOrError(coordId, orgId) {
  const [srs] = await sql`
    select srs.id, srs.organization_id, sf.id as field_id, sf.widget_hint
    from source_response_sets srs
    join procedure_executions pe on pe.id = srs.procedure_execution_id
    join source_fields sf on sf.source_definition_version_id = srs.source_definition_version_id
    where srs.organization_id = ${orgId}
      and srs.status in ('draft', 'in_progress')
      and srs.source_definition_version_id = pe.source_definition_version_id
    limit 1
  `
  if (!srs) return { skipped: 'no mutable response set' }

  const hint = String(srs.widget_hint ?? 'text').toLowerCase()
  const validItem =
    hint.includes('integer') || hint === 'number'
      ? { source_field_id: srs.field_id, value_number: 4242 }
      : { source_field_id: srs.field_id, value_text: 'phase11b-close-valid' }
  const marker =
    hint.includes('integer') || hint === 'number' ? '4242' : 'phase11b-close-valid'

  const [before] = await sql`
    select count(*)::int as c from source_responses
    where response_set_id = ${srs.id}
      and is_submitted = false
      and (
        value_text = ${marker}
        or value_number = ${hint.includes('integer') || hint === 'number' ? 4242 : -1}
      )
  `

  const result = await withActor(coordId, (tx) =>
    callRpc(tx, 'save_source_draft', [
      srs.organization_id,
      srs.id,
      [validItem, { source_field_id: '00000000-0000-0000-0000-000000000099', value_text: 'bad' }],
      null,
    ]),
  )

  const [after] = await sql`
    select count(*)::int as c from source_responses
    where response_set_id = ${srs.id}
      and is_submitted = false
      and (
        value_text = ${marker}
        or value_number = ${hint.includes('integer') || hint === 'number' ? 4242 : -1}
      )
  `

  return {
    result,
    persisted_delta: (after?.c ?? 0) - (before?.c ?? 0),
    pass:
      result?.ok === false
      && (result?.code === 'BATCH_SAVE_FAILED' || result?.code === 'PARTIAL_FAILURE')
      && result?.data?.saved_count === 0
      && (after?.c ?? 0) === (before?.c ?? 0),
  }
}

async function installScheduleFailureFixture(tx, studyId) {
  const [study] = await tx`select organization_id from studies where id = ${studyId}`
  if (!study) return null

  const [unboundProc] = await tx`
    select pd.id
    from procedure_definitions pd
    where pd.study_id = ${studyId}
      and not exists (
        select 1 from procedure_source_bindings psb
        where psb.study_id = ${studyId}
          and psb.procedure_definition_id = pd.id
          and psb.default_source_definition_version_id is not null
      )
    limit 1
  `
  if (!unboundProc) return null

  const [vd] = await tx`
    insert into visit_definitions (
      organization_id, study_id, code, label, sort_order, target_day,
      window_min_offset, window_max_offset
    ) values (
      ${study.organization_id},
      ${studyId},
      'P11B_FAIL',
      'Phase11B Failure Probe',
      9999,
      99,
      -1,
      2
    )
    returning id
  `

  const [mapRow] = await tx`
    insert into visit_def_procedure_map (
      organization_id, study_id, visit_definition_id, procedure_definition_id, is_required, sort_order
    ) values (
      ${study.organization_id},
      ${studyId},
      ${vd.id},
      ${unboundProc.id},
      true,
      9999
    )
    returning id
  `
  return { visit_definition_id: vd.id, map_id: mapRow.id }
}

async function probeScheduleRollback(coordId) {
  let captured = null
  try {
    await sql.begin(async (tx) => {
      const [ctx] = await tx`
        select ss.id as subject_id, ss.study_id
        from study_subjects ss
        where ss.enrollment_status in ('enrolled', 'randomized')
        limit 1
      `
      if (!ctx) {
        captured = { skipped: 'no subject for schedule probe' }
        return
      }

      const fixture = await installScheduleFailureFixture(tx, ctx.study_id)
      if (!fixture) {
        captured = { skipped: 'could not install unbound required procedure fixture' }
        return
      }

      const [countsBefore] = await tx`
        select
          (select count(*)::int from visits where study_subject_id = ${ctx.subject_id}) as visits,
          (select count(*)::int from procedure_executions pe
            join visits v on v.id = pe.visit_id where v.study_subject_id = ${ctx.subject_id}) as pe_count
      `
      const [subjBefore] = await tx`
        select enrollment_status, visit_schedule_generated_at
        from study_subjects where id = ${ctx.subject_id}
      `

      await tx`select set_config('role', 'authenticated', true)`
      await tx`select set_config('request.jwt.claim.sub', ${coordId}, true)`
      await tx`savepoint schedule_probe`

      let fail = null
      try {
        fail = await callRpc(tx, 'generate_subject_visit_schedule', [ctx.subject_id, null, false])
      } catch (err) {
        fail = { thrown: String(err.message ?? err) }
        await tx`rollback to savepoint schedule_probe`
      }

      const [countsAfter] = await tx`
        select
          (select count(*)::int from visits where study_subject_id = ${ctx.subject_id}) as visits,
          (select count(*)::int from procedure_executions pe
            join visits v on v.id = pe.visit_id where v.study_subject_id = ${ctx.subject_id}) as pe_count
      `
      const [subjAfter] = await tx`
        select enrollment_status, visit_schedule_generated_at
        from study_subjects where id = ${ctx.subject_id}
      `

      captured = {
        subject_id: ctx.subject_id,
        fixture,
        countsBefore,
        subjBefore,
        fail,
        countsAfter,
        subjAfter,
        pass:
          (fail?.thrown?.includes('Required procedure execution') ?? false)
          && countsBefore.visits === countsAfter.visits
          && countsBefore.pe_count === countsAfter.pe_count
          && subjBefore.enrollment_status === subjAfter.enrollment_status
          && String(subjBefore.visit_schedule_generated_at)
            === String(subjAfter.visit_schedule_generated_at),
      }
      throw new Error('__ROLLBACK_SCHEDULE_PROBE__')
    })
  } catch (e) {
    if (String(e.message).includes('__ROLLBACK_SCHEDULE_PROBE__')) return captured
    if (!captured) throw e
  }
  return captured
}

async function probeRandomizationVoid(coordId, orgId) {
  let captured = null
  try {
    await sql.begin(async (tx) => {
      const [subj] = await tx`
        select ss.id, ss.study_id, ss.enrollment_status,
               ss.randomization_number, ss.randomization_date_time,
               ss.randomization_arm, ss.external_iwrs_rtsm_reference,
               ss.schedule_anchor_date
        from study_subjects ss
        where ss.organization_id = ${orgId}
          and ss.enrollment_status = 'enrolled'
          and ss.randomization_number is null
        limit 1
      `
      if (!subj) {
        captured = { skipped: 'no enrolled non-randomized subject' }
        return
      }

      const fixture = await installScheduleFailureFixture(tx, subj.study_id)
      if (!fixture) {
        captured = { skipped: 'could not install unbound required procedure fixture' }
        return
      }
      const hasVisit = await tx`
        select 1 from visits v
        where v.study_subject_id = ${subj.id}
          and v.visit_definition_id = ${fixture.visit_definition_id}
          and v.visit_status not in ('cancelled', 'missed', 'no_show')
        limit 1
      `
      if (hasVisit.length) {
        captured = { skipped: 'subject already has fixture visit' }
        return
      }
      const randIso = new Date().toISOString()
      const anchorDate = randIso.slice(0, 10)

      await tx`
        update study_subjects set
          enrollment_status = 'randomized',
          randomization_number = 'P11B-PROOF',
          randomization_arm = 'A',
          randomization_date_time = ${randIso},
          external_iwrs_rtsm_reference = 'proof',
          schedule_anchor_date = ${anchorDate}
        where id = ${subj.id}
      `

      const [recorded] = await tx`
        insert into operational_events (
          organization_id, study_id, event_type, actor_user_id, occurred_at, payload
        ) values (
          ${orgId}, ${subj.study_id}, 'external_randomization_recorded', ${coordId}, ${randIso},
          ${sql.json({
            subject_id: subj.id,
            randomization_number: 'P11B-PROOF',
            source: 'phase11b_close_proof',
          })}
        )
        returning id
      `

      await tx`select set_config('role', 'authenticated', true)`
      await tx`select set_config('request.jwt.claim.sub', ${coordId}, true)`
      await tx`savepoint randomization_schedule_probe`

      let scheduleFail = null
      try {
        scheduleFail = await callRpc(tx, 'generate_subject_visit_schedule', [subj.id, anchorDate, false])
      } catch (err) {
        scheduleFail = { thrown: String(err.message ?? err) }
        await tx`rollback to savepoint randomization_schedule_probe`
      }

      await tx`
        update study_subjects set
          enrollment_status = ${subj.enrollment_status},
          randomization_number = ${subj.randomization_number},
          randomization_arm = ${subj.randomization_arm},
          randomization_date_time = ${subj.randomization_date_time},
          external_iwrs_rtsm_reference = ${subj.external_iwrs_rtsm_reference},
          schedule_anchor_date = ${subj.schedule_anchor_date}
        where id = ${subj.id}
      `

      const voidedRow = await tx`
        insert into operational_events (
          organization_id, study_id, event_type, actor_user_id, occurred_at, payload
        ) values (
          ${orgId}, ${subj.study_id}, 'external_randomization_voided', ${coordId}, clock_timestamp(),
          ${sql.json({
            subject_id: subj.id,
            voided_operational_event_id: recorded.id,
            void_reason: 'visit_schedule_generation_failed',
            schedule_error: scheduleFail?.thrown ?? scheduleFail?.error ?? 'unknown',
            product_boundary: 'compensating_event_no_delete',
          })}
        )
        returning id
      `

      const [recordedStill] = await tx`
        select id from operational_events where id = ${recorded.id}
      `
      const deleteAttempt = await tx`
        delete from operational_events where id = ${recorded.id} returning id
      `

      captured = {
        scheduleFail,
        recorded_id: recorded.id,
        recorded_still_exists: Boolean(recordedStill),
        voided_id: voidedRow[0]?.id,
        delete_attempt_rows: deleteAttempt.length,
        pass:
          Boolean(recordedStill)
          && Boolean(voidedRow[0]?.id)
          && deleteAttempt.length === 0
          && (scheduleFail?.thrown?.includes('Required procedure') ?? scheduleFail?.ok === false),
      }
      throw new Error('__ROLLBACK_RANDOMIZATION_PROBE__')
    })
  } catch (e) {
    if (String(e.message).includes('__ROLLBACK_RANDOMIZATION_PROBE__')) {
      return captured
    }
    if (!captured) captured = { error: String(e.message ?? e) }
  }
  return captured
}

async function main() {
  const report = { gates: {} }
  try {
    await apply0070()
    report.migration_0070 = 'applied'

    const [coord] = await sql`select id from auth.users where email = ${QA_COORD}`
    const [org] = await sql`
      select organization_id from organization_members where user_id = ${coord.id} limit 1
    `

    report.gates.all_or_error = await probeAllOrError(coord.id, org.organization_id)
    try {
      report.gates.schedule_rollback = await probeScheduleRollback(coord.id)
    } catch (e) {
      report.gates.schedule_rollback = { error: String(e.message ?? e) }
    }
    try {
      report.gates.randomization_void = await probeRandomizationVoid(coord.id, org.organization_id)
    } catch (e) {
      report.gates.randomization_void = { error: String(e.message ?? e) }
    }
  } catch (e) {
    report.error = String(e.message ?? e)
  } finally {
    await sql.end()
  }
  console.log(JSON.stringify(report, null, 2))
}

main()
