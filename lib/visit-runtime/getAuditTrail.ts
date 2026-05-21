import { fetchResponseSetDetail } from '@/lib/api/source/read-client'
import { activeMemberships } from '@/lib/auth/membership-access'
import { getOrganizationMemberships, getSessionUser } from '@/lib/auth/session'
import { filterUnblindedRows, redactUnblindedPayload } from '@/lib/rbac/blinding'
import { formatValuePayload } from '@/lib/source/read-contract/format'
import type { VisitRuntimeAuditEntry } from '@/lib/subject/visit-runtime/types'
import type { createServerClient } from '@/lib/supabase/server'

type Supabase = Awaited<ReturnType<typeof createServerClient>>

export async function getAuditTrail(params: {
  supabase: Supabase
  procedureExecutionId: string
  organizationId: string
  responseSetId: string
}) {
  const entries: VisitRuntimeAuditEntry[] = []
  const detail = await fetchResponseSetDetail(params.responseSetId, params.organizationId)
  if (detail.ok && detail.data) {
    for (const field of detail.data.fields) {
      const history = field.history ?? []
      for (let i = 0; i < history.length; i += 1) {
        const current = history[i]
        const previous = history[i + 1]
        entries.push({
          id: current.response_id,
          fieldLabel: field.field_key,
          previousValue: previous ? formatValuePayload(previous.raw_value) : null,
          newValue: formatValuePayload(current.raw_value),
          changedBy: current.originator_user_id ?? null,
          changedAt: current.captured_at,
          eventType: current.is_submitted ? 'submitted_value' : 'draft_value',
          isCorrection: Boolean(current.supersedes_response_id),
          isAddendum: false,
        })
      }
    }
  }

  const { data: operational } = await params.supabase
    .from('operational_events')
    .select('id, payload, actor_user_id, occurred_at, event_type')
    .eq('procedure_execution_id', params.procedureExecutionId)
    .eq('organization_id', params.organizationId)
    .order('occurred_at', { ascending: false })

  const user = await getSessionUser()
  const memberships = user ? await getOrganizationMemberships(user.id) : []
  const scopedMemberships = activeMemberships(memberships).filter(
    (membership) => membership.organization_id === params.organizationId,
  )
  const filteredOperational = filterUnblindedRows(
    ((operational ?? []) as Array<{
      id: string
      payload: Record<string, unknown> | null
      actor_user_id: string | null
      occurred_at: string
      event_type: string
    }>),
    scopedMemberships,
  )

  for (const row of filteredOperational) {
    const payload = redactUnblindedPayload(row.payload, scopedMemberships) ?? {}
    const eventType = row.event_type as string
    const label =
      (payload.field_label as string | null) ??
      eventType.replace(/_/g, ' ').toLowerCase()
    entries.push({
      id: row.id as string,
      fieldLabel: label,
      previousValue:
        payload.previous_value == null
          ? (payload.note_preview as string | null) ?? null
          : String(payload.previous_value),
      newValue:
        payload.new_value == null
          ? (payload.validation_status as string | null) ??
            (payload.title as string | null) ??
            null
          : String(payload.new_value),
      changedBy: (row.actor_user_id as string | null) ?? null,
      changedAt: row.occurred_at as string,
      eventType,
      isCorrection: Boolean(payload.is_correction),
      isAddendum: Boolean(payload.is_addendum),
    })
  }

  return entries.sort((a, b) => b.changedAt.localeCompare(a.changedAt))
}
