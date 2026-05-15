import { createServiceClient } from '@/lib/supabase/server'

export type AuditEventInput = {
  organizationId: string | null
  actorUserId: string
  action: string
  target: string
  metadata?: Record<string, unknown>
  ip?: string | null
}

/**
 * Inserts an audit row using the service role. Failures are logged and not thrown
 * so primary clinical workflows are not blocked (per Verdent audit module guidance).
 */
export async function logAuditEvent(input: AuditEventInput): Promise<void> {
  try {
    const supabase = await createServiceClient()

    const { error } = await supabase.from('audit_events').insert({
      organization_id: input.organizationId,
      actor_user_id: input.actorUserId,
      action: input.action,
      target: input.target,
      metadata: input.metadata ?? {},
      ip: input.ip ?? null,
    })

    if (error) {
      console.error('logAuditEvent failed', error.message)
    }
  } catch (err) {
    console.error('logAuditEvent exception', err)
  }
}
