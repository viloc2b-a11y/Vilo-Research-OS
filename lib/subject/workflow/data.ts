import { createServerClient } from '@/lib/supabase/server'
import type {
  SubjectWorkflowAction,
  SubjectWorkflowSummary,
  SubjectWorkflowVisitCounts,
} from '@/lib/subject/workflow/types'

type WorkflowRow = Record<string, unknown>

function today() {
  return new Date().toISOString().slice(0, 10)
}

function deepLink(row: WorkflowRow) {
  const visitId = row.visit_id as string | null
  const procId = row.procedure_execution_id as string | null
  const setId = row.source_response_set_id as string | null
  const section = row.source_section_key as string | null
  const actionId = row.id as string
  const orgId = row.organization_id as string
  const orgQs = `organization_id=${orgId}`
  const subjectId = row.study_subject_id as string | null

  if (procId) {
    const hash = section
      ? `#${encodeURIComponent(section)}`
      : `#workflow-${actionId}`
    return `/source/capture/${procId}?${orgQs}${hash}`
  }
  if (setId) return `/source/response-set/${setId}?${orgQs}#workflow-${actionId}`
  if (visitId) return `/visits/${visitId}?${orgQs}#workflow-${actionId}`
  if (subjectId) return `/studies/${row.study_id as string}/subjects/${subjectId}?tab=workflow#workflow-${actionId}`
  return `/studies/${row.study_id as string}?tab=workflow#workflow-${actionId}`
}

export function filterWorkflowActionsForContext(
  actions: SubjectWorkflowAction[],
  input: {
    visitId?: string | null
    procedureExecutionId?: string | null
    sourceResponseSetId?: string | null
  },
): SubjectWorkflowAction[] {
  return actions.filter((action) => {
    if (input.visitId && action.visitId !== input.visitId) return false
    if (
      input.procedureExecutionId &&
      action.procedureExecutionId &&
      action.procedureExecutionId !== input.procedureExecutionId
    ) {
      return false
    }
    if (
      input.sourceResponseSetId &&
      action.sourceResponseSetId &&
      action.sourceResponseSetId !== input.sourceResponseSetId
    ) {
      return false
    }
    return true
  })
}

export function filterUnresolvedWorkflowActions(actions: SubjectWorkflowAction[]) {
  return actions.filter((a) => a.status === 'open' || a.status === 'in_progress')
}

function mapAction(row: WorkflowRow): SubjectWorkflowAction {
  return {
    id: row.id as string,
    organizationId: row.organization_id as string,
    studyId: row.study_id as string,
    subjectId: (row.study_subject_id as string | null) ?? null,
    visitId: (row.visit_id as string | null) ?? null,
    procedureExecutionId: (row.procedure_execution_id as string | null) ?? null,
    sourceResponseSetId: (row.source_response_set_id as string | null) ?? null,
    actionType: row.action_type as SubjectWorkflowAction['actionType'],
    status: row.status as SubjectWorkflowAction['status'],
    priority: row.priority as SubjectWorkflowAction['priority'],
    title: row.title as string,
    description: (row.description as string | null) ?? null,
    assignedRole: (row.assigned_role as string | null) ?? null,
    assignedUserId: (row.assigned_user_id as string | null) ?? null,
    dueDate: (row.due_date as string | null) ?? null,
    sourceSectionKey: (row.source_section_key as string | null) ?? null,
    createdBy: (row.created_by as string | null) ?? null,
    createdAt: row.created_at as string,
    resolvedAt: (row.resolved_at as string | null) ?? null,
    resolutionNote: (row.resolution_note as string | null) ?? null,
    deepLink: deepLink(row),
    capaId: (row.capa_id as string | null) ?? null,
    amendmentImpactId: (row.amendment_impact_id as string | null) ?? null,
    deviationId: (row.deviation_id as string | null) ?? null,
    safetyEventId: (row.safety_event_id as string | null) ?? null,
    slaDays: (row.sla_days as number | null) ?? null,
    slaDeadline: (row.sla_deadline as string | null) ?? null,
    escalationLevel: (row.escalation_level as number) ?? 0,
    escalatedAt: (row.escalated_at as string | null) ?? null,
    escalatedTo: (row.escalated_to as string | null) ?? null,
  }
}

export function summarizeWorkflow(
  actions: SubjectWorkflowAction[],
  supplements?: { craSnapshotQueryCount?: number },
): SubjectWorkflowSummary {
  const now = today()
  const wfCraQueryCount = actions.filter((a) => a.actionType === 'query' && a.assignedRole === 'cra' && a.status !== 'resolved' && a.status !== 'cancelled').length
  return {
    openActions: actions.filter((a) => a.status === 'open' || a.status === 'in_progress').length,
    overdue: actions.filter((a) => a.dueDate && a.dueDate < now && a.status !== 'resolved' && a.status !== 'cancelled').length,
    pendingPiSignatures: actions.filter((a) => a.actionType === 'signature_request' && a.assignedRole === 'pi' && a.status !== 'resolved' && a.status !== 'cancelled').length,
    pendingCraQueries: wfCraQueryCount + (supplements?.craSnapshotQueryCount ?? 0),
    followUps: actions.filter((a) => a.actionType === 'follow_up' && a.status !== 'resolved' && a.status !== 'cancelled').length,
    recentlyResolved: actions.filter((a) => a.status === 'resolved').slice(0, 10).length,
  }
}

export async function loadSubjectWorkflowActions(subjectId: string, organizationId: string) {
  const supabase = await createServerClient()
  const { data, error } = await supabase
    .from('subject_workflow_actions')
    .select('*')
    .eq('study_subject_id', subjectId)
    .eq('organization_id', organizationId)
    .order('status', { ascending: true })
    .order('due_date', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: false })

  if (error) return { ok: false as const, error: error.message, actions: [] }
  return { ok: true as const, actions: (data ?? []).map((row) => mapAction(row as WorkflowRow)) }
}

export async function loadVisitWorkflowActions(visitId: string, organizationId: string) {
  const supabase = await createServerClient()
  const { data, error } = await supabase
    .from('subject_workflow_actions')
    .select('*')
    .eq('visit_id', visitId)
    .eq('organization_id', organizationId)
    .order('status', { ascending: true })
    .order('due_date', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: false })

  if (error) return { ok: false as const, error: error.message, actions: [] }
  return { ok: true as const, actions: (data ?? []).map((row) => mapAction(row as WorkflowRow)) }
}

export async function loadProcedureWorkflowActions(procedureExecutionId: string, organizationId: string) {
  const supabase = await createServerClient()
  const { data: pe } = await supabase
    .from('procedure_executions')
    .select('visit_id')
    .eq('id', procedureExecutionId)
    .eq('organization_id', organizationId)
    .maybeSingle()

  if (!pe?.visit_id) {
    return { ok: false as const, error: 'Procedure not found.', actions: [] }
  }

  return loadContextWorkflowActions({
    organizationId,
    visitId: pe.visit_id as string,
    procedureExecutionId,
  })
}

export async function loadContextWorkflowActions(input: {
  organizationId: string
  visitId: string
  procedureExecutionId?: string | null
  sourceResponseSetId?: string | null
}) {
  const visitResult = await loadVisitWorkflowActions(input.visitId, input.organizationId)
  if (!visitResult.ok) return visitResult

  const actions = filterWorkflowActionsForContext(visitResult.actions, {
    visitId: input.visitId,
    procedureExecutionId: input.procedureExecutionId,
    sourceResponseSetId: input.sourceResponseSetId,
  })

  return { ok: true as const, actions }
}

export async function loadWorkflowCountsByVisit(visitIds: string[], organizationId: string) {
  const empty = new Map<string, SubjectWorkflowVisitCounts>()
  if (visitIds.length === 0) return empty

  const supabase = await createServerClient()
  const [{ data: wfRows }, { data: snapshotRows }] = await Promise.all([
    supabase
      .from('subject_workflow_actions')
      .select('visit_id, action_type, status, assigned_role, due_date')
      .eq('organization_id', organizationId)
      .in('visit_id', visitIds),
    supabase
      .from('visit_snapshot_queries')
      .select('visit_id, query_status')
      .eq('organization_id', organizationId)
      .in('visit_id', visitIds)
      .in('query_status', ['open', 'answered']),
  ])

  const now = today()
  for (const row of wfRows ?? []) {
    const visitId = row.visit_id as string | null
    if (!visitId) continue
    const counts = empty.get(visitId) ?? {
      openQueries: 0,
      pendingSignatures: 0,
      overdueActions: 0,
      openActions: 0,
    }
    const open = row.status !== 'resolved' && row.status !== 'cancelled'
    if (open) counts.openActions += 1
    if (open && row.action_type === 'query') counts.openQueries += 1
    if (open && row.action_type === 'signature_request') counts.pendingSignatures += 1
    if (open && row.due_date && (row.due_date as string) < now) counts.overdueActions += 1
    empty.set(visitId, counts)
  }

  for (const row of snapshotRows ?? []) {
    const visitId = row.visit_id as string | null
    if (!visitId) continue
    const counts = empty.get(visitId) ?? {
      openQueries: 0,
      pendingSignatures: 0,
      overdueActions: 0,
      openActions: 0,
    }
    counts.openQueries += 1
    empty.set(visitId, counts)
  }

  return empty
}
