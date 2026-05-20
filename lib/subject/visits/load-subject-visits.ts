import {
  deriveEdcStatus,
  deriveQcStatus,
  deriveReviewStatus,
  deriveSourceStatus,
  mapVisitStatusForGrid,
  pickOperationalStatus,
} from '@/lib/subject/visits/derive-status'
import { todayIsoDate } from '@/lib/visits/calculateVisitWindows'
import { refreshVisitOperationalFields } from '@/lib/visits/refreshVisitOperationalState'
import type { VisitWindowStatus } from '@/lib/subject/visits/types'
import type { VisitReviewStatus } from '@/lib/subject/visits/progress-note/types'
import type {
  EdcStatus,
  QcStatus,
  ReviewStatus,
  SourceStatus,
  SubjectChartHeaderModel,
  SubjectVisitGridRow,
} from '@/lib/subject/visits/types'
import { loadWorkflowCountsByVisit } from '@/lib/subject/workflow/data'
import { createServerClient } from '@/lib/supabase/server'

function one<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null
  return value ?? null
}

export type SubjectVisitsPageData = {
  header: SubjectChartHeaderModel
  visits: SubjectVisitGridRow[]
  error: string | null
}

export async function loadSubjectVisitsPage(
  subjectId: string,
  studyId: string,
): Promise<SubjectVisitsPageData | null> {
  const supabase = await createServerClient()

  const { data: subject, error: subErr } = await supabase
    .from('study_subjects')
    .select(
      `
      id,
      organization_id,
      study_id,
      subject_identifier,
      initials,
      enrollment_status,
      randomization_number,
      randomization_arm,
      study_version_id,
      studies(id, name),
      study_versions(protocol_identifier)
    `,
    )
    .eq('id', subjectId)
    .eq('study_id', studyId)
    .maybeSingle()

  if (subErr || !subject) return null

  const study = one(subject.studies) as { id: string; name: string } | null
  const version = one(subject.study_versions) as { protocol_identifier?: string | null } | null
  const protocolLabel =
    version?.protocol_identifier?.trim() || study?.name || 'Protocol'

  const header: SubjectChartHeaderModel = {
    subjectId: subject.id as string,
    studyId: subject.study_id as string,
    organizationId: subject.organization_id as string,
    subjectIdentifier: subject.subject_identifier as string,
    initials: (subject.initials as string | null) ?? null,
    studyName: study?.name ?? 'Study',
    enrollmentStatus: subject.enrollment_status as string,
    randomizationNumber: (subject.randomization_number as string | null) ?? null,
    randomizationArm: (subject.randomization_arm as string | null) ?? null,
  }

  const { data: visitsData, error: visErr } = await supabase
    .from('visits')
    .select(
      `
      id,
      organization_id,
      scheduled_date,
      target_date,
      actual_date,
      completed_at,
      visit_status,
      window_status,
      visit_review_status,
      visit_day,
      window_start,
      window_end,
      source_status,
      edc_status,
      qc_status,
      review_status,
      subject_payment,
      coordinator_note,
      visit_definitions(code, label, target_day, sort_order)
    `,
    )
    .eq('study_subject_id', subjectId)
    .order('target_date', { ascending: true, nullsFirst: false })
    .order('scheduled_date', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: true })

  if (visErr) {
    return { header, visits: [], error: visErr.message }
  }

  const visitIds = (visitsData ?? []).map((v) => v.id as string)
  const workflowCountsByVisit = await loadWorkflowCountsByVisit(
    visitIds,
    subject.organization_id as string,
  )

  const { data: procedureData } =
    visitIds.length > 0
      ? await supabase
          .from('procedure_executions')
          .select('id, visit_id, execution_status')
          .in('visit_id', visitIds)
          .order('created_at', { ascending: true })
      : { data: [] }

  const procedures = procedureData ?? []
  const procedureIds = procedures.map((p) => p.id as string)

  const { data: responseSetData } =
    procedureIds.length > 0
      ? await supabase
          .from('source_response_sets')
          .select('id, procedure_execution_id, status')
          .in('procedure_execution_id', procedureIds)
      : { data: [] }

  const proceduresByVisit = new Map<string, typeof procedures>()
  for (const proc of procedures) {
    const vid = proc.visit_id as string
    const rows = proceduresByVisit.get(vid) ?? []
    rows.push(proc)
    proceduresByVisit.set(vid, rows)
  }

  const setsByProcedure = new Map<string, { id: string; status: string }[]>()
  for (const set of responseSetData ?? []) {
    const peId = set.procedure_execution_id as string
    const rows = setsByProcedure.get(peId) ?? []
    rows.push({ id: set.id as string, status: set.status as string })
    setsByProcedure.set(peId, rows)
  }

  const refDate = todayIsoDate()

  const visits: SubjectVisitGridRow[] = (visitsData ?? []).map((visit) => {
    const def = one(visit.visit_definitions) as {
      code?: string
      label?: string
      target_day?: number | null
      sort_order?: number
    } | null

    const visitProcs = proceduresByVisit.get(visit.id as string) ?? []
    const sets = visitProcs.flatMap((p) => setsByProcedure.get(p.id as string) ?? [])
    const primaryProcedure = visitProcs[0] ?? null
    const primarySet = primaryProcedure
      ? (setsByProcedure.get(primaryProcedure.id as string) ?? [])[0]
      : null

    const derivedSource = deriveSourceStatus(sets)
    const derivedEdc = deriveEdcStatus(sets)
    const derivedQc = deriveQcStatus(
      visitProcs.map((p) => ({ execution_status: p.execution_status as string })),
    )
    const derivedReview = deriveReviewStatus(sets)

    const rawStatus = visit.visit_status as string
    const refreshed = refreshVisitOperationalFields({
      visitStatus: rawStatus,
      scheduledDate: (visit.scheduled_date as string | null) ?? null,
      targetDate: (visit.target_date as string | null) ?? null,
      windowStartDate: (visit.window_start as string | null) ?? null,
      windowEndDate: (visit.window_end as string | null) ?? null,
      actualDate: (visit.actual_date as string | null) ?? null,
      completedAt: visit.completed_at ? String(visit.completed_at) : null,
      referenceDate: refDate,
    })
    const windowStatus =
      (visit.window_status as VisitWindowStatus | null) ?? refreshed.windowStatus
    const completedDate =
      visit.completed_at
        ? String(visit.completed_at).slice(0, 10)
        : visit.actual_date
          ? String(visit.actual_date)
          : null

    return {
      id: visit.id as string,
      organizationId: visit.organization_id as string,
      visitCode: def?.code ?? '—',
      visitName: def?.label ?? def?.code ?? 'Visit',
      visitDay:
        (visit.visit_day as number | null) ??
        def?.target_day ??
        (typeof def?.sort_order === 'number' ? def.sort_order : null),
      protocolLabel,
      arm: header.randomizationArm,
      targetDate: (visit.target_date as string | null) ?? null,
      scheduledDate: (visit.scheduled_date as string | null) ?? null,
      completedDate,
      windowStart: (visit.window_start as string | null) ?? null,
      windowEnd: (visit.window_end as string | null) ?? null,
      windowStatus,
      visitStatus: mapVisitStatusForGrid(refreshed.visitStatus),
      visitReviewStatus:
        (visit.visit_review_status as VisitReviewStatus) ?? 'draft',
      rawVisitStatus: rawStatus,
      sourceStatus: pickOperationalStatus(
        visit.source_status as SourceStatus | null,
        derivedSource,
        'not_started',
      ),
      edcStatus: pickOperationalStatus(
        visit.edc_status as EdcStatus | null,
        derivedEdc,
        'pending',
      ),
      qcStatus: pickOperationalStatus(visit.qc_status as QcStatus | null, derivedQc, 'pending'),
      reviewStatus: pickOperationalStatus(
        visit.review_status as ReviewStatus | null,
        derivedReview,
        'pending',
      ),
      subjectPayment: (visit.subject_payment as SubjectVisitGridRow['subjectPayment']) ?? 'pending',
      coordinatorNote: (visit.coordinator_note as string | null) ?? null,
      primaryProcedureId: primaryProcedure ? (primaryProcedure.id as string) : null,
      primaryResponseSetId: primarySet?.id ?? null,
      workflow: workflowCountsByVisit.get(visit.id as string) ?? {
        openQueries: 0,
        pendingSignatures: 0,
        overdueActions: 0,
        openActions: 0,
      },
    }
  })

  return { header, visits, error: null }
}
