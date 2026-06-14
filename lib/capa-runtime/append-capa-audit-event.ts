import type { SupabaseClient } from '@supabase/supabase-js'
import type { CapaAuditEvent } from './capa-audit-types'
import { mapCapaAuditEventRow } from './capa-audit-types'

export async function appendCapaAuditEvent(
  supabase: SupabaseClient,
  args: {
    organizationId: string
    capaId: string
    fromStatus: string
    toStatus: string
    changedBy: string
    note: string | null
  },
): Promise<CapaAuditEvent> {
  const { data, error } = await supabase
    .from('capa_audit_events')
    .insert({
      organization_id: args.organizationId,
      capa_id: args.capaId,
      from_status: args.fromStatus,
      to_status: args.toStatus,
      changed_by: args.changedBy,
      note: args.note,
    })
    .select('*')
    .single()

  if (error) throw new Error(`appendCapaAuditEvent: ${error.message}`)
  return mapCapaAuditEventRow(data as Record<string, unknown>)
}
