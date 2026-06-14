import type { SubjectOperationalIntelligence } from '@/lib/subject/operations/types'
import {
  applyVisibleCap,
  collapseWorkflowEscalationItems,
  WORKFLOW_GROUP_VISIBLE,
} from '@/lib/subject/signal-density'
import type { SubjectWorkflowAction } from '@/lib/subject/workflow/types'
import type {
  SubjectWorkflowEscalationModel,
  WorkflowEscalationGroup,
  WorkflowEscalationItem,
  WorkflowEscalationItemKind,
  WorkflowEscalationSummary,
} from '@/lib/subject/workflow-escalation/types'

const GROUP_ORDER: WorkflowEscalationGroup[] = [
  'critical_overdue',
  'due_soon',
  'pending_signatures',
  'other_open',
]

const GROUP_TITLES: Record<WorkflowEscalationGroup, string> = {
  critical_overdue: 'Critical / overdue',
  due_soon: 'Due soon',
  pending_signatures: 'Pending signatures',
  other_open: 'Other open items',
}

function today() {
  return new Date().toISOString().slice(0, 10)
}

function isDueSoon(dueDate: string | null, now: string): boolean {
  if (!dueDate || dueDate < now) return false
  const due = new Date(`${dueDate}T12:00:00`)
  const end = new Date()
  end.setDate(end.getDate() + 3)
  return due.getTime() <= end.getTime()
}

function isOverdue(dueDate: string | null, now: string): boolean {
  return Boolean(dueDate && dueDate < now)
}

function assignedLabel(action: SubjectWorkflowAction): string | null {
  if (action.assignedUserId) return 'Assigned user'
  if (action.assignedRole) return `Role: ${action.assignedRole.toUpperCase()}`
  return 'Unassigned'
}

function recommendedForAction(action: SubjectWorkflowAction): string {
  switch (action.actionType) {
    case 'query':
      return 'Respond to the query and document resolution in source or workflow.'
    case 'correction':
      return 'Complete the source correction and clear validation.'
    case 'follow_up':
      return 'Complete the follow-up task or reassign with a new due date.'
    case 'signature_request':
      return 'Obtain the requested signature and mark the workflow item resolved.'
    default:
      return 'Complete this action or reassign before the due date.'
  }
}

function recommendedForKind(kind: WorkflowEscalationItemKind): string {
  switch (kind) {
    case 'signature':
      return 'Obtain the required signature on the visit closeout or linked workflow item.'
    case 'validation_blocked':
      return 'Open source capture and resolve blocking validation before continuing.'
    case 'validation_incomplete':
      return 'Complete required source fields and clear incomplete validation.'
    case 'validation_finding':
      return 'Acknowledge or resolve the validation finding in source capture.'
    default:
      return 'Review and complete this coordinator task.'
  }
}

function classifyWorkflowAction(
  action: SubjectWorkflowAction,
  now: string,
): WorkflowEscalationGroup {
  const overdue = isOverdue(action.dueDate, now)
  if (action.escalationLevel > 0) return 'critical_overdue'
  if (overdue || action.priority === 'urgent') return 'critical_overdue'
  if (action.priority === 'high') return 'critical_overdue'
  if (isDueSoon(action.dueDate, now)) return 'due_soon'
  return 'other_open'
}

function visitNameFor(
  visitId: string | null,
  intelligence: SubjectOperationalIntelligence | null,
): string | null {
  if (!visitId || !intelligence) return null
  return intelligence.visitTimeline.find((v) => v.visitId === visitId)?.visitName ?? null
}

function pushItem(items: WorkflowEscalationItem[], seen: Set<string>, item: WorkflowEscalationItem) {
  if (seen.has(item.id)) return
  seen.add(item.id)
  items.push(item)
}

export function buildSubjectWorkflowEscalation(input: {
  actions: SubjectWorkflowAction[]
  intelligence: SubjectOperationalIntelligence | null
  moreHref?: string | null
}): SubjectWorkflowEscalationModel {
  const now = today()
  const items: WorkflowEscalationItem[] = []
  const seen = new Set<string>()
  const { intelligence } = input

  for (const action of input.actions) {
    if (action.status !== 'open' && action.status !== 'in_progress') continue

    if (action.actionType === 'signature_request') {
      pushItem(items, seen, {
        id: `sig-wf-${action.id}`,
        group: 'pending_signatures',
        kind: 'signature',
        title: action.title,
        description: action.description,
        dueDate: action.dueDate,
        isOverdue: isOverdue(action.dueDate, now),
        priority: action.priority,
        severity: null,
        assignedLabel: assignedLabel(action),
        visitName: visitNameFor(action.visitId, intelligence),
        visitId: action.visitId,
        sourceLabel: 'Workflow signature',
        href: action.deepLink,
        recommendedAction: recommendedForAction(action),
        workflowActionId: action.id,
        statusLabel: action.status.replace(/_/g, ' '),
      })
      continue
    }

    const group = classifyWorkflowAction(action, now)
    pushItem(items, seen, {
      id: `wf-${action.id}`,
      group,
      kind: 'workflow_action',
      title: action.title,
      description: action.description,
      dueDate: action.dueDate,
      isOverdue: isOverdue(action.dueDate, now),
      priority: action.priority,
      severity: null,
      assignedLabel: assignedLabel(action),
      visitName: visitNameFor(action.visitId, intelligence),
      visitId: action.visitId,
      sourceLabel: action.actionType.replace(/_/g, ' '),
      href: action.deepLink,
      recommendedAction: recommendedForAction(action),
      workflowActionId: action.id,
      statusLabel: action.status.replace(/_/g, ' '),
    })
  }

  if (intelligence) {
    for (const sig of intelligence.pendingSignatures) {
      if (sig.kind === 'workflow') continue
      pushItem(items, seen, {
        id: `sig-${sig.id}`,
        group: 'pending_signatures',
        kind: 'signature',
        title: sig.label,
        description: sig.visitName ? `Visit: ${sig.visitName}` : null,
        dueDate: null,
        isOverdue: false,
        priority: null,
        severity: sig.kind === 'investigator' ? 'high' : 'warning',
        assignedLabel:
          sig.kind === 'investigator' ? 'Investigator' : 'Coordinator',
        visitName: sig.visitName,
        visitId: null,
        sourceLabel: 'Visit closeout',
        href: sig.href,
        recommendedAction: recommendedForKind('signature'),
        workflowActionId: null,
        statusLabel: 'pending',
      })
    }

    for (const issue of intelligence.validationIssues) {
      let kind: WorkflowEscalationItemKind = 'validation_finding'
      let group: WorkflowEscalationGroup = 'other_open'
      if (issue.kind === 'blocked') {
        kind = 'validation_blocked'
        group = 'critical_overdue'
      } else if (issue.kind === 'incomplete') {
        kind = 'validation_incomplete'
        group = 'critical_overdue'
      }

      pushItem(items, seen, {
        id: `val-${issue.id}`,
        group,
        kind,
        title: issue.label,
        description: issue.visitName ? `Visit: ${issue.visitName}` : null,
        dueDate: null,
        isOverdue: false,
        priority: null,
        severity: issue.kind === 'finding' ? 'warning' : 'critical',
        assignedLabel: null,
        visitName: issue.visitName,
        visitId: issue.visitId,
        sourceLabel: 'Source validation',
        href: issue.href,
        recommendedAction: recommendedForKind(kind),
        workflowActionId: null,
        statusLabel: issue.kind,
      })
    }
  }

  const collapsed = collapseWorkflowEscalationItems(items)
  const summary = summarizeEscalation(collapsed)
  const sections = GROUP_ORDER.map((group) => {
    const groupItems = collapsed.filter((i) => i.group === group)
    const capped = applyVisibleCap(groupItems, WORKFLOW_GROUP_VISIBLE)
    return {
      group,
      title: GROUP_TITLES[group],
      items: capped.visible,
      hiddenCount: capped.hiddenCount,
      moreHref: capped.hiddenCount > 0 ? (input.moreHref ?? null) : null,
    }
  }).filter((s) => s.items.length > 0 || s.hiddenCount > 0)

  return { summary, sections: sections.filter((s) => s.items.length > 0) }
}

export function summarizeEscalation(items: WorkflowEscalationItem[]): WorkflowEscalationSummary {
  let overdue = 0
  let highPriority = 0
  let pendingSignatures = 0
  let unresolvedFindings = 0

  for (const item of items) {
    if (item.isOverdue) overdue += 1
    if (item.priority === 'high' || item.priority === 'urgent') highPriority += 1
    if (item.kind === 'signature') pendingSignatures += 1
    if (item.kind === 'validation_finding') unresolvedFindings += 1
  }

  return {
    totalOpen: items.length,
    overdue,
    highPriority,
    pendingSignatures,
    unresolvedFindings,
  }
}
