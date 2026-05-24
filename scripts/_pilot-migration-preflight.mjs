import postgres from 'postgres'
import { loadEnvFiles } from './lib/env.mjs'

loadEnvFiles()
const url = process.env.DATABASE_URL_DIRECT?.trim() || process.env.DATABASE_URL?.trim()
if (!url) {
  console.error(JSON.stringify({ ok: false, error: 'DATABASE_URL not set' }))
  process.exit(1)
}

const sql = postgres(url, { ssl: 'require', max: 1 })

const required = [
  '0082_phase16a1_ai_governance_foundation.sql',
  '0083_phase16_gov1_workflow_decision_authority.sql',
  '0084_phase16_gov1_workflow_key_immutability.sql',
  '0085_phase16a2_runtime_observability_schema.sql',
  '0086_phase16a25_pilot_compliance_guardrails.sql',
  '0087_phase16a26_gov1_extension.sql',
  '0088_phase16a26_source_integrity.sql',
]
const oldConflict = '0087_phase16a26_pilot_audit_integrity_guardrails.sql'

const rows = await sql`
  select name from supabase_migrations.schema_migrations
  where name like '008%'
  order by name
`
const applied = new Set(rows.map((r) => r.name))
const missing = required.filter((n) => !applied.has(n))
const hasOldConflict = applied.has(oldConflict)

const [tables] = await sql`
  select
    to_regclass('public.source_response_field_snapshots') is not null as snapshots_table,
    to_regclass('public.workflow_activity_checkpoints') is not null as checkpoints_table,
    to_regclass('public.role_conflict_policies') is not null as role_policies_table,
    exists (select 1 from pg_proc where proname = 'block_source_snapshot_updates') as immutability_fn
`

const govRows = await sql`
  select workflow_key from public.workflow_decision_authorities
  where organization_id is null
    and workflow_key in (
      'source_integrity_snapshot',
      'source_integrity_violation',
      'workflow_abandonment_review',
      'role_conflict_resolution'
    )
  order by workflow_key
`

console.log(
  JSON.stringify(
    {
      ok: missing.length === 0 && !hasOldConflict && tables.snapshots_table,
      missingMigrations: missing,
      hasOldConflictMigration: hasOldConflict,
      appliedPhase16Migrations: [...applied].filter((n) => n.startsWith('008')),
      tables,
      gov1AuditWorkflows: govRows.map((r) => r.workflow_key),
    },
    null,
    2,
  ),
)

await sql.end()
process.exit(missing.length === 0 && !hasOldConflict && tables.snapshots_table ? 0 : 1)
