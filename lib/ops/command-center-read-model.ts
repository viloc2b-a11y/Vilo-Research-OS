import { getOrganizationMemberships, getSessionUser } from '@/lib/auth/session'
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

function eventDetail(payload: unknown): string {
  if (!payload || typeof payload !== 'object') return 'Operational event recorded.'
  const row = payload as Record<string, unknown>
  const parts = [
    typeof row.validation_status === 'string' ? `Validation: ${row.validation_status}` : null,
    typeof row.response_set_id === 'string' ? `Source set ${row.response_set_id.slice(0, 8)}` : null,
    typeof row.note_preview === 'string' ? row.note_preview : null,
  ].filter(Boolean)
  return parts.length ? parts.join(' · ') : 'Operational event recorded.'
}

export async function loadCommandCenterModel(): Promise<CommandCenterModel> {
  const user = await getSessionUser()
  const memberships = user ? await getOrganizationMemberships(user.id) : []
  const organizationIds = memberships.map((m) => m.organization_id)
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
      unavailable: ['No organization membership available for this user.'],
    }
  }

  const supabase = await createServerClient()
  const today = todayIsoDate()

  const [
    todayVisits,
    visitAlerts,
    sourceSets,
    pendingProcedures,
    findings,
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
      .from('source_response_validation_findings')
      .select('id, response_set_id, severity, message, status, field_key, created_at')
      .in('status', ['open', 'acknowledged'])
      .in('severity', ['error', 'critical'])
      .order('created_at', { ascending: false })
      .limit(12),
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
    loadPerformancePageModel(undefined).catch((error: unknown) => {
      unavailable.push(`VPI read model unavailable: ${error instanceof Error ? error.message : 'unknown error'}`)
      return null
    }),
  ])

  if (sourceSets.error) unavailable.push(`Incomplete source unavailable: ${sourceSets.error.message}`)
  if (pendingProcedures.error) unavailable.push(`Pending signatures unavailable: ${pendingProcedures.error.message}`)
  if (findings.error) unavailable.push(`Source Engine blockers unavailable: ${findings.error.message}`)
  if (workflowActions.error) unavailable.push(`Workflow tasks unavailable: ${workflowActions.error.message}`)
  if (events.error) unavailable.push(`Operational events unavailable: ${events.error.message}`)

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

  const sourceEngineBlockers = (findings.data ?? []).map((finding) => ({
    id: finding.id as string,
    title: String(finding.message ?? 'Source Engine blocker'),
    detail: `${String(finding.severity ?? 'error')} · ${String(finding.status ?? 'open')}`,
    href: sourceResponseSetPath(finding.response_set_id as string),
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

    return {
      id: action.id as string,
      title: action.title as string,
      detail: `${String(action.action_type ?? 'task')} · ${String(action.priority ?? 'normal')}${action.due_date ? ` · due ${action.due_date}` : ''}`,
      href,
      status: action.status as string | null,
      tone: action.priority === 'urgent' ? 'critical' as const : 'neutral' as const,
    }
  })

  const recentEvents = (events.data ?? []).map((event) => ({
    id: event.id as string,
    eventType: event.event_type as string,
    occurredAt: event.occurred_at as string,
    href: event.visit_id ? visitDetailPath(event.visit_id as string) : null,
    detail: eventDetail(event.payload),
  }))

  const highRisk =
    performanceResult?.model.riskQueue.slice(0, 8).map((item) => ({
      id: item.subjectId,
      title: item.subjectIdentifier,
      detail: `${item.reasonLabel} · ${item.detail}`,
      href: item.contextHref,
      status: item.operationalState ?? item.severity,
      tone:
        item.operationalState === 'critical' || item.severity === 'critical'
          ? 'critical' as const
          : 'warning' as const,
    })) ?? []

  return {
    generatedAt: today,
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
