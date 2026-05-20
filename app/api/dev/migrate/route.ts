// app/api/dev/migrate/route.ts
// Development-only API route that applies pending SQL migrations.
// Called by the Antigravity agent via browser_subagent on localhost.
// Protected by MIGRATION_SECRET env var.
//
// POST /api/dev/migrate
// Body: { secret: string, files?: string[] }   // files = specific subset, or all if omitted
// Response: { ok: boolean, applied: string[], errors: string[] }

import { NextRequest, NextResponse } from 'next/server'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import postgres from 'postgres'

const MIGRATIONS_DIR = resolve(process.cwd(), 'supabase/migrations')

// Ordered list of all migration files — must stay in sync with apply-migrations.mjs
const ALL_MIGRATIONS = [
  '0001_auth_foundation.sql',
  '0002_audit_foundation.sql',
  '0003_studies.sql',
  '0004_study_versions.sql',
  '0005_study_members.sql',
  '0006_visit_and_procedure_definitions.sql',
  '0007_study_subjects.sql',
  '0008_visits.sql',
  '0009_procedure_executions.sql',
  '0010_operational_events.sql',
  '0011_attachments.sql',
  '0013_visit_completion_and_locking_rpc.sql',
  '0014_source_definitions.sql',
  '0015_source_definition_versions.sql',
  '0016_source_fields.sql',
  '0017_procedure_source_bindings.sql',
  '0018_procedure_execution_source_version_fk.sql',
  '0019_phase4a_validation_helpers.sql',
  '0020_source_response_sets.sql',
  '0021_source_responses.sql',
  '0022_source_response_corrections.sql',
  '0023_source_response_addenda.sql',
  '0024_source_response_validation_findings.sql',
  '0025_phase4b_validation_helpers.sql',
  '0026_source_publish_packages.sql',
  '0027_published_source_definitions.sql',
  '0028_published_source_rules_requirements.sql',
  '0029_source_publish_approval_evidence.sql',
  '0030_source_publish_persistence_helpers.sql',
  '0031_phase4c_publish_validation_helpers.sql',
  '0032_phase4c_published_phase4a_link_backfill.sql',
  '0033_publish_source_package_rpc.sql',
  '0034_phase4b1_open_and_save_rpc.sql',
  '0035_phase4b1_submit_source_response_set_rpc.sql',
  '0036_phase4b1_correction_addendum_rpc.sql',
  '0037_phase4b1_validation_finding_rpc.sql',
  '0038_phase4b_submit_source_responses_rls.sql',
  '0039_phase4b_srs_corrected_addended_attribution_fix.sql',
  '0040_phase51b_history_and_finding_events.sql',
  '0041_phase51c_read_rpcs.sql',
  '0042_phase6a5_source_builder_drafts.sql',
  '0043_phase6b1_patient_libraries.sql',
  '0044_phase6b1b_patient_libraries_bulk_indexes.sql',
  '0052_phase6c1_subject_clinical_profile.sql',
]

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
  const filesToApply = body.files && body.files.length > 0
    ? ALL_MIGRATIONS.filter((f) => body.files!.includes(f))
    : ALL_MIGRATIONS

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
  return NextResponse.json({
    ok: true,
    available_migrations: ALL_MIGRATIONS,
    latest: ALL_MIGRATIONS[ALL_MIGRATIONS.length - 1],
    database_url_set: !!process.env.DATABASE_URL,
    secret_required: !!process.env.MIGRATION_SECRET,
  })
}
