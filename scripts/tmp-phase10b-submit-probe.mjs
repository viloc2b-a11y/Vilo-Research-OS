import { readFileSync } from 'node:fs'
import postgres from 'postgres'

function loadEnv(path) {
  try {
    for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
      const m = line.match(/^([^#=]+)=(.*)$/)
      if (m) process.env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, '')
    }
  } catch {
    /* ignore */
  }
}

loadEnv('.env.local')
const url = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL
if (!url) {
  console.error('no DATABASE_URL')
  process.exit(1)
}

const sql = postgres(url, { max: 1 })
const id = '59f7a569-1150-4187-85d3-51f4abc2c059'

const errors = await sql`select public.phase4b_source_response_set_submit_errors(${id}::uuid) as errors`
console.log('submit_errors:', JSON.stringify(errors[0].errors, null, 2))

const rows = await sql`
  select sf.field_key, sf.widget_hint, sf.is_required,
    sr.value_type, sr.value_text, sr.value_number, sr.value_boolean,
    public.phase4b_response_populated_slot_count(sr.value_text,sr.value_number,sr.value_boolean,sr.value_date,sr.value_datetime,sr.value_json) as slots,
    public.phase4b_response_value_matches_widget(sf.widget_hint,sr.value_type,sr.value_text,sr.value_number,sr.value_boolean,sr.value_date,sr.value_datetime,sr.value_json) as widget_ok
  from source_responses sr
  join source_fields sf on sf.id = sr.source_field_id
  where sr.response_set_id = ${id}::uuid and sr.is_current = true
  order by sf.field_key`

console.log('responses:', JSON.stringify(rows, null, 2))

const reqMissing = await sql`
  select sf.field_key from source_fields sf
  join source_response_sets srs on srs.source_definition_version_id = sf.source_definition_version_id
  where srs.id = ${id}::uuid and sf.is_required = true
  and not exists (
    select 1 from source_responses sr where sr.response_set_id = srs.id and sr.source_field_id = sf.id
      and sr.is_current and not sr.is_submitted
      and public.phase4b_current_response_has_value(sr.value_text,sr.value_number,sr.value_boolean,sr.value_date,sr.value_datetime,sr.value_json)
      and public.phase4b_response_value_matches_widget(sf.widget_hint,sr.value_type,sr.value_text,sr.value_number,sr.value_boolean,sr.value_date,sr.value_datetime,sr.value_json)
  )`

console.log('missing_required:', reqMissing.map((r) => r.field_key))

const sdv = '2ee5a544-fba6-4edb-a5c1-61ba5e2eee00'
const required = await sql`
  select field_key, widget_hint from source_fields
  where source_definition_version_id = ${sdv}::uuid and is_required
  order by field_key`
console.log('sdv_required:', required)

const vitals = await sql`
  select sf.field_key, sf.id, sf.widget_hint
  from source_fields sf
  where sf.source_definition_version_id = ${sdv}::uuid
    and sf.field_key in ('heart_rate','temperature','systolic_bp','diastolic_bp')
  order by sf.field_key`
console.log('vital_field_ids:', vitals)

const pe = await sql`
  select fields_disabled_at, section_disabled_at, is_signed, is_locked
  from procedure_executions where id = 'c022a7f6-3bc1-4b81-a19f-8075a4e3a1dc'::uuid`
console.log('procedure:', pe[0])

await sql.end()
