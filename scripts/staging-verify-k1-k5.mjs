/**
 * Verify (and optionally apply) K1–K5 migrations 0122–0134 against DATABASE_URL.
 *
 * Usage:
 *   node scripts/staging-verify-k1-k5.mjs           # verify only
 *   node scripts/staging-verify-k1-k5.mjs --apply   # apply from 0122 if missing
 */
import { readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import postgres from 'postgres'
import { loadEnvFiles, projectRoot } from './lib/env.mjs'

/** Minimum migrations before 0122 can apply (document intake + runtime source spine). */
const K1_K5_PREREQUISITE_MIGRATION = '0106_document_intake_compliance_runtime.sql'

const K1_K5_MIGRATIONS = [
  '0122_document_intelligence_ingestion.sql',
  '0123_document_intelligence_trgm_search.sql',
  '0124_document_intelligence_domains.sql',
  '0125_source_blueprint_evidence.sql',
  '0126_source_blueprint_evidence_lineage.sql',
  '0127_document_intelligence_version_control.sql',
  '0128_document_intelligence_ingest_safeguards.sql',
  '0129_document_intelligence_active_reference_atomic.sql',
  '0130_document_intelligence_k2_closure_alignment.sql',
  '0131_source_blueprint_draft_suggestions.sql',
  '0132_source_blueprint_signoff_audit_export.sql',
  '0133_operational_signature_runtime.sql',
  '0134_operational_signature_runtime_hardening.sql',
]

const PREREQUISITE_TABLES = [
  'studies',
  'organizations',
  'compliance_runtime_documents',
  'runtime_source_package_publications',
]

const REQUIRED_TABLES = [
  'document_intelligence_documents',
  'document_intelligence_chunks',
  'source_blueprint_evidence',
  'source_blueprint_draft_suggestions',
  'source_blueprint_draft_signoffs',
  'operational_signature_requests',
  'operational_signatures',
  'operational_signature_events',
]

const APPLY = process.argv.includes('--apply')

function pickUrl() {
  return process.env.DATABASE_URL_DIRECT?.trim() || process.env.DATABASE_URL?.trim()
}

async function main() {
  loadEnvFiles()
  const url = pickUrl()
  if (!url) {
    console.error('Missing DATABASE_URL in .env.local')
    process.exit(1)
  }

  const sql = postgres(url, { ssl: 'require', max: 1, prepare: false })

  try {
    const extensions = await sql`
      select extname from pg_extension where extname in ('vector', 'pg_trgm')
    `
    const extSet = new Set(extensions.map((r) => r.extname))
    console.log('Extensions:', [...extSet].join(', ') || '(none)')

    let applied = []
    try {
      applied = await sql`
        select version, name from supabase_migrations.schema_migrations
        where version >= '0122'
        order by version
      `
    } catch {
      console.log('schema_migrations: unavailable (manual table checks only)')
    }

    if (applied.length) {
      console.log('\nApplied migrations (>= 0122):')
      for (const row of applied) console.log(`  ${row.version} ${row.name}`)
    }

    const checkTables = [...PREREQUISITE_TABLES, ...REQUIRED_TABLES]
    const tables = await sql`
      select tablename from pg_tables
      where schemaname = 'public'
        and tablename = any(${checkTables})
      order by tablename
    `
    const tableSet = new Set(tables.map((r) => r.tablename))
    console.log('\nPrerequisite tables:')
    for (const t of PREREQUISITE_TABLES) {
      console.log(`  ${tableSet.has(t) ? 'OK' : 'MISSING'} ${t}`)
    }
    console.log('\nK1–K5 tables:')
    for (const t of REQUIRED_TABLES) {
      console.log(`  ${tableSet.has(t) ? 'OK' : 'MISSING'} ${t}`)
    }

    const triggers = await sql`
      select tgname from pg_trigger
      where tgname ilike '%operational_signature%'
         or tgname ilike '%source_blueprint_evidence%'
      limit 20
    `
    console.log('\nSample triggers:', triggers.map((r) => r.tgname).join(', ') || '(none)')

    const pendingIdx = await sql`
      select indexname from pg_indexes
      where indexname ilike '%operational_signature%pending%'
    `
    console.log('Duplicate pending index:', pendingIdx.map((r) => r.indexname).join(', ') || '(none)')

    const prereqOk = PREREQUISITE_TABLES.every((t) => tableSet.has(t))
    const allTablesOk = REQUIRED_TABLES.every((t) => tableSet.has(t))
    const extOk = extSet.has('vector') && extSet.has('pg_trgm')

    if (!prereqOk) {
      console.log(
        `\nPrerequisite migrations required before 0122 (apply from ${K1_K5_PREREQUISITE_MIGRATION} or earlier spine).`,
      )
    }

    if (!allTablesOk && APPLY) {
      if (!prereqOk) {
        console.error('\nAPPLY blocked: prerequisite tables missing. Run full spine migrate first.')
        process.exit(1)
      }
      console.log('\nApplying migrations 0122–0134…')
      const migrationsDir = resolve(projectRoot, 'supabase/migrations')
      for (const file of K1_K5_MIGRATIONS) {
        const body = readFileSync(resolve(migrationsDir, file), 'utf8')
        console.log(`  Applying ${file}…`)
        await sql.unsafe(body)
        console.log(`  OK ${file}`)
      }
    } else if (!allTablesOk) {
      console.log('\nTables missing. Re-run with --apply after staging backup.')
    }

    if (!allTablesOk || !extOk) {
      console.error('\nVERIFY: FAIL — run with --apply after backup if tables missing')
      process.exit(1)
    }

    console.log('\nVERIFY: PASS (tables + extensions present)')
  } finally {
    await sql.end({ timeout: 10 })
  }
}

main().catch((err) => {
  console.error(err.message || err)
  process.exit(1)
})
