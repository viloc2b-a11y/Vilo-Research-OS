import type { PerformanceQueryScope, RawSignal } from '@/lib/performance/types'
import type { SupabaseServerClient } from '@/lib/performance/read-layer/query/supabase-client'

export type SafetySignalRow = Record<string, unknown>

export type SafetyClockSignals = {
  safetyClocks: RawSignal<SafetySignalRow>
}

export async function loadSafetyClockSignals(
  client: SupabaseServerClient,
  scope: PerformanceQueryScope,
): Promise<SafetyClockSignals> {
  const today = new Date().toISOString().slice(0, 10)
  const warningThreshold = new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10)

  if (scope.studyIds.length === 0) {
    return { safetyClocks: { source: 'safety_events', rows: [], error: null } }
  }

  const { data, error } = await client
    .from('safety_events')
    .select(
      'id, organization_id, study_id, subject_id, event_type, event_status, severity, reporting_deadline_date, sponsor_notification_required, sponsor_notified_at, opened_at',
    )
    .in('study_id', scope.studyIds)
    .eq('event_type', 'sae')
    .not('event_status', 'eq', 'closed')
    .limit(200)

  if (error) {
    return { safetyClocks: { source: 'safety_events', rows: [], error: { source: 'safety_events', message: error.message } } }
  }

  const rows: SafetySignalRow[] = []
  const now = new Date()

  for (const row of data ?? []) {
    const reportingDeadline = row.reporting_deadline_date as string | null
    const sponsorRequired = Boolean(row.sponsor_notification_required)
    const sponsorNotified = row.sponsor_notified_at != null
    const subjectId = row.subject_id as string
    const subjectIdentifier = (subjectId ?? '').slice(0, 8)
    const studyName = row.study_id as string

    const base = {
      organization_id: row.organization_id,
      study_id: row.study_id,
      study_subject_id: subjectId,
      subject_identifier: subjectIdentifier,
      study_name: studyName,
      signal_source: 'safety_events',
      signal_entity_id: row.id,
      signal_created_at: row.opened_at ?? now.toISOString(),
    }

    if (reportingDeadline) {
      const deadlineDate = new Date(reportingDeadline)
      const ageHours = Math.round((now.getTime() - deadlineDate.getTime()) / 3600000)

      if (reportingDeadline < today) {
        rows.push({
          ...base,
          signal_kind: 'sae_reporting_overdue',
          signal_age_hours: Math.max(0, ageHours),
          detail_text: `SAE reporting deadline overdue (due ${reportingDeadline})`,
        })
      } else if (reportingDeadline <= warningThreshold) {
        const daysRemaining = Math.ceil((deadlineDate.getTime() - now.getTime()) / 86400000)
        rows.push({
          ...base,
          signal_kind: 'sae_reporting_due_soon',
          signal_age_hours: 0,
          detail_text: `SAE reporting deadline in ${daysRemaining}d (${reportingDeadline})`,
        })
      }
    }

    if (sponsorRequired && !sponsorNotified) {
      const openedAt = row.opened_at as string | null
      rows.push({
        ...base,
        signal_kind: 'sae_sponsor_pending',
        signal_age_hours: openedAt
          ? Math.round((now.getTime() - new Date(openedAt).getTime()) / 3600000)
          : 0,
        detail_text: 'SAE sponsor notification required but not yet confirmed',
      })
    }
  }

  return { safetyClocks: { source: 'safety_events', rows, error: null } }
}
