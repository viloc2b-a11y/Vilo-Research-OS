import { SupabaseClient } from '@supabase/supabase-js'

export type DeliverableAuditAction = 
  | 'run_created'
  | 'run_started'
  | 'run_completed'
  | 'run_failed'
  | 'artifact_downloaded'

interface LogDeliverableAuditEventParams {
  supabase: SupabaseClient
  runId: string
  action: DeliverableAuditAction
  actorId: string
  metadata?: Record<string, unknown>
}

export async function logDeliverableAuditEvent({
  supabase,
  runId,
  action,
  actorId,
  metadata = {},
}: LogDeliverableAuditEventParams) {
  const { error } = await supabase.from('deliverable_audit_events').insert({
    run_id: runId,
    action,
    actor_id: actorId,
    metadata,
  })

  if (error) {
    console.error(`Failed to log deliverable audit event for run ${runId}:`, error)
    // Non-blocking in this foundation, but should be alerted
  }
}
