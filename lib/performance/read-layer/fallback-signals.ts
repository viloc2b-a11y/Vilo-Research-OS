import type { SubjectSignalInput, SubjectSignalKind } from '@/lib/performance/scoring/types'

function one<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null
  return value ?? null
}

function visitSignalKind(
  visitStatus: string,
  windowStatus: string | null,
): SubjectSignalKind | null {
  if (visitStatus === 'missed') return 'missed_visit'
  if (visitStatus === 'out_of_window' || windowStatus === 'outside_window') {
    return 'out_of_window'
  }
  if (windowStatus === 'warning') return 'window_warning'
  return null
}

export function buildFallbackSubjectSignals(input: {
  riskVisits: Record<string, unknown>[]
  overdueWorkflow: Record<string, unknown>[]
  blockedProcedures: Record<string, unknown>[]
}): SubjectSignalInput[] {
  const signals: SubjectSignalInput[] = []
  const today = new Date().toISOString().slice(0, 10)

  for (const visit of input.riskVisits) {
    const kind = visitSignalKind(
      visit.visit_status as string,
      visit.window_status as string | null,
    )
    if (!kind) continue

    const studyId = visit.study_id as string
    const subjectId = visit.study_subject_id as string
    const visitId = visit.id as string
    const subject = one(visit.study_subjects) as { subject_identifier?: string } | null
    const study = one(visit.studies) as { name?: string } | null
    const def = one(visit.visit_definitions) as { label?: string; code?: string } | null
    const visitLabel = def?.label ?? def?.code ?? 'Visit'
    const sortDate =
      (visit.window_end as string | null) ??
      (visit.scheduled_date as string | null) ??
      (visit.target_date as string | null) ??
      today

    signals.push({
      organizationId: (visit.organization_id as string) ?? '',
      studyId,
      subjectId,
      subjectIdentifier: subject?.subject_identifier ?? 'Subject',
      studyName: study?.name ?? 'Study',
      signalKind: kind,
      signalSource: `visits:${visitId}`,
      signalEntityId: visitId,
      signalCreatedAt: sortDate,
      signalAgeHours: 0,
      detailText: `${visitLabel} requires coordinator attention.`,
    })
  }

  for (const row of input.overdueWorkflow) {
    const dueDate = row.due_date as string | null
    if (!dueDate || dueDate >= today) continue

    const studyId = row.study_id as string
    const subjectId = row.study_subject_id as string
    const subject = one(row.study_subjects) as { subject_identifier?: string } | null
    const study = one(row.studies) as { name?: string } | null
    const title = row.title as string

    signals.push({
      organizationId: (row.organization_id as string) ?? '',
      studyId,
      subjectId,
      subjectIdentifier: subject?.subject_identifier ?? 'Subject',
      studyName: study?.name ?? 'Study',
      signalKind: 'overdue_action',
      signalSource: `subject_workflow_actions:${row.id as string}`,
      signalEntityId: row.id as string,
      signalCreatedAt: dueDate,
      signalAgeHours: 0,
      detailText: `${title} is overdue.`,
    })
  }

  for (const proc of input.blockedProcedures) {
    const studyId = proc.study_id as string
    const visit = one(proc.visits) as {
      id?: string
      study_subject_id?: string
      study_subjects?: { subject_identifier?: string } | { subject_identifier?: string }[]
    } | null
    const subjectId = visit?.study_subject_id
    if (!subjectId) continue

    const subject = one(visit.study_subjects) as { subject_identifier?: string } | null
    const study = one(proc.studies) as { name?: string } | null
    const pd = one(proc.procedure_definitions) as { label?: string; code?: string } | null
    const procLabel = pd?.label ?? pd?.code ?? 'Procedure'

    signals.push({
      organizationId: (proc.organization_id as string) ?? '',
      studyId,
      subjectId,
      subjectIdentifier: subject?.subject_identifier ?? 'Subject',
      studyName: study?.name ?? 'Study',
      signalKind: 'blocked_procedure',
      signalSource: `procedure_executions:${proc.id as string}`,
      signalEntityId: proc.id as string,
      signalCreatedAt: '0000-01-01',
      signalAgeHours: 0,
      detailText: `${procLabel} has blocking validation.`,
    })
  }

  return signals
}
