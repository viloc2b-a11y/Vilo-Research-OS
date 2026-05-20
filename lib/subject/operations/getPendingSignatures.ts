import type { PendingSignatureItem } from '@/lib/subject/operations/types'
import type { SubjectVisitGridRow } from '@/lib/subject/visits/types'
import type { SubjectWorkflowAction } from '@/lib/subject/workflow/types'

const IN_FLIGHT_VISIT = new Set([
  'in_progress',
  'completed',
  'checked_in',
  'out_of_window',
])

export function getPendingSignatures(input: {
  visits: SubjectVisitGridRow[]
  workflowActions: SubjectWorkflowAction[]
}): PendingSignatureItem[] {
  const items: PendingSignatureItem[] = []

  for (const action of input.workflowActions) {
    if (action.actionType !== 'signature_request') continue
    if (action.status === 'resolved' || action.status === 'cancelled') continue
    items.push({
      id: `wf-${action.id}`,
      kind: 'workflow',
      visitName: null,
      label: action.title,
      href: action.deepLink,
    })
  }

  for (const visit of input.visits) {
    if (!IN_FLIGHT_VISIT.has(visit.visitStatus) && visit.visitStatus !== 'scheduled') {
      continue
    }

    const href = `/visits/${visit.id}`

    if (
      visit.visitReviewStatus === 'draft' ||
      visit.visitReviewStatus === 'reopened'
    ) {
      items.push({
        id: `coord-${visit.id}`,
        kind: 'coordinator',
        visitName: visit.visitName,
        label: 'Coordinator progress note signature pending',
        href,
      })
    }

    if (visit.visitReviewStatus === 'coordinator_signed') {
      items.push({
        id: `inv-${visit.id}`,
        kind: 'investigator',
        visitName: visit.visitName,
        label: 'Investigator sign-off pending',
        href,
      })
    }
  }

  return items
}
