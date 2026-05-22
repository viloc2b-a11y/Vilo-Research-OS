/**
 * Phase 10C — minimal live save + submit for pilot CBC capture (API probe).
 */
import { readFileSync } from 'node:fs'
import { loadEnvFiles } from './lib/env.mjs'
import { apiFetch, signInForCookieHeader, SYNTHETIC } from './lib/source-api-e2e.mjs'
import postgres from 'postgres'

loadEnvFiles()

const ORG = 'f7cf7d2b-49cd-4bcd-9e15-2675966c3e1e'
const RS = '59f7a569-1150-4187-85d3-51f4abc2c059'
const base = process.env.E2E_API_BASE_URL?.trim() || 'http://localhost:3000'

const responses = [
  { source_field_id: '2b45f40a-89da-4065-a765-2f7950b12c78', value_number: 72 },
  { source_field_id: '4550fb00-c43c-401a-ba9e-630832242ba7', value_number: 98.6 },
  { source_field_id: '49406071-a8f4-4147-9b6f-c3b54b8343f7', value_number: 120 },
  { source_field_id: 'be48e0a5-0d03-4bdf-98e4-1e9fbb4aac2b', value_number: 80 },
  { source_field_id: 'ae_present', value_boolean: true },
  { source_field_id: 'epro_completed', value_boolean: true },
  { source_field_id: 'ip_administered', value_boolean: true },
  { source_field_id: 'external_epro_id', value_text: 'EPRO-PHASE10C-001' },
  { source_field_id: 'completion_status', value_text: 'completed' },
  { source_field_id: 'ae_term', value_text: 'Headache mild' },
]

// Resolve field ids by key from DB for booleans/text if static ids wrong
const dbUrl = process.env.DATABASE_URL_DIRECT || process.env.DATABASE_URL
const sql = postgres(dbUrl, { max: 1 })
const sdv = '2ee5a544-fba6-4edb-a5c1-61ba5e2eee00'
const fieldRows = await sql`
  select field_key, id from source_fields
  where source_definition_version_id = ${sdv}::uuid
    and field_key in (
      'heart_rate','temperature','systolic_bp','diastolic_bp',
      'ae_present','epro_completed','ip_administered','external_epro_id','completion_status','ae_term'
    )`
const byKey = Object.fromEntries(fieldRows.map((r) => [r.field_key, r.id]))

const payloadResponses = [
  { source_field_id: byKey.heart_rate, value_number: 72 },
  { source_field_id: byKey.temperature, value_number: 98.6 },
  { source_field_id: byKey.systolic_bp, value_number: 120 },
  { source_field_id: byKey.diastolic_bp, value_number: 80 },
  { source_field_id: byKey.ae_present, value_boolean: true },
  { source_field_id: byKey.epro_completed, value_boolean: true },
  { source_field_id: byKey.ip_administered, value_boolean: true },
  { source_field_id: byKey.external_epro_id, value_text: 'EPRO-PHASE10C-001' },
  { source_field_id: byKey.completion_status, value_text: 'completed' },
  { source_field_id: byKey.ae_term, value_text: 'Headache mild' },
].filter((r) => r.source_field_id)

const { cookieHeader } = await signInForCookieHeader(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  SYNTHETIC.userA,
)

const save = await apiFetch(base, '/api/source/response-set/save-draft', {
  method: 'POST',
  cookieHeader,
  body: {
    organization_id: ORG,
    source_response_set_id: RS,
    responses: payloadResponses,
  },
})
console.log('save-draft', save.httpStatus, save.json?.ok, save.json?.code)

const submit = await apiFetch(base, '/api/source/response-set/submit', {
  method: 'POST',
  cookieHeader,
  body: {
    organization_id: ORG,
    source_response_set_id: RS,
    submit_reason: 'Phase 10C pilot re-verification submit',
  },
})
console.log('submit', submit.httpStatus, submit.json?.ok, submit.json?.code)

const vitals = await sql`
  select sf.field_key, sr.value_number
  from source_responses sr
  join source_fields sf on sf.id = sr.source_field_id
  where sr.response_set_id = ${RS}::uuid and sr.is_current = true
    and sf.field_key in ('temperature','systolic_bp','diastolic_bp','heart_rate')
  order by sf.field_key`
console.log('vitals_persisted:', vitals)

const rsRow = await sql`
  select status, submitted_at from source_response_sets where id = ${RS}::uuid`
console.log('response_set:', rsRow[0])

const errors = await sql`select public.phase4b_source_response_set_submit_errors(${RS}::uuid) as errors`
console.log('submit_errors:', errors[0].errors)

await sql.end()
