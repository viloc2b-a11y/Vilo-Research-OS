import { OPERATIONAL_EVENT_TYPES } from '@/lib/operations/event-types'
import type { SubjectWorkflowActionType } from '@/lib/subject/workflow/types'

export function workflowCreateEventType(
  actionType: SubjectWorkflowActionType,
): string | null {
  switch (actionType) {
    case 'query':
      return OPERATIONAL_EVENT_TYPES.QUERY_CREATED
    case 'signature_request':
      return OPERATIONAL_EVENT_TYPES.SIGNATURE_REQUESTED
    case 'follow_up':
      return OPERATIONAL_EVENT_TYPES.FOLLOW_UP_CREATED
    default:
      return null
  }
}

export function workflowResolveEventType(
  actionType: SubjectWorkflowActionType,
): string | null {
  if (actionType === 'query') {
    return OPERATIONAL_EVENT_TYPES.QUERY_RESOLVED
  }
  return null
}
