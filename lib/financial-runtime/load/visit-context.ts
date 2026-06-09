import { loadVisitSourceMetrics } from '@/lib/projections/compute/shared'
import { isSourceCaptureSubmitted } from '@/lib/source/submitted-source-gate'
import type { VisitReadinessProjection } from '@/lib/projections/types'
import type { SupabaseClient } from '@supabase/supabase-js'

export type VisitFinancialContext = {
  visitId: string
  organizationId: string
  studyId: string
  studySubjectId: string
  visitDefinitionId: string | null
  visitStatus: string | null
  windowStatus: string | null
  scheduledDate: string | null
  visitReviewStatus: string | null
  subjectEnrollmentStatus: string | null
  procedures: Array<{
    id: string
    procedureDefinitionId: string
    code: string
    label: string
    executionStatus: string
    isSigned: boolean
    billableFlag: boolean
    billableDefault: boolean
    sectionDisabled: boolean
    validationStatus: string | null
  }>
  protocolMaps: Array<{
    mapId: string
    procedureDefinitionId: string
    isRequired: boolean
    isConditional: boolean
    conditionLabel: string | null
  }>
  sourceSubmittedByProcedure: Map<string, boolean>
  openAeVisitCount: number
  workflowOpenCount: number
  queryOpenCount: number
  rescheduleEventCount: number
  readiness: VisitReadinessProjection | null
}

function one<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null
  return value ?? null
}

export async function loadVisitFinancialContext(input: {
  supabase: SupabaseClient
  organizationId: string
  studyId: string
  visitId: string
  readiness?: VisitReadinessProjection | null
}): Promise<VisitFinancialContext | null> {
  const { data: visit, error } = await input.supabase
    .from('visits')
    .select(
      'id, organization_id, study_id, study_subject_id, visit_definition_id, visit_status, window_status, scheduled_date, visit_review_status, study_subjects(enrollment_status)',
    )
    .eq('id', input.visitId)
    .eq('organization_id', input.organizationId)
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (!visit) return null

  const visitDefinitionId = (visit.visit_definition_id as string | null) ?? null

  const [procResult, mapResult, aeCount, wfResult, rescheduleCount] = await Promise.all([
    input.supabase
      .from('procedure_executions')
      .select(
        `
        id,
        procedure_definition_id,
        execution_status,
        is_signed,
        billable_flag,
        section_disabled_at,
        validation_status,
        procedure_definitions(code, label, billable_default)
      `,
      )
      .eq('visit_id', input.visitId)
      .eq('organization_id', input.organizationId),
    visitDefinitionId
      ? input.supabase
          .from('visit_def_procedure_map')
          .select('id, procedure_definition_id, is_required, is_conditional, condition_label')
          .eq('visit_definition_id', visitDefinitionId)
          .eq('study_id', input.studyId)
      : Promise.resolve({ data: [], error: null }),
    input.supabase
      .from('subject_adverse_events')
      .select('ae_id', { count: 'exact', head: true })
      .eq('visit_id', input.visitId)
      .in('lifecycle_status', ['open', 'follow_up']),
    input.supabase
      .from('subject_workflow_actions')
      .select('id, action_type')
      .eq('visit_id', input.visitId)
      .in('status', ['open', 'in_progress']),
    input.supabase
      .from('operational_events')
      .select('id', { count: 'exact', head: true })
      .eq('visit_id', input.visitId)
      .eq('event_type', 'VISIT_RESCHEDULED'),
  ])

  if (procResult.error) throw new Error(procResult.error.message)

  const procedures = (procResult.data ?? []).map((row) => {
    const def = one(row.procedure_definitions) as {
      code?: string
      label?: string
      billable_default?: boolean
    } | null
    return {
      id: row.id as string,
      procedureDefinitionId: row.procedure_definition_id as string,
      code: def?.code ?? 'unknown',
      label: def?.label ?? def?.code ?? 'Procedure',
      executionStatus: row.execution_status as string,
      isSigned: Boolean(row.is_signed),
      billableFlag: Boolean(row.billable_flag),
      billableDefault: Boolean(def?.billable_default),
      sectionDisabled: Boolean(row.section_disabled_at),
      validationStatus: (row.validation_status as string | null) ?? null,
    }
  })

  const sourceSubmittedByProcedure = new Map<string, boolean>()
  const peRows = procedures.map((p) => ({
    id: p.id,
    visit_id: input.visitId,
    execution_status: p.executionStatus,
    validation_status: p.validationStatus,
    is_signed: p.isSigned,
    section_disabled_at: p.sectionDisabled ? new Date().toISOString() : null,
    source_definition_version_id: null as string | null,
  }))
  const sourceMetrics = await loadVisitSourceMetrics(input.supabase, peRows)

  const { data: sets } = await input.supabase
    .from('source_response_sets')
    .select('procedure_execution_id, status')
    .eq('visit_id', input.visitId)
    .neq('status', 'archived')

  for (const set of sets ?? []) {
    const peId = set.procedure_execution_id as string
    sourceSubmittedByProcedure.set(
      peId,
      isSourceCaptureSubmitted(set.status as string) || sourceSubmittedByProcedure.get(peId) === true,
    )
  }

  void sourceMetrics

  const workflowRows = wfResult.data ?? []
  const workflowOpenCount = workflowRows.length
  const queryOpenCount = workflowRows.filter((w) => w.action_type === 'query').length

  return {
    visitId: visit.id as string,
    organizationId: visit.organization_id as string,
    studyId: visit.study_id as string,
    studySubjectId: visit.study_subject_id as string,
    visitDefinitionId,
    visitStatus: (visit.visit_status as string | null) ?? null,
    windowStatus: (visit.window_status as string | null) ?? null,
    scheduledDate: (visit.scheduled_date as string | null) ?? null,
    visitReviewStatus: (visit.visit_review_status as string | null) ?? null,
    subjectEnrollmentStatus:
      (one(visit.study_subjects) as { enrollment_status?: string } | null)
        ?.enrollment_status ?? null,
    procedures,
    protocolMaps: (mapResult.data ?? []).map((m) => ({
      mapId: m.id as string,
      procedureDefinitionId: m.procedure_definition_id as string,
      isRequired: Boolean(m.is_required),
      isConditional: Boolean(m.is_conditional),
      conditionLabel: (m.condition_label as string | null) ?? null,
    })),
    sourceSubmittedByProcedure,
    openAeVisitCount: aeCount.count ?? 0,
    workflowOpenCount,
    queryOpenCount,
    rescheduleEventCount: rescheduleCount.count ?? 0,
    readiness: input.readiness ?? null,
  }
}
