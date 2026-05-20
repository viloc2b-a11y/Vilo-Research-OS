/**
 * Apply 0001 + 0002 via direct Postgres (DATABASE_URL or DATABASE_URL_DIRECT).
 * Usage: npm run db:migrate
 *
 * Supabase notes:
 * - Transaction pooler (port 6543, *.pooler.supabase.com) requires prepare: false for postgres.js.
 * - "Tenant or user not found" usually means wrong pooler username or password — use
 *   postgres.PROJECT_REF as user, or prefer DATABASE_URL_DIRECT (db.*.supabase.co:5432).
 */
import { readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import postgres from 'postgres'
import { loadEnvFiles, projectRoot } from './lib/env.mjs'

/** All *.sql in supabase/migrations, lexicographic (0001 … 0053). */
function listMigrationFiles() {
  const migrationsDir = resolve(projectRoot, 'supabase/migrations')
  return readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort()
}

/** Optional: node scripts/apply-migrations.mjs --from 0044_phase6b1b_patient_libraries_bulk_indexes.sql */
function resolveMigrationFilesFromArgv() {
  const fromIdx = process.argv.indexOf('--from')
  if (fromIdx === -1) return listMigrationFiles()
  const fromFile = process.argv[fromIdx + 1]
  if (!fromFile) {
    throw new Error('--from requires a migration filename')
  }
  const all = listMigrationFiles()
  const start = all.indexOf(fromFile)
  if (start === -1) {
    throw new Error(`--from file not found in supabase/migrations: ${fromFile}`)
  }
  return all.slice(start)
}

/** Ordered candidates: direct first (DDL-friendly), then pooled. Dedupes identical URLs. */
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
    return (
      u.hostname.includes('pooler.supabase.com') ||
      u.port === '6543' ||
      u.searchParams.get('pgbouncer') === 'true'
    )
  } catch {
    return false
  }
}

function maskConnectionHint(urlString) {
  try {
    const u = new URL(urlString)
    return `${u.protocol}//${u.username}@${u.hostname}:${u.port || '5432'}${u.pathname}`
  } catch {
    return '(invalid DATABASE_URL)'
  }
}

function warnIfDatabaseUrlLooksWrong(urlString) {
  try {
    const u = new URL(urlString)
    const user = decodeURIComponent(u.username || '')
    const onPooler = u.hostname.includes('pooler.supabase.com')
    if (onPooler && user === 'postgres') {
      console.warn(
        '\nWARNING: Pooler URI uses username "postgres". Supabase expects postgres.<PROJECT_REF> for transaction pooler.\n',
      )
    }
    if (/xxxxx|placeholder|YOUR_PROJECT|changeme/i.test(urlString)) {
      console.warn(
        '\nWARNING: DATABASE_URL still contains a placeholder token — replace with real project ref and password.\n',
      )
    }
    const apiUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    if (apiUrl && onPooler && user.startsWith('postgres.')) {
      const ref = new URL(apiUrl).hostname.split('.')[0]
      const suffix = user.slice('postgres.'.length)
      if (suffix && suffix !== ref) {
        console.warn(
          `\nWARNING: DATABASE_URL user "${user}" does not match NEXT_PUBLIC_SUPABASE_URL ref "${ref}".\n`,
        )
      }
    }
  } catch {
    /* ignore */
  }
}

async function runMigrationsWithUrl(rawUrl) {
  warnIfDatabaseUrlLooksWrong(rawUrl)

  const usePooler = isSupabasePooler(rawUrl)
  console.log(
    `Connecting for migrations (${usePooler ? 'pooler — prepare:false' : 'direct/session'})…`,
    maskConnectionHint(rawUrl),
  )

  const sql = postgres(rawUrl, {
    ssl: 'require',
    max: 1,
    connect_timeout: 30,
    /*
     * Required for Supabase transaction pooler (PgBouncer transaction mode).
     * Without this, migrations often fail with pooler/auth-related errors.
     */
    prepare: false,
  })

  try {
    const migrationsDir = resolve(projectRoot, 'supabase/migrations')
    const MIGRATION_FILES = resolveMigrationFilesFromArgv()
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
    await sql.end({ timeout: 10 })
  }
}

async function main() {
  loadEnvFiles()

  const candidates = pickDatabaseUrlsInOrder()
  if (!candidates.length) {
    console.error(
      'Missing DATABASE_URL or DATABASE_URL_DIRECT in .env.local\n' +
        'Use Supabase Dashboard → Database → Connection string (URI).\n' +
        'For DDL, prefer direct: db.<PROJECT_REF>.supabase.co:5432',
    )
    process.exit(1)
  }

  let lastErr = null
  for (let i = 0; i < candidates.length; i++) {
    const rawUrl = candidates[i]
    try {
      await runMigrationsWithUrl(rawUrl)
      return
    } catch (err) {
      lastErr = err
      const msg = String(err.message || err)
      const isTenant = /tenant or user not found/i.test(msg)
      const canRetry = i < candidates.length - 1 && isTenant
      console.error('\nMigration failed:', msg)
      if (/tenant or user not found/i.test(msg)) {
        console.error(`
Likely causes:
  1. Pooler username must be postgres.<PROJECT_REF> (not plain "postgres").
  2. Password incorrect or contains unescaped URL characters — URL-encode special chars.
  3. Prefer DATABASE_URL_DIRECT for DDL:
     postgresql://postgres:[PASSWORD]@db.[PROJECT_REF].supabase.co:5432/postgres
     (Dashboard → Database → Connection string → URI, direct/session if offered)
`)
      }
      if (canRetry) {
        console.warn('\nRetrying migrations with the next DATABASE_URL candidate…\n')
        continue
      }
      throw err
    }
  }
  throw lastErr ?? new Error('Migration failed')
}

main().catch((err) => {
  console.error(err.message || err)
  process.exit(1)
})
