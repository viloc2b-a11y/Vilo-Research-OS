/**
 * Phase 15B — trace visit → PE → binding → capture linkage for pilot fixture.
 */
import { createClient } from '@supabase/supabase-js'
import { loadEnvFiles } from './lib/env.mjs'
import postgres from 'postgres'

loadEnvFiles()

const STUDY_ID = '6bae715a-8536-4000-8d24-22b6a3dbb8c9'
const ORG_ID = 'f7cf7d2b-49cd-4bcd-9e15-2675966c3e1e'
const SUBJECT_ID = '4384b789-4e16-4512-b3f3-50642b3b9735'
const VISIT_ID = '6690da63-4bf1-4681-815a-3e39b7b014bc'
const PROC_DEF_ID = '17059af6-37fa-48a5-9bef-e82b7e2606b1'
const SDV_ID = '2ee5a544-fba6-4edb-a5c1-61ba5e2eee00'

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } },
)

const dbUrl = process.env.DATABASE_URL_DIRECT || process.env.DATABASE_URL
const sql = postgres(dbUrl, {
  ssl: 'require',
  max: 1,
  prepare: dbUrl.includes('pooler') ? false : undefined,
})

const visit = await sql`
  select v.id, v.visit_status, v.visit_definition_id, vd.code, vd.label
  from visits v
  join visit_definitions vd on vd.id = v.visit_definition_id
  where v.id = ${VISIT_ID}::uuid
`

const peOnVisit = await sql`
  select pe.id, pe.visit_id, pe.procedure_definition_id, pe.execution_status,
         pe.validation_status, pe.is_signed, pe.source_definition_version_id
  from procedure_executions pe
  where pe.visit_id = ${VISIT_ID}::uuid
`

const peOnSubject = await sql`
  select pe.id, pe.visit_id, v.visit_status, vd.code as visit_code,
         pe.procedure_definition_id, pe.execution_status
  from procedure_executions pe
  join visits v on v.id = pe.visit_id
  join visit_definitions vd on vd.id = v.visit_definition_id
  where v.study_subject_id = ${SUBJECT_ID}::uuid
  order by v.scheduled_date nulls last
`

const binding = await sql`
  select * from procedure_source_bindings
  where study_id = ${STUDY_ID}::uuid
    and procedure_definition_id = ${PROC_DEF_ID}::uuid
`

const map = await sql`
  select vdpm.*, vd.code as visit_code
  from visit_def_procedure_map vdpm
  join visit_definitions vd on vd.id = vdpm.visit_definition_id
  where vdpm.study_id = ${STUDY_ID}::uuid
    and vdpm.procedure_definition_id = ${PROC_DEF_ID}::uuid
`

const responseSets = await sql`
  select srs.id, srs.procedure_execution_id, srs.status, srs.source_definition_version_id,
         pe.visit_id, sdv.lifecycle_status
  from source_response_sets srs
  left join procedure_executions pe on pe.id = srs.procedure_execution_id
  left join source_definition_versions sdv on sdv.id = srs.source_definition_version_id
  where srs.organization_id = ${ORG_ID}::uuid
    and (pe.visit_id = ${VISIT_ID}::uuid or srs.id = '59f7a569-1150-4187-85d3-51f4abc2c059'::uuid)
`

const sdvCompare = await sql`
  select id, lifecycle_status, version_label
  from source_definition_versions
  where id in (${SDV_ID}::uuid, 'e0317385-5066-47af-b5dc-c0e4264f49d7'::uuid)
`

const allVisits = await sql`
  select v.id, vd.code, v.visit_status,
         (select count(*)::int from procedure_executions pe where pe.visit_id = v.id) as pe_count
  from visits v
  join visit_definitions vd on vd.id = v.visit_definition_id
  where v.study_subject_id = ${SUBJECT_ID}::uuid
  order by vd.sort_order
`

console.log(JSON.stringify({
  visit: visit[0] ?? null,
  peOnVisit,
  peOnSubject,
  binding: binding[0] ?? null,
  visitDefProcedureMap: map,
  responseSets,
  sdvCompare,
  allVisits,
}, null, 2))

await sql.end()
