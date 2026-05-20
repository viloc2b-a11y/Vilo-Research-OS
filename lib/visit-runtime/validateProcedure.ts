import { fetchResponseSetDetail } from '@/lib/api/source/read-client'
import { formatValuePayload } from '@/lib/source/read-contract/format'
import type {
  ValidationStatus,
  VisitRuntimeValidationAlert,
} from '@/lib/subject/visit-runtime/types'
import type { createServerClient } from '@/lib/supabase/server'

type Supabase = Awaited<ReturnType<typeof createServerClient>>

function hasValue(value: unknown) {
  if (value == null) return false
  if (typeof value === 'string') return value.trim().length > 0
  if (typeof value === 'object') return Object.keys(value as Record<string, unknown>).length > 0
  return true
}

function statusFromAlerts(alerts: VisitRuntimeValidationAlert[]): ValidationStatus {
  if (alerts.some((a) => a.severity === 'blocked')) return 'blocked'
  if (alerts.some((a) => a.severity === 'warning')) return 'warning'
  if (alerts.length > 0) return 'incomplete'
  return 'clean'
}

export async function validateProcedure(params: {
  supabase: Supabase
  procedureExecutionId: string
  organizationId: string
  responseSetId?: string | null
}) {
  const responseSetId =
    params.responseSetId ??
    (
      await params.supabase
        .from('source_response_sets')
        .select('id')
        .eq('procedure_execution_id', params.procedureExecutionId)
        .order('opened_at', { ascending: false })
        .limit(1)
        .maybeSingle()
    ).data?.id ??
    null

  const alerts: VisitRuntimeValidationAlert[] = []
  if (!responseSetId) {
    alerts.push({
      id: 'no-response-set',
      severity: 'blocked',
      message: 'No response set exists for this procedure.',
    })
    return { status: 'blocked' as ValidationStatus, alerts, responseSetId: null }
  }

  const detail = await fetchResponseSetDetail(responseSetId as string, params.organizationId)
  if (!detail.ok || !detail.data) {
    alerts.push({
      id: 'read-contract',
      severity: 'blocked',
      message: 'Could not load persisted source values for validation.',
    })
    return { status: 'blocked' as ValidationStatus, alerts, responseSetId: responseSetId as string }
  }

  for (const field of detail.data.fields) {
    const current = field.current_effective
    if (field.is_required && (!current || !hasValue(current.value))) {
      alerts.push({
        id: `required-${field.source_field_id}`,
        severity: 'blocked',
        fieldLabel: field.field_key,
        message: `${field.field_key} is required.`,
      })
    }
    if (current?.value && typeof current.value === 'object') {
      const display = formatValuePayload(current.value)
      if (display.length > 4000) {
        alerts.push({
          id: `large-${field.source_field_id}`,
          severity: 'warning',
          fieldLabel: field.field_key,
          message: `${field.field_key} has an unusually large value.`,
        })
      }
    }
  }

  const { data: findings } = await params.supabase
    .from('source_response_validation_findings')
    .select('id, severity, message, status')
    .eq('response_set_id', responseSetId as string)
    .in('status', ['open', 'acknowledged'])

  for (const finding of findings ?? []) {
    alerts.push({
      id: finding.id as string,
      severity: finding.severity === 'error' ? 'blocked' : 'warning',
      message: finding.message as string,
    })
  }

  const status = statusFromAlerts(alerts)
  return { status, alerts, responseSetId: responseSetId as string }
}

