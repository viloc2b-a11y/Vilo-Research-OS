import { loadEnvFiles } from './lib/env.mjs'
import postgres from 'postgres'

const fresh = process.argv.includes('--fresh')

loadEnvFiles()
const url = process.env.DATABASE_URL_DIRECT || process.env.DATABASE_URL
if (!url) {
  console.error('no DATABASE_URL')
  process.exit(1)
}
const sql = postgres(url, {
  ssl: 'require',
  max: 1,
  prepare: url.includes('pooler') ? false : undefined,
})
const org = await sql`
  select id from organizations where name ilike '%Synthetic Site Alpha%' limit 1
`
const study = await sql`
  select id from studies
  where organization_id = ${org[0]?.id} and slug = 'phase2-validation-study'
  limit 1
`
const sv = await sql`
  select id from study_versions where study_id = ${study[0]?.id}
  order by created_at desc limit 1
`
const subj = await sql`
  select id from study_subjects where study_id = ${study[0]?.id} limit 1
`
const visits = await sql`
  select id, visit_status from visits where study_id = ${study[0]?.id} order by created_at
`
const pe = await sql`
  select id, visit_id, execution_status, source_definition_version_id
  from procedure_executions where study_id = ${study[0]?.id} order by created_at
`
const user = await sql`
  select id, email from auth.users where email = 'synthetic.staff.a@vilo-os.staging' limit 1
`
const vd = await sql`
  select id from visit_definitions where study_id = ${study[0]?.id} and code = 'V_SCREENING' limit 1
`
const pd = await sql`
  select id from procedure_definitions where study_id = ${study[0]?.id} limit 1
`

let e2eVisit = fresh ? null : visits.find((v) => v.visit_status === 'scheduled')
let e2ePe = e2eVisit ? pe.find((p) => p.visit_id === e2eVisit?.id) : null

if (!e2eVisit?.id && vd[0]?.id && subj[0]?.id) {
  const inserted = await sql`
    insert into visits (
      organization_id, study_id, study_subject_id, visit_definition_id,
      scheduled_date, visit_status
    ) values (
      ${org[0].id}, ${study[0].id}, ${subj[0].id}, ${vd[0].id},
      current_date + 7, 'scheduled'
    )
    returning id, visit_status
  `
  e2eVisit = inserted[0]
}

if (e2eVisit?.id && !e2ePe?.id && pd[0]?.id) {
  const insertedPe = await sql`
    insert into procedure_executions (
      organization_id, study_id, visit_id, procedure_definition_id, execution_status
    ) values (
      ${org[0].id}, ${study[0].id}, ${e2eVisit.id}, ${pd[0].id}, 'pending'
    )
    returning id, visit_id, execution_status
  `
  e2ePe = insertedPe[0]
}

console.log(
  JSON.stringify(
    {
      organization_id: org[0]?.id,
      study_id: study[0]?.id,
      study_version_id: sv[0]?.id,
      study_subject_id: subj[0]?.id,
      visit_id: e2eVisit?.id,
      visit_status: e2eVisit?.visit_status,
      procedure_execution_id: e2ePe?.id,
      actor_user_id: user[0]?.id,
      locked_fixture_visit: visits[0]?.id,
    },
    null,
    2,
  ),
)
await sql.end()
