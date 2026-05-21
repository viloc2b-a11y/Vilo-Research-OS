// app/api/dev/migrate/route.ts
// Development-only API route that applies pending SQL migrations.
// Called by the Antigravity agent via browser_subagent on localhost.
// Protected by MIGRATION_SECRET env var.
//
// POST /api/dev/migrate
// Body: { secret: string, files?: string[] }   // files = specific subset, or all if omitted
// Response: { ok: boolean, applied: string[], errors: string[] }

import { NextRequest, NextResponse } from 'next/server'
import { readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import postgres from 'postgres'

const MIGRATIONS_DIR = resolve(process.cwd(), 'supabase/migrations')

function listMigrationFiles() {
  return readdirSync(MIGRATIONS_DIR)
    .filter((file) => file.endsWith('.sql'))
    .sort()
}

function isPooler(url: string) {
  try {
    const u = new URL(url)
    return u.hostname.includes('pooler.supabase.com') || u.port === '6543'
  } catch {
    return false
  }
}

export async function POST(req: NextRequest) {
  // Guard: require explicit opt-in — set MIGRATION_ALLOWED=1 in .env.local
  // This works in both dev and production-mode starts.
  if (process.env.MIGRATION_ALLOWED !== '1') {
    return NextResponse.json(
      { ok: false, error: 'Set MIGRATION_ALLOWED=1 in .env.local to enable this endpoint' },
      { status: 403 },
    )
  }

  // Secret check — prevents accidental exposure
  const secret = process.env.MIGRATION_SECRET
  let body: { secret?: string; files?: string[] } = {}
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON body' }, { status: 400 })
  }

  if (secret && body.secret !== secret) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  }

  // Prefer direct connection (better for DDL); fall back to pooler
  const rawUrl = process.env.DATABASE_URL_DIRECT || process.env.DATABASE_URL
  if (!rawUrl) {
    return NextResponse.json({ ok: false, error: 'No DATABASE_URL configured' }, { status: 500 })
  }

  // Determine which files to apply
  const allMigrations = listMigrationFiles()
  const requestedFiles = body.files?.filter((file) => typeof file === 'string') ?? []
  const unknownFiles = requestedFiles.filter((file) => !allMigrations.includes(file))
  if (unknownFiles.length > 0) {
    return NextResponse.json(
      { ok: false, error: 'Unknown migration file(s)', unknown_files: unknownFiles },
      { status: 400 },
    )
  }

  const filesToApply = requestedFiles.length > 0
    ? allMigrations.filter((file) => requestedFiles.includes(file))
    : allMigrations

  const sql = postgres(rawUrl, {
    ssl: 'require',
    max: 1,
    connect_timeout: 30,
    prepare: !isPooler(rawUrl),
  })

  const applied: string[] = []
  const errors: string[] = []

  try {
    for (const file of filesToApply) {
      try {
        const path = resolve(MIGRATIONS_DIR, file)
        const body = readFileSync(path, 'utf8')
        await sql.unsafe(body)
        applied.push(file)
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        errors.push(`${file}: ${msg}`)
        // Continue applying remaining migrations (idempotent script)
      }
    }
  } finally {
    await sql.end({ timeout: 10 })
  }

  const ok = errors.length === 0
  return NextResponse.json({ ok, applied, errors }, { status: ok ? 200 : 207 })
}

// GET — health check & shows available migrations
export async function GET() {
  if (process.env.MIGRATION_ALLOWED !== '1') {
    return NextResponse.json({ ok: false, error: 'Set MIGRATION_ALLOWED=1 in .env.local to enable this endpoint' }, { status: 403 })
  }
  const allMigrations = listMigrationFiles()
  return NextResponse.json({
    ok: true,
    available_migrations: allMigrations,
    latest: allMigrations[allMigrations.length - 1] ?? null,
    database_url_set: !!process.env.DATABASE_URL,
    secret_required: !!process.env.MIGRATION_SECRET,
  })
}
