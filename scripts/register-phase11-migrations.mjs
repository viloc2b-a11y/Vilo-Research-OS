import postgres from 'postgres'
import { loadEnvFiles } from './lib/env.mjs'

loadEnvFiles()
const sql = postgres(process.env.DATABASE_URL_DIRECT || process.env.DATABASE_URL, {
  ssl: 'require',
  max: 1,
})

const names = [
  '0067_phase11a_runtime_safety_p0',
  '0068_phase11b_concurrency',
  '0069_phase11b_fix_audit_blockers',
]

for (const name of names) {
  const exists = await sql`
    select 1 from supabase_migrations.schema_migrations where name = ${name}
  `
  if (!exists.length) {
    await sql`
      insert into supabase_migrations.schema_migrations (version, name)
      values (${name.slice(0, 4)}, ${name})
    `
    console.log('registered', name)
  } else {
    console.log('already', name)
  }
}

console.log(
  await sql`
    select version, name from supabase_migrations.schema_migrations
    where name like '%phase11%'
    order by version
  `,
)
await sql.end()
