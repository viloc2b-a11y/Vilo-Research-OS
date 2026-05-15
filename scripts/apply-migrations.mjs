/**
 * Apply 0001 + 0002 via direct Postgres (DATABASE_URL).
 * Usage: npm run db:migrate
 * Requires: DATABASE_URL in .env.local (Supabase → Settings → Database → URI)
 */
import { readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import postgres from 'postgres'
import { loadEnvFiles, projectRoot, requireEnv } from './lib/env.mjs'

const MIGRATION_FILES = [
  '0001_auth_foundation.sql',
  '0002_audit_foundation.sql',
]

async function main() {
  requireEnv(['DATABASE_URL'])
  loadEnvFiles()

  const migrationsDir = resolve(projectRoot, 'supabase/migrations')
  const sql = postgres(process.env.DATABASE_URL, { ssl: 'require', max: 1 })

  try {
    for (const file of MIGRATION_FILES) {
      const path = resolve(migrationsDir, file)
      const body = readFileSync(path, 'utf8')
      console.log(`Applying ${file}...`)
      await sql.unsafe(body)
      console.log(`  OK: ${file}`)
    }

    const applied = readdirSync(migrationsDir).filter((f) => f.endsWith('.sql'))
    console.log(`\nMigrations applied (${MIGRATION_FILES.length}):`, MIGRATION_FILES.join(', '))
    console.log('Total .sql files in folder:', applied.length)
  } finally {
    await sql.end({ timeout: 5 })
  }
}

main().catch((err) => {
  console.error(err.message || err)
  process.exit(1)
})
