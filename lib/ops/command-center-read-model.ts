import { getOrganizationMemberships, getSessionUser } from '@/lib/auth/session'
import { filterRowsByBlindingScope, redactOperationalEventPayloadForDisplay } from '@/lib/rbac/blinding'
import { canViewUnblindedData } from '@/lib/rbac/permissions'
import { loadPerformancePageModel } from '@/app/(ops)/performance/_lib/load-performance-page'
import { createServerClient } from '@/lib/supabase/server'
import { sourceCapturePath, sourceResponseSetPath, visitDetailPath } from '@/lib/ops/paths'
import { todayIsoDate } from '@/lib/visits/calculateVisitWindows'
import { loadCoordinatorVisitAlerts } from '@/lib/visits/loadCoordinatorVisitAlerts'
import { loadTodayVisits, type TodayVisitRow } from '@/lib/visits/loadTodayVisits'

export type CommandCenterListItem = {
  id: string
  title: string
  detail: string
  href: string
  status?: string | null
  tone: 'critical' | 'warning' | 'neutral' | 'success'
}

export type CommandCenterEventItem = {
  id: string
  eventType: string
  occurredAt: string
  href: string | null
  detail: string
}

export type CommandCenterModel = {
  generatedAt: string
  organizationIds: string[]
  todayVisits: TodayVisitRow[]
  outOfWindowVisits: CommandCenterListItem[]
  incompleteSource: CommandCenterListItem[]
  pendingSignatures: CommandCenterListItem[]
  sourceEngineBlockers: CommandCenterListItem[]
  openWorkflowTasks: CommandCenterListItem[]
  recentEvents: CommandCenterEventItem[]
  highRisk: CommandCenterListItem[]
  unavailable: string[]
}

function one<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null
  return value ?? null
}

function eventDetail(payload: unknown, canViewUnblinded: boolean): string {
  return redactOperationalEventPayloadForDisplay(payload, canViewUnblinded)
}

function unavailableSection(section: string): string {
  return `${section} is temporarily unavailable. Retry the page; if it persists, ask the technical team to review server logs.`
}

export async function loadCommandCenterModel(): Promise<CommandCenterModel> {
  const user = await getSessionUser()
  const memberships = user ? await getOrganizationMemberships(user.id) : []
  const organizationIds = memberships.map((m) => m.organization_id)
  const canViewUnblinded = canViewUnblindedData(memberships)
  const unavailable: string[] = []

  if (organizationIds.length === 0) {
    return {
      generatedAt: new Date().toISOString(),
      organizationIds,
      todayVisits: [],
      outOfWindowVisits: [],
      incompleteSource: [],
      pendingSignatures: [],
      sourceEngineBlockers: [],
      openWorkflowTasks: [],
      recentEvents: [],
      highRisk: [],
      unavailable: ['Workspace access is unavailable because this user is not assigned to an organization.'],
    }
  }

  const supabase = await createServerClient()
  const today = todayIsoDate()

  const [
    todayVisits,
    visitAlerts,
    sourceSets,
    pendingProcedures,
    blockerSets,
    workflowActions,
    events,
    performanceResult,
  ] = await Promise.all([
    loadTodayVisits(organizationIds),
    loadCoordinatorVisitAlerts(organizationIds),
    supabase
      .from('source_response_sets')
      .select('id, organization_id, study_id, study_subject_id, visit_id, procedure_execution_id, status, opened_at, submitted_at')
      .in('organization_id', organizationIds)
      .in('status', ['draft', 'opened', 'in_progress', 'pending_review'])
      .order('opened_at', { ascending: false })
      .limit(12),
    supabase
      .from('procedure_executions')
      .select('id, organization_id, study_id, visit_id, execution_status, validation_status, is_signed, is_locked, procedure_definitions(label, code)')
      .in('organization_id', organizationIds)
      .eq('is_signed', false)
      .in('execution_status', ['completed', 'in_progress'])
      .order('updated_at', { ascending: false })
      .limit(12),
    supabase
      .from('source_response_sets')
      .select('id, organization_id')
      .in('organization_id', organizationIds)
      .order('opened_at', { ascending: false })
      .limit(200),
    supabase
      .from('subject_workflow_actions')
      .select('id, organization_id, study_id, study_subject_id, visit_id, procedure_execution_id, source_response_set_id, action_type, status, priority, title, due_date')
      .in('organization_id', organizationIds)
      .in('status', ['open', 'in_progress'])
      .order('due_date', { ascending: true, nullsFirst: false })
      .order('created_at', { ascending: false })
      .limit(12),
    supabase
      .from('operational_events')
      .select('id, event_type, payload, occurred_at, visit_id, procedure_execution_id')
      .in('organization_id', organizationIds)
      .order('occurred_at', { ascending: false })
      .limit(12),
    loadPerformancePageModel(undefined).catch(() => {
      unavailable.push(unavailableSection('VPI high-risk queue'))
      return null
    }),
  ])

  if (sourceSets.error) unavailable.push(unavailableSection('Incomplete source'))
  if (pendingProcedures.error) unavailable.push(unavailableSection('Pending signatures'))
  if (blockerSets.error) unavailable.push(unavailableSection('Source Engine Blockers'))
  if (workflowActions.error) unavailable.push(unavailableSection('Open workflow tasks'))
  if (events.error) unavailable.push(unavailableSection('Recent operational events'))
  if (performanceResult?.model.errors.length) {
    unavailable.push('VPI read model returned partial data; high-risk queue may be incomplete.')
  }

  const outOfWindowVisits = visitAlerts
    .filter((alert) => alert.alertType === 'missed' || alert.alertType === 'out_of_window')
    .map((alert) => ({
      id: alert.id,
      title: `${alert.subjectIdentifier} · ${alert.visitLabel}`,
      detail: `${alert.alertType.replace(/_/g, ' ')}${alert.scheduledDate ? ` · ${alert.scheduledDate}` : ''}`,
      href: alert.href,
      status: alert.alertType,
      tone: 'critical' as const,
    }))

  const incompleteSource = (sourceSets.data ?? []).map((set) => ({
    id: set.id as string,
    title: `Source set ${String(set.id).slice(0, 8)}`,
    detail: `Status: ${String(set.status ?? 'draft')}`,
    href: sourceResponseSetPath(set.id as string, {
      organization_id: set.organization_id as string,
    }),
    status: set.status as string | null,
    tone: 'warning' as const,
  }))

  const pendingSignatures = (pendingProcedures.data ?? []).map((proc) => {
    const def = one(proc.procedure_definitions) as { label?: string | null; code?: string | null } | null
    return {
      id: proc.id as string,
      title: def?.label ?? def?.code ?? 'Procedure signature pending',
      detail: `Execution: ${String(proc.execution_status ?? 'in_progress')} · Validation: ${String(proc.validation_status ?? 'not_run')}`,
      href: sourceCapturePath(proc.id as string, proc.organization_id as string),
      status: proc.validation_status as string | null,
      tone: proc.validation_status === 'blocked' ? 'critical' as const : 'warning' as const,
    }
  })

  const scopedResponseSetIds = (blockerSets.data ?? []).map((set) => set.id as string)
  const findings =
    scopedResponseSetIds.length > 0
      ? await supabase
        .from('source_response_validation_findings')
          .select('id, response_set_id, severity, message, status, created_at')
          .in('response_set_id', scopedResponseSetIds)
          .in('status', ['open', 'acknowledged'])
          .in('severity', ['error', 'critical'])
          .order('created_at', { ascending: false })
          .limit(12)
      : { data: [], error: null }

  if (findings.error) unavailable.push(unavailableSection('Source Engine Blockers'))

  const scopedSetOrgById = new Map(
    (blockerSets.data ?? []).map((set) => [set.id as string, set.organization_id as string]),
  )

  const sourceEngineBlockers = (findings.data ?? []).map((finding) => ({
    id: finding.id as string,
    title: String(finding.message ?? 'Source Engine blocker'),
    detail: `${String(finding.severity ?? 'error')} · ${String(finding.status ?? 'open')}`,
    href: sourceResponseSetPath(finding.response_set_id as string, {
      organization_id: scopedSetOrgById.get(finding.response_set_id as string),
    }),
    status: finding.status as string | null,
    tone: 'critical' as const,
  }))

  const openWorkflowTasks = (workflowActions.data ?? []).map((action) => {
    const setId = action.source_response_set_id as string | null
    const procId = action.procedure_execution_id as string | null
    const visitId = action.visit_id as string | null
    const href = setId
      ? sourceResponseSetPath(setId, { organization_id: action.organization_id as string })
      : procId
        ? sourceCapturePath(procId, action.organization_id as string)
        : visitId
          ? visitDetailPath(visitId)
          : `/studies/${action.study_id as string}/subjects/${action.study_subject_id as string}?tab=workflow`

    const dueDate = action.due_date as string | null
    const isOverdue = Boolean(dueDate && dueDate < today)
    return {
      id: action.id as string,
      title: action.title as string,
      detail: `${String(action.action_type ?? 'task')} · ${String(action.priority ?? 'normal')}${dueDate ? ` · ${isOverdue ? 'overdue' : 'due'} ${dueDate}` : ''}`,
      href,
      status: action.status as string | null,
      tone: isOverdue || action.priority === 'urgent' || action.priority === 'high' ? 'critical' as const : 'neutral' as const,
    }
  })

  type EventRow = {
    id: string
    event_type: string
    occurred_at: string
    visit_id: string | null
    payload: Record<string, unknown> | null
  }

  const recentEvents = filterRowsByBlindingScope(
    (events.data ?? []) as EventRow[],
    canViewUnblinded,
  ).map((event) => ({
    id: event.id,
    eventType: event.event_type,
    occurredAt: event.occurred_at,
    href: event.visit_id ? visitDetailPath(event.visit_id) : null,
    detail: eventDetail(event.payload, canViewUnblinded),
  }))

  const highRisk =
    performanceResult?.model.riskQueue.slice(0, 8).map((item) => ({
      id: item.subjectId,
      title: item.subjectIdentifier,
      detail: `${item.reasonLabel} · ${item.detail} · State: ${item.operationalState ?? item.severity ?? 'risk'} · Owner: not assigned in current read model`,
      href: item.contextHref,
      status: item.operationalState ?? item.severity,
      tone:
        item.operationalState === 'critical' || item.severity === 'critical'
          ? 'critical' as const
          : 'warning' as const,
    })) ?? []

  return {
    generatedAt: new Date().toISOString(),
    organizationIds,
    todayVisits,
    outOfWindowVisits,
    incompleteSource,
    pendingSignatures,
    sourceEngineBlockers,
    openWorkflowTasks,
    recentEvents,
    highRisk,
    unavailable,
  }
}
