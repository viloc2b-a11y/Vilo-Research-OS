import type { VisitCloseoutEventRow } from '@/lib/subject/visits/progress-note/events'
import type { VisitProgressNoteModel } from '@/lib/subject/visits/progress-note/types'

export type VisitGovernanceState = 'review' | 'signoff' | 'lock' | 'needs_resign'

export type VisitGovernanceStateSnapshot = {
  state: VisitGovernanceState
  label: string
  detail: string
  superseded: boolean
}

function hasReopenAfterSignature(
  model: VisitProgressNoteModel,
  events: VisitCloseoutEventRow[],
): boolean {
  if (model.visitReviewStatus !== 'reopened') return false

  const signedIndex = events.findIndex((event) =>
    event.eventType === 'coordinator_signed' || event.eventType === 'investigator_signed',
  )
  if (signedIndex < 0) return false

  return events.slice(signedIndex + 1).some((event) =>
    event.eventType === 'coordinator_reopened' || event.eventType === 'investigator_reopened',
  )
}

export function deriveVisitGovernanceState(
  model: VisitProgressNoteModel,
  events: VisitCloseoutEventRow[],
): VisitGovernanceStateSnapshot {
  const superseded = hasReopenAfterSignature(model, events)

  if (model.visitReviewStatus === 'investigator_signed') {
    return {
      state: 'lock',
      label: 'Locked',
      detail: 'Visit closeout is fully signed and locked for operational use.',
      superseded: false,
    }
  }

  if (model.visitReviewStatus === 'coordinator_signed') {
    return {
      state: 'signoff',
      label: 'Awaiting investigator',
      detail: 'Coordinator sign-off is complete. Investigator review is next.',
      superseded: false,
    }
  }

  if (model.visitReviewStatus === 'reopened') {
    return {
      state: 'needs_resign',
      label: superseded ? 'Needs re-sign' : 'Reopened',
      detail: superseded
        ? 'A prior signed closeout was reopened. Re-attestation is required before lock.'
        : 'The closeout is open again and ready for updated review.',
      superseded,
    }
  }

  return {
    state: 'review',
    label: 'In review',
    detail: 'Visit closeout is still being prepared for coordinator attestation.',
    superseded: false,
  }
}
