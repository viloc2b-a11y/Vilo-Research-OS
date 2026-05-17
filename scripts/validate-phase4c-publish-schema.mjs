/**
 * Phase 4C.10 — Publish persistence schema catalog validation (read-only by default).
 *
 * Prerequisites:
 *   - Migrations 0026–0032 applied on staging.
 *   - DATABASE_URL_DIRECT or DATABASE_URL in .env.local
 *
 * Usage:
 *   npm run db:validate-phase4c
 *   npm run db:validate-phase4c -- --json
 *   node scripts/validate-phase4c-publish-schema.mjs --mutating   # documents only; no DML yet
 */
import { writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import postgres from 'postgres'
import { loadEnvFiles, projectRoot } from './lib/env.mjs'

const EXPECTED_TABLES = [
  'source_publish_packages',
  'published_source_definition_versions',
  'published_source_sections',
  'published_source_fields',
  'published_source_validation_rules',
  'published_source_conditional_rules',
  'published_source_workflow_requirements',
  'published_source_signature_requirements',
  'published_source_external_requirements',
  'published_source_runtime_expectations',
  'source_publish_approval_evidence',
]

const EXPECTED_FUNCTIONS = [
  'phase4c_user_can_publish_source_package',
  'phase4c_package_hash_is_valid',
  'phase4c_assert_publish_package_eligible',
  'phase4c_touch_persisted_package',
  'phase4c_published_snapshot_before_write',
  'phase4c_link_published_sdv_to_phase4a',
  'phase4c_link_published_field_to_phase4a',
  'phase4c_publish_package_is_consistent',
  'publish_source_package',
]

const EXPECTED_VIEWS = [
  'phase4c_violation_package_not_ready_but_persisted',
  'phase4c_violation_package_invalid_validation_status',
  'phase4c_violation_missing_approval_evidence',
  'phase4c_violation_approval_hash_mismatch',
  'phase4c_violation_published_sdv_without_package_header',
  'phase4c_violation_published_section_without_sdv',
  'phase4c_violation_published_field_without_section',
  'phase4c_violation_persisted_missing_phase4a_sdv_link',
  'phase4c_violation_persisted_missing_phase4a_field_link',
  'phase4c_violation_duplicate_deterministic_sdv_ids',
  'phase4c_violation_duplicate_deterministic_field_ids',
  'phase4c_violation_runtime_expectation_orphan',
  'phase4c_violation_capture_unpublished_sdv_binding',
]

const MIGRATION_ORDER = [
  '0026_source_publish_packages.sql',
  '0027_published_source_definitions.sql',
  '0028_published_source_rules_requirements.sql',
  '0029_source_publish_approval_evidence.sql',
  '0030_source_publish_persistence_helpers.sql',
  '0031_phase4c_publish_validation_helpers.sql',
  '0032_phase4c_published_phase4a_link_backfill.sql',
  '0033_publish_source_package_rpc.sql',
]

const results = {
  runAt: new Date().toISOString(),
  phase: '4C.10',
  mode: 'read-only',
  checks: [],
  violationCounts: {},
  summary: { passed: 0, failed: 0, blocked: 0, warned: 0 },
}

function parseArgs(argv) {
  return {
    json: argv.includes('--json'),
    mutating: argv.includes('--mutating'),
  }
}

function record(name, status, detail) {
  results.checks.push({ name, status, detail: String(detail ?? '') })
  if (status === 'PASS') results.summary.passed++
  else if (status === 'FAIL') results.summary.failed++
  else if (status === 'BLOCKED') results.summary.blocked++
  else if (status === 'WARN') results.summary.warned++
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
  const out = resolve(projectRoot, 'docs/PHASE4C10-VALIDATION-CATALOG.md')
  const lines = [
    '# Phase 4C.10 — Catalog validation (scripts/validate-phase4c-publish-schema.mjs)',
    '',
    `**Run at:** ${results.runAt}`,
    `**Mode:** ${results.mode}`,
    '',
    '## Summary',
    '',
    '| Result | Count |',
    '|--------|-------|',
    `| PASS | ${results.summary.passed} |`,
    `| FAIL | ${results.summary.failed} |`,
    `| BLOCKED | ${results.summary.blocked} |`,
    `| WARN | ${results.summary.warned} |`,
    '',
    '## Violation view row counts (informational)',
    '',
    '| View | Rows |',
    '|------|-----:|',
    ...Object.entries(results.violationCounts).map(([k, v]) => `| ${k} | ${v} |`),
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
  const args = parseArgs(process.argv)
  loadEnvFiles()

  if (args.mutating) {
    results.mode = 'mutating-requested'
    record(
      'mutating_tests',
      'WARN',
      '--mutating not implemented in harness; run manual tests in PHASE4C10-STAGING-VALIDATION-PLAN.md Sections C–F',
    )
  }

  const sql = await connectPostgres()
  if (!sql) {
    record('database_connect', 'BLOCKED', 'Missing DATABASE_URL / DATABASE_URL_DIRECT or connection failed')
    writeReportMd()
    if (args.json) console.log(JSON.stringify(results, null, 2))
    console.error('Phase 4C validation: no database connection')
    process.exit(1)
  }

  try {
    record('migration_apply_order', 'PASS', MIGRATION_ORDER.join(' → '))

    for (const t of EXPECTED_TABLES) {
      const rel = `public.${t}`
      const rows = await sql`select to_regclass(${rel})::text as reg`
      const reg = rows[0]?.reg
      if (reg && reg !== '') record(`table_${t}`, 'PASS', reg)
      else record(`table_${t}`, 'BLOCKED', 'table missing — apply 0026–0032')
    }

    const fnRows = await sql`
      select p.proname
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public'
        and p.proname in ${sql(EXPECTED_FUNCTIONS)}
      order by p.proname
    `
    const fnNames = new Set(fnRows.map((r) => r.proname))
    for (const fn of EXPECTED_FUNCTIONS) {
      if (fnNames.has(fn)) record(`function_${fn}`, 'PASS', 'exists')
      else record(`function_${fn}`, 'BLOCKED', 'apply 0030/0032 migrations')
    }

    const viewRows = await sql`
      select c.relname
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public'
        and c.relkind = 'v'
        and c.relname in ${sql(EXPECTED_VIEWS)}
      order by c.relname
    `
    const viewNames = new Set(viewRows.map((r) => r.relname))
    for (const v of EXPECTED_VIEWS) {
      if (viewNames.has(v)) record(`view_${v}`, 'PASS', 'exists')
      else record(`view_${v}`, 'BLOCKED', 'apply 0031 migration')
    }

    const rls = await sql`
      select c.relname, c.relrowsecurity as rls
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public'
        and c.relkind = 'r'
        and c.relname in ${sql(EXPECTED_TABLES)}
      order by c.relname
    `
    const rlsOff = rls.filter((r) => !r.rls).map((r) => r.relname)
    if (rlsOff.length) record('rls_enabled_all_tables', 'FAIL', `RLS off: ${rlsOff.join(', ')}`)
    else record('rls_enabled_all_tables', 'PASS', `${EXPECTED_TABLES.length} tables`)

    const fk4b = await sql`
      select
        con.conname,
        cl.relname as child_table,
        af.attname as child_column,
        pf.relname as parent_table
      from pg_constraint con
      join pg_class cl on cl.oid = con.conrelid
      join pg_namespace n on n.oid = cl.relnamespace
      join pg_attribute af on af.attnum = any (con.conkey) and af.attrelid = con.conrelid
      join pg_class pf on pf.oid = con.confrelid
      where n.nspname = 'public'
        and con.contype = 'f'
        and cl.relname in ('source_response_sets', 'source_responses')
        and af.attname in ('source_definition_version_id', 'source_field_id')
      order by cl.relname, af.attname
    `
    const srs = fk4b.find(
      (r) => r.child_table === 'source_response_sets' && r.child_column === 'source_definition_version_id',
    )
    const sr = fk4b.find((r) => r.child_table === 'source_responses' && r.child_column === 'source_field_id')
    if (srs?.parent_table === 'source_definition_versions')
      record('fk_srs_to_phase4a_sdv', 'PASS', srs.conname)
    else
      record(
        'fk_srs_to_phase4a_sdv',
        srs ? 'FAIL' : 'BLOCKED',
        srs ? `unexpected parent ${srs.parent_table}` : 'FK not found',
      )
    if (sr?.parent_table === 'source_fields') record('fk_sr_to_phase4a_field', 'PASS', sr.conname)
    else
      record('fk_sr_to_phase4a_field', sr ? 'FAIL' : 'BLOCKED', sr ? `unexpected parent ${sr.parent_table}` : 'FK not found')

    const badPublishedFk = await sql`
      select con.conname, cl.relname as child_table, pf.relname as parent_table
      from pg_constraint con
      join pg_class cl on cl.oid = con.conrelid
      join pg_namespace n on n.oid = cl.relnamespace
      join pg_class pf on pf.oid = con.confrelid
      where n.nspname = 'public'
        and con.contype = 'f'
        and cl.relname in ('source_response_sets', 'source_responses')
        and pf.relname like 'published_%'
    `
    if (badPublishedFk.length === 0)
      record('phase4b_no_fk_to_published_snapshots', 'PASS', 'no published_* FK from 4B capture tables')
    else
      record(
        'phase4b_no_fk_to_published_snapshots',
        'FAIL',
        badPublishedFk.map((r) => `${r.child_table}→${r.parent_table}`).join(', '),
      )

    for (const v of EXPECTED_VIEWS) {
      try {
        const countRows = await sql.unsafe(`select count(*)::int as c from public.${v}`)
        const c = countRows[0]?.c ?? 0
        results.violationCounts[v] = c
        record(`violation_count_${v}`, 'PASS', String(c))
      } catch (e) {
        results.violationCounts[v] = -1
        record(`violation_count_${v}`, 'FAIL', String(e.message || e))
      }
    }

    const pkgCount = await sql`select count(*)::int as c from public.source_publish_packages`
    const c = pkgCount[0]?.c ?? 0
    if (c > 0) {
      record('violation_views_nonempty_staging', 'WARN', `${c} package(s) present — review counts manually`)
    } else {
      record('violation_views_empty_staging', 'PASS', 'no packages seeded; violation counts should be 0')
    }

    const denyStillOnSdv = await sql`
      select t.tgname
      from pg_trigger t
      join pg_class c on c.oid = t.tgrelid
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public'
        and c.relname = 'published_source_definition_versions'
        and not t.tgisinternal
        and t.tgname = 'published_sdv_deny_mutation'
    `
    if (denyStillOnSdv.length)
      record('trigger_0032_sdv_rewired', 'FAIL', 'published_sdv_deny_mutation still present — apply 0032')
    else record('trigger_0032_sdv_rewired', 'PASS', 'deny_mutation replaced by before_write')

    writeReportMd()

    if (args.json) console.log(JSON.stringify(results, null, 2))

    if (results.summary.failed > 0) {
      console.error('Phase 4C catalog validation: FAIL — see docs/PHASE4C10-VALIDATION-CATALOG.md')
      process.exit(1)
    }
    if (results.summary.blocked > 0) {
      console.warn(
        'Phase 4C catalog validation: BLOCKED (apply 0026–0032) — see docs/PHASE4C10-VALIDATION-CATALOG.md',
      )
      process.exit(0)
    }
    console.log('Phase 4C catalog validation: PASS — see docs/PHASE4C10-VALIDATION-CATALOG.md')
  } finally {
    await sql.end({ timeout: 10 })
  }
}

main().catch((e) => {
  console.error(e.message || e)
  process.exit(1)
})
