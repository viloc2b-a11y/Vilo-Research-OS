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
const sql = postgres(process.env.DATABASE_URL, { max: 1 })

const org = 'f7cf7d2b-49cd-4bcd-9e15-2675966c3e1e'
const rs = '59f7a569-1150-4187-85d3-51f4abc2c059'
const vitals = [
  { source_field_id: '4550fb00-c43c-401a-ba9e-630832242ba7', value_number: 98.6 },
  { source_field_id: '49406071-a8f4-4147-9b6f-c3b54b8343f7', value_number: 120 },
  { source_field_id: 'be48e0a5-0d03-4bdf-98e4-1e9fbb4aac2b', value_number: 80 },
]

const save = await sql`
  select public.save_source_draft(
    ${org}::uuid,
    ${rs}::uuid,
    ${sql.json(vitals)}::jsonb
  ) as result`
console.log('save_source_draft:', JSON.stringify(save[0].result, null, 2))

const submit = await sql`
  select public.submit_source_response_set(
    ${org}::uuid,
    ${rs}::uuid,
    ${'Phase 10B pilot re-verification submit'}::text
  ) as result`
console.log('submit_source_response_set:', JSON.stringify(submit[0].result, null, 2))

const errors = await sql`select public.phase4b_source_response_set_submit_errors(${rs}::uuid) as errors`
console.log('submit_errors after:', JSON.stringify(errors[0].errors, null, 2))

await sql.end()
