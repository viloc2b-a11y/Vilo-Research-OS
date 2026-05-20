/**
 * Apply one migration file (or comma-separated list) via direct Postgres.
 *
 * Usage:
 *   node scripts/apply-migration.mjs 0053_phase7b_vpi_sql_aggregation.sql
 *   node scripts/apply-migration.mjs 0044_phase6b1b_patient_libraries_bulk_indexes.sql,0053_phase7b_vpi_sql_aggregation.sql
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import postgres from 'postgres'
import { loadEnvFiles, projectRoot } from './lib/env.mjs'

function pickDatabaseUrlsInOrder() {
  const direct = process.env.DATABASE_URL_DIRECT?.trim()
  const pooled = process.env.DATABASE_URL?.trim()
  const urls = []
  if (direct) urls.push(direct)
  if (pooled && pooled !== direct) urls.push(pooled)
  return urls
}

function isSupabasePooler(url) {
  try {
    const u = new URL(url)
    return u.hostname.includes('pooler.supabase.com') || u.port === '6543'
  } catch {
    return false
  }
}

async function main() {
  loadEnvFiles()
  const arg = process.argv[2]
  if (!arg) {
    console.error('Usage: node scripts/apply-migration.mjs <file.sql>[,<file2.sql>]')
    process.exit(1)
  }

  const files = arg.split(',').map((f) => f.trim()).filter(Boolean)
  const candidates = pickDatabaseUrlsInOrder()
  if (!candidates.length) {
    console.error('Missing DATABASE_URL or DATABASE_URL_DIRECT in .env.local')
    process.exit(1)
  }

  let sql
  for (const raw of candidates) {
    try {
      sql = postgres(raw, {
        ssl: 'require',
        max: 1,
        connect_timeout: 30,
        prepare: isSupabasePooler(raw) ? false : undefined,
      })
      await sql`select 1`
      break
    } catch {
      sql = null
    }
  }

  if (!sql) {
    console.error('Could not connect with DATABASE_URL or DATABASE_URL_DIRECT')
    process.exit(1)
  }

  try {
    for (const file of files) {
      const path = resolve(projectRoot, 'supabase/migrations', file)
      const body = readFileSync(path, 'utf8')
      console.log(`Applying ${file}...`)
      await sql.unsafe(body)
      console.log(`  OK: ${file}`)
    }
  } finally {
    await sql.end({ timeout: 10 })
  }
}

main().catch((err) => {
  console.error(err.message || err)
  process.exit(1)
})
