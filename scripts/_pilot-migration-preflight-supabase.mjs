import { createClient } from '@supabase/supabase-js'
import { loadEnvFiles } from './lib/env.mjs'

loadEnvFiles()
const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) {
  console.error(JSON.stringify({ ok: false, error: 'Supabase env missing' }))
  process.exit(1)
}

const supabase = createClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const requiredGov = [
  'source_integrity_snapshot',
  'source_integrity_violation',
  'workflow_abandonment_review',
  'role_conflict_resolution',
]

async function tableExists(table) {
  const { error } = await supabase.from(table).select('id').limit(1)
  if (!error) return true
  if (error.code === '42P01' || error.message?.includes('does not exist')) return false
  return 'unknown'
}

const snapshots = await tableExists('source_response_field_snapshots')
const checkpoints = await tableExists('workflow_activity_checkpoints')
const gov = await tableExists('workflow_decision_authorities')

let govKeys = []
if (gov === true) {
  const { data } = await supabase
    .from('workflow_decision_authorities')
    .select('workflow_key')
    .is('organization_id', null)
    .in('workflow_key', requiredGov)
  govKeys = (data ?? []).map((r) => r.workflow_key).sort()
}

const { count: snapshotCount } = await supabase
  .from('source_response_field_snapshots')
  .select('id', { count: 'exact', head: true })

const { data: telemetry } = await supabase
  .from('workflow_telemetry_events')
  .select('signal, workflow_key, created_at')
  .in('signal', [
    'source_field_snapshot_captured',
    'source_integrity_violation_detected',
    'workflow_stale_alert',
    'role_conflict_detected',
  ])
  .order('created_at', { ascending: false })
  .limit(5)

console.log(
  JSON.stringify(
    {
      ok: snapshots === true && checkpoints === true && gov === true && govKeys.length === 4,
      tables: {
        source_response_field_snapshots: snapshots,
        workflow_activity_checkpoints: checkpoints,
        workflow_decision_authorities: gov,
      },
      gov1AuditWorkflows: govKeys,
      missingGovWorkflows: requiredGov.filter((k) => !govKeys.includes(k)),
      snapshotRowCount: snapshotCount ?? 0,
      recentAuditTelemetry: telemetry ?? [],
      note:
        'schema_migrations check requires DATABASE_URL to staging Postgres; use db:migrate if tables missing.',
    },
    null,
    2,
  ),
)

process.exit(
  snapshots === true && checkpoints === true && gov === true && govKeys.length === 4 ? 0 : 1,
)
