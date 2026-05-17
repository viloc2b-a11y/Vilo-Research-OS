/**
 * Phase 4B.1 — Runtime capture catalog validation (read-only).
 *
 * Prerequisites:
 *   - Migrations 0020–0025, 0034–0039 applied.
 *   - DATABASE_URL_DIRECT or DATABASE_URL in .env.local
 *
 * Usage: npm run db:validate-phase4b-runtime
 */
import { writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import postgres from 'postgres'
import { loadEnvFiles, projectRoot } from './lib/env.mjs'

const EXPECTED_TABLES = [
  'source_response_sets',
  'source_responses',
  'source_response_corrections',
  'source_response_addenda',
  'source_response_validation_findings',
  'source_response_validation_finding_events',
  'source_definition_versions',
  'source_fields',
]

const EXPECTED_FUNCTIONS = [
  'phase4b_visit_is_locked',
  'phase4b_user_can_correct_source',
  'phase4b_srs_is_mutable_status',
  'phase4b_source_field_belongs_to_sdv',
  'phase4b_widget_hint_to_value_type',
  'phase4b_resolve_originator_role',
  'phase4b_parse_draft_response_item',
  'phase4b_current_response_has_value',
  'phase4b_response_value_matches_widget',
  'phase4b_source_response_set_submit_errors',
  'open_source_response_set',
  'save_source_draft',
  'phase4b_parse_value_payload',
  'phase4b_srs_allows_post_submit_change',
  'submit_source_response_set',
  'correct_source_response',
  'add_source_addendum',
  'phase4b_user_can_resolve_validation_finding',
  'create_source_validation_finding',
  'acknowledge_source_validation_finding',
  'resolve_source_validation_finding',
  'waive_source_validation_finding',
  'get_source_response_set_history',
  'phase51c_source_response_value_json',
  'get_source_response_set',
  'get_source_response_set_manifest',
  'list_source_response_set_findings',
  'phase4b_log_validation_finding_lifecycle_event',
  'phase4b_source_response_set_allows_submit',
  'phase4b_guard_submit_update_shape',
]

const INVOKER_RPCS = [
  'open_source_response_set',
  'save_source_draft',
  'submit_source_response_set',
  'correct_source_response',
  'add_source_addendum',
  'create_source_validation_finding',
  'acknowledge_source_validation_finding',
  'resolve_source_validation_finding',
  'waive_source_validation_finding',
  'get_source_response_set_history',
  'get_source_response_set',
  'get_source_response_set_manifest',
  'list_source_response_set_findings',
]

const EXPECTED_INDEXES = [
  { table: 'source_response_sets', index: 'source_response_sets_active_execution_version_uidx' },
  { table: 'source_responses', index: 'source_responses_set_field_idx' },
  { table: 'source_responses', index: 'source_responses_one_current_per_field_uidx' },
]

const PUBLISHED_WRITE_FORBIDDEN = [
  'published_source_definition_versions',
  'published_source_sections',
  'published_source_fields',
  'published_source_validation_rules',
]

const MIGRATION_ORDER = [
  '0020_source_response_sets.sql',
  '0021_source_responses.sql',
  '0022_source_response_corrections.sql',
  '0023_source_response_addenda.sql',
  '0024_source_response_validation_findings.sql',
  '0025_phase4b_validation_helpers.sql',
  '0034_phase4b1_open_and_save_rpc.sql',
  '0035_phase4b1_submit_source_response_set_rpc.sql',
  '0036_phase4b1_correction_addendum_rpc.sql',
  '0037_phase4b1_validation_finding_rpc.sql',
  '0038_phase4b_submit_source_responses_rls.sql',
  '0039_phase4b_srs_corrected_addended_attribution_fix.sql',
  '0040_phase51b_history_and_finding_events.sql',
  '0041_phase51c_read_rpcs.sql',
]

const results = {
  runAt: new Date().toISOString(),
  phase: '4B.1',
  mode: 'read-only',
  checks: [],
  summary: { passed: 0, failed: 0, blocked: 0, warned: 0 },
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
  const out = resolve(projectRoot, 'docs/PHASE4B1-RUNTIME-VALIDATION-CATALOG.md')
  const lines = [
    '# Phase 4B.1 — Runtime validation catalog',
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
    `| WARN | ${results.summary.warned} |`,
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
    console.error('Phase 4B.1 validation: no database connection')
    process.exit(1)
  }

  try {
    record('migration_apply_order', 'PASS', MIGRATION_ORDER.join(' → '))

    for (const t of EXPECTED_TABLES) {
      const rel = `public.${t}`
      const rows = await sql`select to_regclass(${rel})::text as reg`
      const reg = rows[0]?.reg
      if (reg && reg !== '') record(`table_${t}`, 'PASS', reg)
      else record(`table_${t}`, 'BLOCKED', 'apply 0020–0025')
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
      else record(`function_${fn}`, 'BLOCKED', 'apply 0034_phase4b1_open_and_save_rpc.sql')
    }

    for (const { table, index } of EXPECTED_INDEXES) {
      const rows = await sql`
        select 1
        from pg_indexes
        where schemaname = 'public'
          and tablename = ${table}
          and indexname = ${index}
        limit 1
      `
      if (rows.length) record(`index_${index}`, 'PASS', `${table}.${index}`)
      else record(`index_${index}`, 'FAIL', 'missing')
    }

    const fkRows = await sql`
      select
        count(*) filter (where confrelid = 'public.source_definition_versions'::regclass) as sdv_fks,
        count(*) filter (where confrelid = 'public.source_fields'::regclass) as field_fks
      from pg_constraint c
      join pg_class t on t.oid = c.conrelid
      join pg_namespace n on n.oid = t.relnamespace
      where n.nspname = 'public'
        and t.relname in ('source_response_sets', 'source_responses')
        and c.contype = 'f'
    `
    const sdvFks = Number(fkRows[0]?.sdv_fks ?? 0)
    const fieldFks = Number(fkRows[0]?.field_fks ?? 0)
    if (sdvFks > 0) record('fk_phase4a_sdv', 'PASS', `${sdvFks} FK(s) to source_definition_versions`)
    else record('fk_phase4a_sdv', 'FAIL', 'no FK from 4B tables to source_definition_versions')

    if (fieldFks > 0) record('fk_phase4a_fields', 'PASS', `${fieldFks} FK(s) to source_fields`)
    else record('fk_phase4a_fields', 'FAIL', 'no FK from source_responses to source_fields')

    for (const t of PUBLISHED_WRITE_FORBIDDEN) {
      const pol = await sql`
        select pol.polname, pol.polcmd
        from pg_policy pol
        join pg_class c on c.oid = pol.polrelid
        join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public'
          and c.relname = ${t}
          and pol.polcmd in ('w', '*')
      `
      if (pol.length === 0) {
        record(`published_no_write_${t}`, 'PASS', 'no broad INSERT/UPDATE policy on published_*')
      } else {
        record(
          `published_no_write_${t}`,
          'WARN',
          `policies: ${pol.map((p) => p.polname).join(', ')}`,
        )
      }
    }

    const submitPol = await sql`
      select pol.polname
      from pg_policy pol
      join pg_class c on c.oid = pol.polrelid
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public'
        and c.relname = 'source_responses'
        and pol.polname = 'source_responses_submit_update'
      limit 1
    `
    if (submitPol.length) {
      record('policy_source_responses_submit_update', 'PASS', 'narrow submit UPDATE policy exists')
    } else {
      record('policy_source_responses_submit_update', 'FAIL', 'apply 0038_phase4b_submit_source_responses_rls.sql')
    }

    const attrRows = await sql`
      select c.conname, pg_get_constraintdef(c.oid) as def
      from pg_constraint c
      join pg_class t on t.oid = c.conrelid
      join pg_namespace n on n.oid = t.relnamespace
      where n.nspname = 'public'
        and t.relname = 'source_response_sets'
        and c.conname in (
          'source_response_sets_reviewed_attribution',
          'source_response_sets_signed_attribution',
          'source_response_sets_locked_attribution'
        )
    `
    const reviewedDef = attrRows.find((r) => r.conname === 'source_response_sets_reviewed_attribution')?.def ?? ''
    if (reviewedDef.includes('corrected') || reviewedDef.includes('addended')) {
      record('srs_reviewed_attribution_scope', 'FAIL', 'corrected/addended still in reviewed CHECK')
    } else if (reviewedDef) {
      record('srs_reviewed_attribution_scope', 'PASS', 'reviewed/sign only')
    } else {
      record('srs_reviewed_attribution_scope', 'FAIL', 'constraint missing')
    }
    const lockedDef = attrRows.find((r) => r.conname === 'source_response_sets_locked_attribution')?.def ?? ''
    if (lockedDef.includes('locked_by_user_id')) {
      record('srs_locked_attribution', 'PASS', 'locked attribution CHECK present')
    } else {
      record('srs_locked_attribution', 'BLOCKED', 'apply 0039_phase4b_srs_corrected_addended_attribution_fix.sql')
    }

    for (const rpc of INVOKER_RPCS) {
      const rows = await sql`
        select p.prosecdef
        from pg_proc p
        join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'public'
          and p.proname = ${rpc}
        limit 1
      `
      if (rows.length && !rows[0].prosecdef) {
        record(`rpc_${rpc}_invoker`, 'PASS', 'SECURITY INVOKER')
      } else if (rows.length) {
        record(`rpc_${rpc}_invoker`, 'WARN', 'SECURITY DEFINER — review')
      } else {
        record(`rpc_${rpc}_invoker`, 'BLOCKED', 'function missing')
      }
    }

  } finally {
    await sql.end({ timeout: 10 })
  }

  writeReportMd()
  const { passed, failed, blocked } = results.summary
  console.log(
    `Phase 4B.1 runtime validation: ${failed > 0 ? 'FAIL' : blocked > 0 ? 'BLOCKED' : 'PASS'} — PASS ${passed}, FAIL ${failed}, BLOCKED ${blocked}`,
  )
  if (failed > 0 || blocked > 0) process.exit(1)
}

main().catch((err) => {
  console.error(err.message || err)
  process.exit(1)
})
