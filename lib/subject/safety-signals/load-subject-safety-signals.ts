import { loadOperationalChronology } from '@/lib/operations/loadOperationalChronology'
import { OPERATIONAL_EVENT_TYPES } from '@/lib/operations/event-types'
import {
  sourceCapturePath,
  sourceResponseSetPath,
  subjectClinicalProfilePath,
  visitDetailPath,
} from '@/lib/ops/paths'
import {
  isOpenFindingStatus,
  isSafetyRelatedText,
  isUnresolvedWorkflowStatus,
} from '@/lib/subject/safety-signals/keywords'
import { subjectVisitsPath } from '@/lib/subject/chart-paths'
import { summarizeSafetySignals } from '@/lib/subject/safety-signals/summarize'
import {
  applyVisibleCap,
  collapseSafetySignals,
  OVERLAY_SIGNAL_LIST_VISIBLE,
} from '@/lib/subject/signal-density'
import type {
  SafetySignalItem,
  SafetySignalSeverity,
  SubjectSafetySignalsModel,
} from '@/lib/subject/safety-signals/types'
import { loadSubjectWorkflowActions } from '@/lib/subject/workflow/data'
import type { SubjectWorkflowAction } from '@/lib/subject/workflow/types'
import { createServerClient } from '@/lib/supabase/server'

function one<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null
  return value ?? null
}

function findingSeverity(severity: string): SafetySignalSeverity {
  if (severity === 'error') return 'error'
  if (severity === 'warning') return 'warning'
  return 'info'
}

function workflowSeverity(priority: string): SafetySignalSeverity {
  if (priority === 'urgent') return 'high'
  if (priority === 'high') return 'high'
  if (priority === 'normal') return 'warning'
  return 'info'
}

const SAFETY_EVENT_TYPES = new Set<string>([
  OPERATIONAL_EVENT_TYPES.VALIDATION_EXECUTED,
  OPERATIONAL_EVENT_TYPES.QUERY_CREATED,
  OPERATIONAL_EVENT_TYPES.FOLLOW_UP_CREATED,
  OPERATIONAL_EVENT_TYPES.QUERY_RESOLVED,
])

const EVENT_LABELS: Record<string, string> = {
  [OPERATIONAL_EVENT_TYPES.VALIDATION_EXECUTED]: 'Source validation executed',
  [OPERATIONAL_EVENT_TYPES.QUERY_CREATED]: 'Data query opened',
  [OPERATIONAL_EVENT_TYPES.FOLLOW_UP_CREATED]: 'Follow-up created',
  [OPERATIONAL_EVENT_TYPES.QUERY_RESOLVED]: 'Data query resolved',
}

function eventLabel(eventType: string, payload: Record<string, unknown>): string {
  const fromPayload =
    typeof payload.label === 'string'
      ? payload.label
      : typeof payload.message === 'string'
        ? payload.message
        : null
  if (fromPayload && isSafetyRelatedText(fromPayload)) return fromPayload
  return EVENT_LABELS[eventType] ?? eventType.replace(/_/g, ' ')
}

function isSafetyWorkflow(action: SubjectWorkflowAction): boolean {
  return (
    isSafetyRelatedText(action.title) ||
    isSafetyRelatedText(action.description) ||
    (action.actionType === 'follow_up' &&
      (action.priority === 'high' || action.priority === 'urgent'))
  )
}

export async function loadSubjectSafetySignals(input: {
  subjectId: string
  studyId: string
  organizationId: string
}): Promise<SubjectSafetySignalsModel> {
  const supabase = await createServerClient()
  const items: SafetySignalItem[] = []

  const { data: visits } = await supabase
    .from('visits')
    .select('id, visit_definitions(label, code)')
    .eq('study_subject_id', input.subjectId)
    .eq('organization_id', input.organizationId)

  const visitIds = (visits ?? []).map((v) => v.id as string)
  const visitLabelById = new Map<string, string>()
  for (const v of visits ?? []) {
    const def = one(v.visit_definitions) as { label?: string; code?: string } | null
    visitLabelById.set(v.id as string, def?.label ?? def?.code ?? 'Visit')
  }

  const procMeta = new Map<
    string,
    { visitId: string; responseSetId: string | null }
  >()

  if (visitIds.length > 0) {
    const { data: procedures } = await supabase
      .from('procedure_executions')
      .select('id, visit_id, validation_status, procedure_definitions(label, code)')
      .eq('organization_id', input.organizationId)
      .in('visit_id', visitIds)

    const procedureIds = (procedures ?? []).map((p) => p.id as string)

    const { data: sets } =
      procedureIds.length > 0
        ? await supabase
            .from('source_response_sets')
            .select('id, procedure_execution_id, status, updated_at')
            .in('procedure_execution_id', procedureIds)
        : { data: [] }

    const setIds: string[] = []
    const setToProc = new Map<string, string>()
    const primarySetByProc = new Map<string, string>()

    for (const s of sets ?? []) {
      const peId = s.procedure_execution_id as string
      setIds.push(s.id as string)
      setToProc.set(s.id as string, peId)
      if (!primarySetByProc.has(peId)) {
        primarySetByProc.set(peId, s.id as string)
      }
    }

    for (const proc of procedures ?? []) {
      const procId = proc.id as string
      const visitId = proc.visit_id as string
      procMeta.set(procId, {
        visitId,
        responseSetId: primarySetByProc.get(procId) ?? null,
      })

      const status = proc.validation_status as string | null
      if (status !== 'blocked' && status !== 'incomplete') continue

      const pd = one(proc.procedure_definitions) as { label?: string; code?: string } | null
      const procLabel = pd?.label ?? pd?.code ?? 'Procedure'
      const setId = primarySetByProc.get(procId)

      items.push({
        id: `proc-val-${procId}`,
        kind: 'procedure_validation',
        title: `${procLabel} — ${status === 'blocked' ? 'blocked' : 'incomplete'} validation`,
        description: 'Procedure cannot proceed until source validation is resolved.',
        occurredAt: new Date().toISOString(),
        visitId,
        visitName: visitLabelById.get(visitId) ?? null,
        severity: status === 'blocked' ? 'error' : 'warning',
        status,
        isUnresolved: true,
        actionNeeded: true,
        sourceLabel: 'Procedure validation',
        href: visitDetailPath(visitId),
        captureHref: sourceCapturePath(procId, input.organizationId),
        reviewHref: setId
          ? sourceResponseSetPath(setId, { organization_id: input.organizationId })
          : null,
        missingFollowUp: true,
      })
    }

    if (setIds.length > 0) {
      const { data: findings } = await supabase
        .from('source_response_validation_findings')
        .select(
          'id, response_set_id, message, severity, status, rule_code, finding_type, created_at, resolved_at',
        )
        .eq('organization_id', input.organizationId)
        .in('response_set_id', setIds)
        .order('created_at', { ascending: false })
        .limit(80)

      for (const f of findings ?? []) {
        const message = f.message as string
        const ruleCode = f.rule_code as string
        const status = f.status as string
        const safetyRelated =
          isSafetyRelatedText(message) ||
          isSafetyRelatedText(ruleCode) ||
          f.severity === 'error'

        if (!safetyRelated && !isOpenFindingStatus(status)) continue

        const procId = setToProc.get(f.response_set_id as string)
        const meta = procId ? procMeta.get(procId) : undefined
        const visitId = meta?.visitId ?? null
        const unresolved = isOpenFindingStatus(status)

        items.push({
          id: `finding-${f.id as string}`,
          kind: 'validation_finding',
          title: message.slice(0, 160),
          description: `Rule ${ruleCode} · ${f.finding_type as string}`,
          occurredAt: (f.created_at as string) ?? new Date().toISOString(),
          visitId,
          visitName: visitId ? visitLabelById.get(visitId) ?? null : null,
          severity: findingSeverity(f.severity as string),
          status,
          isUnresolved: unresolved,
          actionNeeded: unresolved && f.severity === 'error',
          sourceLabel: 'Source validation finding',
          href: procId
            ? sourceCapturePath(procId, input.organizationId)
            : f.response_set_id
              ? sourceResponseSetPath(f.response_set_id as string, {
                  organization_id: input.organizationId,
                })
              : null,
          captureHref: procId ? sourceCapturePath(procId, input.organizationId) : null,
          reviewHref: f.response_set_id
            ? sourceResponseSetPath(f.response_set_id as string, {
                organization_id: input.organizationId,
              })
            : null,
          missingFollowUp: unresolved && status === 'acknowledged',
        })
      }
    }
  }

  const workflowResult = await loadSubjectWorkflowActions(
    input.subjectId,
    input.organizationId,
  )
  if (workflowResult.ok) {
    for (const action of workflowResult.actions) {
      if (!isSafetyWorkflow(action)) continue

      const unresolved = isUnresolvedWorkflowStatus(action.status)
      const overdue =
        unresolved &&
        action.dueDate != null &&
        action.dueDate < new Date().toISOString().slice(0, 10)

      items.push({
        id: `workflow-${action.id}`,
        kind: 'workflow_action',
        title: action.title,
        description: action.description,
        occurredAt: action.createdAt,
        visitId: action.visitId,
        visitName: action.visitId ? visitLabelById.get(action.visitId) ?? null : null,
        severity: workflowSeverity(action.priority),
        status: action.status,
        isUnresolved: unresolved,
        actionNeeded: unresolved && (overdue || action.priority === 'urgent'),
        sourceLabel: 'Workflow action',
        href: action.deepLink,
        captureHref: action.procedureExecutionId
          ? sourceCapturePath(action.procedureExecutionId, input.organizationId)
          : null,
        reviewHref: action.sourceResponseSetId
          ? sourceResponseSetPath(action.sourceResponseSetId, {
              organization_id: input.organizationId,
            })
          : null,
        missingFollowUp: unresolved && !action.dueDate,
      })
    }
  }

  const events = await loadOperationalChronology({
    organizationId: input.organizationId,
    studyId: input.studyId,
    limit: 60,
  })

  for (const event of events) {
    if (event.eventType === OPERATIONAL_EVENT_TYPES.VPI_LOAD_TELEMETRY) continue
    if (!visitIds.length || !event.visitId || !visitIds.includes(event.visitId)) continue

    const label = eventLabel(event.eventType, event.payload)
    const safetyRelated =
      SAFETY_EVENT_TYPES.has(event.eventType) &&
      (isSafetyRelatedText(label) ||
        isSafetyRelatedText(JSON.stringify(event.payload)) ||
        event.eventType === OPERATIONAL_EVENT_TYPES.VALIDATION_EXECUTED ||
        event.eventType === OPERATIONAL_EVENT_TYPES.QUERY_CREATED ||
        event.eventType === OPERATIONAL_EVENT_TYPES.FOLLOW_UP_CREATED)

    if (!safetyRelated) continue

    const procId = event.procedureExecutionId
    const meta = procId ? procMeta.get(procId) : undefined

    items.push({
      id: `event-${event.id}`,
      kind: 'operational_event',
      title: label,
      description: null,
      occurredAt: event.occurredAt,
      visitId: event.visitId,
      visitName: visitLabelById.get(event.visitId) ?? null,
      severity:
        event.eventType === OPERATIONAL_EVENT_TYPES.QUERY_CREATED ? 'warning' : 'info',
      status: event.eventType,
      isUnresolved: event.eventType === OPERATIONAL_EVENT_TYPES.QUERY_CREATED,
      actionNeeded: event.eventType === OPERATIONAL_EVENT_TYPES.FOLLOW_UP_CREATED,
      sourceLabel: 'Operational event',
      href: event.visitId ? visitDetailPath(event.visitId) : null,
      captureHref: procId ? sourceCapturePath(procId, input.organizationId) : null,
      reviewHref: meta?.responseSetId
        ? sourceResponseSetPath(meta.responseSetId, {
            organization_id: input.organizationId,
          })
        : null,
      missingFollowUp: event.eventType === OPERATIONAL_EVENT_TYPES.FOLLOW_UP_CREATED,
    })
  }

  const { data: allergies } = await supabase
    .from('subject_allergies')
    .select(
      'allergy_id, allergen, reaction, severity, status, onset_date, source_attribution, created_at, updated_at, verified_at',
    )
    .eq('study_subject_id', input.subjectId)
    .order('updated_at', { ascending: false })
    .limit(30)

  for (const row of allergies ?? []) {
    const allergen = (row.allergen as string | null) ?? 'Allergen'
    const reaction = (row.reaction as string | null) ?? null
    const status = (row.status as string) ?? 'active'

    items.push({
      id: `allergy-${row.allergy_id as string}`,
      kind: 'allergy_record',
      title: `${allergen}${reaction ? ` — ${reaction}` : ''}`,
      description:
        'Documented allergy / adverse reaction (clinical profile). Not a formal AE case report.',
      occurredAt: (row.updated_at as string) ?? (row.created_at as string),
      visitId: null,
      visitName: null,
      severity:
        row.severity === 'severe' || row.severity === 'life-threatening'
          ? 'high'
          : row.severity === 'moderate'
            ? 'warning'
            : 'info',
      status,
      isUnresolved: status === 'active',
      actionNeeded: status === 'active' && !row.verified_at,
      sourceLabel: 'Clinical profile allergy',
      href: subjectClinicalProfilePath(input.studyId, input.subjectId),
      captureHref: null,
      reviewHref: null,
      missingFollowUp: status === 'active' && !row.source_attribution,
    })
  }

  const deduped = collapseSafetySignals(items)
  const summary = summarizeSafetySignals(deduped)
  const capped = applyVisibleCap(deduped, OVERLAY_SIGNAL_LIST_VISIBLE)
  const moreHref =
    capped.hiddenCount > 0 ? subjectVisitsPath(input.studyId, input.subjectId) : null

  return {
    hasStructuredAeData: false,
    items: capped.visible,
    summary,
    hiddenCount: capped.hiddenCount,
    moreHref,
  }
}
