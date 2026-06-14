import type { PerformanceQueryScope, RawSignal } from '@/lib/performance/types'
import type { SupabaseServerClient } from '@/lib/performance/read-layer/query/supabase-client'

export type ConsentSignalRow = Record<string, unknown>

export type ConsentSignals = {
  consentSignals: RawSignal<ConsentSignalRow>
}

export async function loadConsentReconsentSignals(
  client: SupabaseServerClient,
  scope: PerformanceQueryScope,
): Promise<ConsentSignals> {
  const today = new Date().toISOString().slice(0, 10)

  if (scope.studyIds.length === 0) {
    return { consentSignals: { source: 'subject_consent_reconsent_requirements', rows: [], error: null } }
  }

  const { data, error } = await client
    .from('subject_consent_reconsent_requirements')
    .select('id, organization_id, study_id, study_subject_id, reconsent_status, reconsent_due_date, reason, detected_at, study_subjects(subject_identifier)')
    .in('study_id', scope.studyIds)
    .in('reconsent_status', ['pending', 'overdue'])
    .eq('reconsent_required', true)
    .order('reconsent_due_date', { ascending: true, nullsFirst: false })
    .limit(100)

  if (error) {
    return {
      consentSignals: {
        source: 'subject_consent_reconsent_requirements',
        rows: [],
        error: { source: 'subject_consent_reconsent_requirements', message: error.message },
      },
    }
  }

  const rows: ConsentSignalRow[] = (data ?? []).map((row) => {
    const dueDate = row.reconsent_due_date as string | null
    const isOverdue = Boolean(dueDate && dueDate < today) || row.reconsent_status === 'overdue'
    const ageHours = isOverdue && dueDate
      ? Math.max(0, Math.round((Date.now() - new Date(dueDate).getTime()) / 3600000))
      : 0
    const subject = (Array.isArray(row.study_subjects) ? row.study_subjects[0] : row.study_subjects) as Record<string, unknown> | null
    const subjectIdentifier = (subject?.subject_identifier as string | null) ?? 'Subject'

    return {
      organization_id: row.organization_id,
      study_id: row.study_id,
      study_subject_id: row.study_subject_id,
      subject_identifier: subjectIdentifier,
      study_name: row.study_id as string,
      signal_source: `subject_consent_reconsent_requirements:${row.id as string}`,
      signal_entity_id: row.id,
      signal_created_at: (row.detected_at as string | null) ?? today,
      signal_kind: isOverdue ? 'consent_overdue' : 'consent_pending',
      signal_age_hours: ageHours,
      detail_text: isOverdue
        ? `Reconsent overdue${dueDate ? ` (due ${dueDate})` : ''}: ${(row.reason as string | null) ?? 'Consent version update required.'}`
        : `Reconsent required${dueDate ? ` (due ${dueDate})` : ''}: ${(row.reason as string | null) ?? 'Consent version update required.'}`,
    }
  })

  return { consentSignals: { source: 'subject_consent_reconsent_requirements', rows, error: null } }
}
