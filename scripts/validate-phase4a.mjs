/**
 * Phase 4A schema catalog checks (Versioned Protocol Builder foundations).
 *
 * Prerequisites:
 *   - Migrations 0014–0019 applied (manual SQL Editor or `npm run db:migrate` after env wiring).
 *   - DATABASE_URL_DIRECT or DATABASE_URL for catalog queries via postgres.js.
 *
 * This script is intentionally lightweight: it does not assert lifecycle or RLS behavior yet.
 * Expect BLOCKED rows until Phase 4A DDL is present in the target database.
 *
 * Usage: npm run db:validate-phase4a
 */
import { writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import postgres from 'postgres'
import { loadEnvFiles, projectRoot } from './lib/env.mjs'

const EXPECTED_TABLES = [
  'source_definitions',
  'source_definition_versions',
  'source_fields',
  'procedure_source_bindings',
]

const results = {
  runAt: new Date().toISOString(),
  phase: '4A',
  checks: [],
  summary: { passed: 0, failed: 0, blocked: 0 },
}

function record(name, status, detail) {
  results.checks.push({ name, status, detail: String(detail ?? '') })
  if (status === 'PASS') results.summary.passed++
  else if (status === 'FAIL') results.summary.failed++
  else if (status === 'BLOCKED') results.summary.blocked++
}

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

async function connectPostgres() {
  const candidates = pickDatabaseUrlsInOrder()
  for (const raw of candidates) {
    try {
      const sql = postgres(raw, {
        ssl: 'require',
        max: 1,
        connect_timeout: 25,
        prepare: isSupabasePooler(raw) ? false : undefined,
      })
      await sql`select 1`
      return sql
    } catch (e) {
      const msg = String(e.message || e)
      if (/tenant or user not found/i.test(msg) && candidates.length > 1) continue
    }
  }
  return null
}

function writeReportMd() {
  const out = resolve(projectRoot, 'docs/PHASE4A-VALIDATION-CATALOG.md')
  const lines = [
    '# Phase 4A — Catalog validation (scripts/validate-phase4a.mjs)',
    '',
    `**Run at:** ${results.runAt}`,
    '',
    '## Summary',
    '',
    '| Result | Count |',
    '|--------|-------|',
    `| PASS | ${results.summary.passed} |`,
    `| FAIL | ${results.summary.failed} |`,
    `| BLOCKED | ${results.summary.blocked} |`,
    '',
    results.summary.failed === 0 && results.summary.blocked === 0
      ? '**Phase 4A catalog:** tables and core column present.'
      : '**Phase 4A catalog:** apply migrations 0014–0019 to clear BLOCKED/FAIL rows.',
    '',
    '## Checks',
    '',
    '| Name | Status | Detail |',
    '|------|--------|--------|',
    ...results.checks.map((c) => `| ${c.name} | ${c.status} | ${c.detail.replace(/\|/g, '\\|')} |`),
    '',
  ]
  writeFileSync(out, lines.join('\n'), 'utf8')
}

async function main() {
  loadEnvFiles()

  const sql = await connectPostgres()
  if (!sql) {
    record('database_connect', 'BLOCKED', 'Missing DATABASE_URL / DATABASE_URL_DIRECT or connection failed')
    writeReportMd()
    console.error('Phase 4A validation: no database connection (see docs/PHASE4A-VALIDATION-CATALOG.md)')
    process.exit(1)
  }

  try {
    for (const t of EXPECTED_TABLES) {
      const rel = `public.${t}`
      const rows = await sql`select to_regclass(${rel})::text as reg`
      const reg = rows[0]?.reg
      if (reg && reg !== '') record(`table_${t}`, 'PASS', reg)
      else record(`table_${t}`, 'BLOCKED', 'table missing — apply 0014–0017 migrations')
    }

    const col = await sql`
      select a.attname
      from pg_attribute a
      join pg_class c on c.oid = a.attrelid
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public'
        and c.relname = 'procedure_executions'
        and a.attname = 'source_definition_version_id'
        and a.attnum > 0
        and not a.attisdropped
    `
    if (col.length)
      record('procedure_executions.source_definition_version_id', 'PASS', 'column exists (nullable FK)')
    else
      record(
        'procedure_executions.source_definition_version_id',
        'BLOCKED',
        'column missing — apply 0018 migration',
      )

    const fn = await sql`
      select p.proname
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public'
        and p.proname in ('phase4a_jsonb_octet_length', 'phase4a_sdv_is_published_binding_target')
      order by p.proname
    `
    const names = new Set(fn.map((r) => r.proname))
    if (
      names.has('phase4a_jsonb_octet_length') &&
      names.has('phase4a_sdv_is_published_binding_target')
    ) {
      record('phase4a_helper_functions', 'PASS', [...names].sort().join(', '))
    } else {
      record('phase4a_helper_functions', 'BLOCKED', 'apply 0019_phase4a_validation_helpers.sql')
    }

    /** RLS flags */
    const rls = await sql`
      select c.relname, c.relrowsecurity as rls
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public'
        and c.relkind = 'r'
        and c.relname in ${sql(EXPECTED_TABLES)}
      order by c.relname
    `
    const foundNames = new Set(rls.map((r) => r.relname))
    const missing = EXPECTED_TABLES.filter((name) => !foundNames.has(name))
    let rlsBad = rls.filter((row) => !row.rls).map((row) => row.relname)
    if (missing.length || rlsBad.length) {
      record(
        'rls_enabled_new_tables',
        'BLOCKED',
        [
          missing.length ? `missing tables: ${missing.join(', ')}` : '',
          rlsBad.length ? `RLS off: ${rlsBad.join(', ')}` : '',
        ]
          .filter(Boolean)
          .join(' · '),
      )
    } else record('rls_enabled_new_tables', 'PASS', EXPECTED_TABLES.join(', '))

    writeReportMd()

    if (results.summary.failed > 0) {
      console.error('Phase 4A validation: FAIL — see docs/PHASE4A-VALIDATION-CATALOG.md')
      process.exit(1)
    }
    if (results.summary.blocked > 0) {
      console.warn(
        'Phase 4A validation: BLOCKED (expected until 0014–0019 applied) — see docs/PHASE4A-VALIDATION-CATALOG.md',
      )
      process.exit(0)
    }
    console.log('Phase 4A catalog validation: GREEN — see docs/PHASE4A-VALIDATION-CATALOG.md')
  } finally {
    await sql.end({ timeout: 10 })
  }
}

main().catch((e) => {
  console.error(e.message || e)
  process.exit(1)
})
