import type { PendingActionItem } from '@/lib/subject/operations/types'
import type { SubjectWorkflowAction } from '@/lib/subject/workflow/types'

function today() {
  return new Date().toISOString().slice(0, 10)
}

function mapKind(action: SubjectWorkflowAction): PendingActionItem['kind'] {
  if (action.actionType === 'query') return 'query'
  if (action.actionType === 'correction') return 'correction'
  if (action.actionType === 'follow_up') return 'follow_up'
  if (action.priority === 'urgent' || action.priority === 'high') return 'escalation'
  return 'action'
}

export function getOpenWorkflowActions(
  actions: SubjectWorkflowAction[],
  limit = 12,
): PendingActionItem[] {
  const now = today()
  return actions
    .filter((a) => a.status === 'open' || a.status === 'in_progress')
    .filter((a) => a.actionType !== 'signature_request')
    .map((a) => ({
      id: a.id,
      kind: mapKind(a),
      title: a.title,
      dueDate: a.dueDate,
      isOverdue: Boolean(a.dueDate && a.dueDate < now),
      priority: a.priority,
      href: a.deepLink,
    }))
    .sort((a, b) => {
      if (a.isOverdue !== b.isOverdue) return a.isOverdue ? -1 : 1
      const pa = a.priority === 'urgent' ? 0 : a.priority === 'high' ? 1 : 2
      const pb = b.priority === 'urgent' ? 0 : b.priority === 'high' ? 1 : 2
      if (pa !== pb) return pa - pb
      return (a.dueDate ?? '9999').localeCompare(b.dueDate ?? '9999')
    })
    .slice(0, limit)
}
