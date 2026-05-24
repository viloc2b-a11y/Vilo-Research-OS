import { createClient } from '@supabase/supabase-js'
import { loadEnvFiles } from './lib/env.mjs'
import { collectTelemetryMetadataIssues } from '../lib/observability/redact-telemetry-metadata.ts'

loadEnvFiles()
const s = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
)

const ORG = 'f7cf7d2b-49cd-4bcd-9e15-2675966c3e1e'
const PE = 'c022a7f6-3bc1-4b81-a19f-8075a4e3a1dc'

const { data: rs } = await s
  .from('source_response_sets')
  .select('id, status, submitted_at')
  .eq('procedure_execution_id', PE)
  .order('created_at', { ascending: false })
  .limit(1)
  .maybeSingle()

const { data: snaps, count } = await s
  .from('source_response_field_snapshots')
  .select('id, field_key, snapshot_type, snapshot_version, field_value_hash, captured_at', {
    count: 'exact',
  })
  .eq('source_response_set_id', rs?.id ?? '')
  .order('captured_at', { ascending: false })
  .limit(15)

const { data: events } = await s
  .from('operational_events')
  .select('event_type, created_at')
  .eq('organization_id', ORG)
  .in('event_type', [
    'SOURCE_FIELD_SNAPSHOT_CAPTURED',
    'SOURCE_INTEGRITY_VIOLATION_DETECTED',
    'SOURCE_RESPONSE_SET_SUBMITTED',
  ])
  .order('created_at', { ascending: false })
  .limit(15)

const { data: telemetry } = await s
  .from('workflow_telemetry_events')
  .select('signal, workflow_key, metadata, created_at')
  .eq('organization_id', ORG)
  .order('created_at', { ascending: false })
  .limit(30)

const auditSignals = (telemetry ?? []).filter((t) =>
  [
    'source_field_snapshot_captured',
    'source_integrity_violation_detected',
    'workflow_stale_alert',
    'role_conflict_detected',
    'source_response_set_submitted',
  ].includes(t.signal),
)

const phiIssues = []
for (const t of auditSignals.slice(0, 10)) {
  const issues = collectTelemetryMetadataIssues(t.metadata ?? {})
  if (issues.length) phiIssues.push({ signal: t.signal, issues })
}

const { count: roleCount } = await s
  .from('role_conflict_events')
  .select('id', { count: 'exact', head: true })
  .eq('organization_id', ORG)

const { count: bgCount } = await s
  .from('break_glass_access_events')
  .select('id', { count: 'exact', head: true })
  .eq('organization_id', ORG)

const { data: pe } = await s
  .from('procedure_executions')
  .select('is_signed, validation_status')
  .eq('id', PE)
  .maybeSingle()

console.log(
  JSON.stringify(
    {
      responseSet: rs,
      snapshotCount: count,
      snapshotsSample: snaps,
      operationalEvents: events,
      auditTelemetry: auditSignals.map((t) => ({
        signal: t.signal,
        workflow_key: t.workflow_key,
        at: t.created_at,
      })),
      phiIssuesInTelemetry: phiIssues,
      roleConflictEventCount: roleCount,
      breakGlassEventCount: bgCount,
      procedure: pe,
    },
    null,
    2,
  ),
)
