import postgres from 'postgres'
import { loadEnvFiles } from './lib/env.mjs'

loadEnvFiles()
const url = process.env.DATABASE_URL_DIRECT || process.env.DATABASE_URL
const sql = postgres(url, { ssl: 'require', max: 1, prepare: url.includes('pooler') ? false : undefined })

const QA_COORD = 'rbac.qa.research_coordinator@vilo-os.staging'
const QA_PI = 'rbac.qa.pi_sub_i@vilo-os.staging'

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

async function main() {
  const [coord] = await sql`select id from auth.users where email = ${QA_COORD}`
  const [pi] = await sql`select id from auth.users where email = ${QA_PI}`
  const [org] = await sql`
    select om.organization_id from organization_members om
    where om.user_id = ${coord.id} limit 1
  `

  const [srs] = await sql`
    select srs.id, srs.organization_id, srs.procedure_execution_id, sf.id as field_id
    from source_response_sets srs
    join procedure_executions pe on pe.id = srs.procedure_execution_id
    join source_fields sf on sf.source_definition_version_id = srs.source_definition_version_id
    where srs.organization_id = ${org.organization_id}
      and srs.status in ('draft', 'in_progress')
      and srs.source_definition_version_id = pe.source_definition_version_id
    limit 1
  `

  const out = { srs_found: Boolean(srs) }

  if (srs) {
    const [field] = await sql`
      select sf.id, sf.widget_hint
      from source_fields sf
      where sf.id = ${srs.field_id}
    `
    const hint = String(field?.widget_hint ?? 'text').toLowerCase()
    const validItem =
      hint.includes('integer') || hint === 'number'
        ? { source_field_id: srs.field_id, value_number: 42 }
        : hint === 'boolean'
          ? { source_field_id: srs.field_id, value_boolean: true }
          : { source_field_id: srs.field_id, value_text: 'phase11b-valid' }
    const bad = '00000000-0000-0000-0000-000000000099'
    out.save_all_or_error = await withActor(coord.id, (tx) =>
      callRpc(tx, 'save_source_draft', [
        srs.organization_id,
        srs.id,
        [validItem, { source_field_id: bad, value_text: 'bad' }],
        null,
      ]),
    )
    const [cnt] = await sql`
      select count(*)::int c from source_responses
      where response_set_id = ${srs.id} and value_text = 'phase11b-valid' and is_submitted = false
    `
    out.proof_value_rows = cnt.c

    const [row] = await sql`select updated_at from source_response_sets where id = ${srs.id}`
    const t1 = row.updated_at
    const bumpItem =
      hint.includes('integer') || hint === 'number'
        ? { source_field_id: srs.field_id, value_number: 99 }
        : hint === 'boolean'
          ? { source_field_id: srs.field_id, value_boolean: false }
          : { source_field_id: srs.field_id, value_text: `stale-${Date.now()}` }
    const bump = await withActor(pi.id, (tx) =>
      callRpc(tx, 'save_source_draft', [srs.organization_id, srs.id, [bumpItem], null]),
    )
    let staleErr = null
    try {
      await withActor(coord.id, (tx) =>
        callRpc(tx, 'save_source_draft', [srs.organization_id, srs.id, [validItem], t1]),
      )
    } catch (e) {
      staleErr = String(e.message ?? e)
    }
    const [val] = await sql`
      select value_text from source_responses
      where response_set_id = ${srs.id} and source_field_id = ${srs.field_id}
        and is_current = true and is_submitted = false limit 1
    `
    out.stale_save = { t1, bump, staleErr, final_value: val?.value_text }
  }

  const [sub] = await sql`
    select srs.id, srs.procedure_execution_id, srs.submitted_by_user_id, srs.submitted_at
    from source_response_sets srs
    where srs.organization_id = ${org.organization_id}
      and srs.status in ('submitted','pending_review','reviewed','signed','locked')
    limit 1
  `
  if (sub) {
    const first = await withActor(coord.id, (tx) =>
      callRpc(tx, 'submit_source_response_set', [org.organization_id, sub.id]),
    )
    const second = await withActor(coord.id, (tx) =>
      callRpc(tx, 'submit_source_response_set', [org.organization_id, sub.id]),
    )
    const [after] = await sql`
      select submitted_by_user_id, submitted_at, status from source_response_sets where id = ${sub.id}
    `
    const events = await sql`
      select count(*)::int c from operational_events
      where procedure_execution_id = ${sub.procedure_execution_id}
        and event_type = 'SOURCE_RESPONSE_SET_SUBMITTED'
        and payload ->> 'source_response_set_id' = ${sub.id}::text
    `
    out.double_submit = {
      first,
      second,
      before: { by: sub.submitted_by_user_id, at: sub.submitted_at },
      after,
      event_count: events[0].c,
      attribution_preserved:
        String(sub.submitted_by_user_id) === String(after.submitted_by_user_id)
        && String(sub.submitted_at) === String(after.submitted_at),
    }
  }

  const bindingGap = await sql`
    select s.id study_id, vd.id visit_definition_id
    from studies s
    join visit_definitions vd on vd.study_id = s.id
    join visit_def_procedure_map m on m.visit_definition_id = vd.id and m.study_id = s.id
    where m.is_required = true
      and not exists (
        select 1 from procedure_source_bindings psb
        where psb.study_id = s.id and psb.procedure_definition_id = m.procedure_definition_id
          and psb.default_source_definition_version_id is not null
      )
    limit 1
  `
  if (bindingGap[0]) {
    const [subj] = await sql`
      select ss.id from study_subjects ss
      where ss.study_id = ${bindingGap[0].study_id}
        and ss.enrollment_status in ('enrolled','randomized')
        and not exists (
          select 1 from visits v
          where v.study_subject_id = ss.id
            and v.visit_definition_id = ${bindingGap[0].visit_definition_id}
            and v.visit_status not in ('cancelled','missed','no_show')
        )
      limit 1
    `
    if (subj) {
      const before = await sql`
        select
          (select count(*)::int from visits where study_subject_id=${subj.id}) visits,
          (select count(*)::int from procedure_executions pe join visits v on v.id=pe.visit_id where v.study_subject_id=${subj.id}) pe
      `
      let fail = null
      try {
        fail = await withActor(coord.id, (tx) =>
          callRpc(tx, 'generate_subject_visit_schedule', [subj.id, null, false]),
        )
      } catch (e) {
        fail = { thrown: String(e.message ?? e) }
      }
      const after = await sql`
        select
          (select count(*)::int from visits where study_subject_id=${subj.id}) visits,
          (select count(*)::int from procedure_executions pe join visits v on v.id=pe.visit_id where v.study_subject_id=${subj.id}) pe
      `
      out.schedule_binding_failure = { subj: subj.id, before: before[0], fail, after: after[0] }
    }
  }

  await sql.end()
  console.log(JSON.stringify(out, null, 2))
}

main()
