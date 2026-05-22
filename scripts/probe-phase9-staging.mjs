import { loadEnvFiles } from './lib/env.mjs'
import postgres from 'postgres'

loadEnvFiles()
const url = process.env.DATABASE_URL_DIRECT || process.env.DATABASE_URL
const sql = postgres(url, { ssl: 'require', max: 1, prepare: url.includes('pooler') ? false : undefined })
const studyId = '6bae715a-8536-4000-8d24-22b6a3dbb8c9'
const subjId = '3bae1645-b94b-441c-b081-916a03896b0e'

const subjects = await sql`
  select id, subject_identifier, enrollment_status, randomization_number, schedule_anchor_date
  from study_subjects where study_id = ${studyId} order by created_at
`
const visits = await sql`
  select v.id, v.study_subject_id, v.visit_status, v.visit_review_status, v.visit_day, vd.label as visit_label
  from visits v
  left join visit_definitions vd on vd.id = v.visit_definition_id
  where v.study_id = ${studyId}
  order by v.created_at desc
  limit 12
`
const bindings = await sql`select count(*)::int as c from procedure_source_bindings where study_id = ${studyId}`
const maps = await sql`select id, is_required, visit_definition_id, procedure_definition_id from visit_def_procedure_map where study_id = ${studyId}`
const pe = await sql`
  select id, visit_id, execution_status, validation_status, source_definition_version_id
  from procedure_executions where study_id = ${studyId} order by created_at desc limit 8
`
const subjVisits = await sql`
  select count(*)::int as c from visits where study_id = ${studyId} and study_subject_id = ${subjId}
`
const visitsPerDef = await sql`
  select visit_definition_id, count(*)::int as c
  from visits where study_subject_id = ${subjId}
  group by visit_definition_id order by c desc
`
const visitDefs = await sql`
  select id, code, label from visit_definitions where study_id = ${studyId}
`
await sql.end()
console.log(JSON.stringify({ subjects, visits, subjVisitCount: subjVisits[0], visitsPerDef, visitDefs, bindings: bindings[0], maps, pe }, null, 2))
