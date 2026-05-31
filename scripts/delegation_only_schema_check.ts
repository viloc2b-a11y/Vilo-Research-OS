import { readFileSync } from 'node:fs'
import postgres from 'postgres'

function loadEnv() {
  for (const file of ['.env.local', '.env']) {
    try {
      for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
        const match = line.match(/^\s*([^#=]+)=(.*)$/)
        if (match && !process.env[match[1]]) {
          process.env[match[1]] = match[2].replace(/^["']|["']$/g, '')
        }
      }
    } catch {
      // optional
    }
  }
}

loadEnv()
const dbUrl = process.env.DATABASE_URL_DIRECT || process.env.DATABASE_URL
if (!dbUrl) throw new Error('DATABASE_URL or DATABASE_URL_DIRECT is required')

async function main() {
  const sql = postgres(dbUrl, { ssl: 'require', max: 1, prepare: false })
  try {
    const [tables] = await sql`
    select
      to_regclass('public.study_delegation_log') as delegation_log,
      to_regclass('public.operational_signature_requests') as signature_requests,
      to_regclass('public.operational_signatures') as signatures,
      to_regclass('public.operational_signature_events') as events
  `
    const columns = await sql`
    select column_name, data_type
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'study_delegation_log'
    order by ordinal_position
  `
    const constraints = await sql`
    select conname, pg_get_constraintdef(c.oid) as definition
    from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace
    where n.nspname = 'public'
      and t.relname = 'study_delegation_log'
    order by conname
  `
    console.log(JSON.stringify({ tables, columns, constraints }, null, 2))
  } finally {
    await sql.end()
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
