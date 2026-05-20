import type { VisitCloseoutEventRow } from '@/lib/subject/visits/progress-note/events'
import type { VisitCloseoutGuards } from '@/lib/subject/visits/progress-note/guards'

export type VisitReviewStatus =
  | 'draft'
  | 'coordinator_signed'
  | 'investigator_signed'
  | 'reopened'

export type CoordinatorSignatureStatus = 'draft' | 'signed'
export type InvestigatorReviewStatus = 'pending' | 'signed' | 'reopened'
export type InvestigatorRole = 'principal_investigator' | 'sub_investigator'

export type VisitProgressNoteModel = {
  id: string | null
  visitId: string
  organizationId: string
  noteText: string
  visitReviewStatus: VisitReviewStatus
  coordinatorSignatureStatus: CoordinatorSignatureStatus
  coordinatorSignedByName: string | null
  coordinatorSignedAt: string | null
  investigatorReviewStatus: InvestigatorReviewStatus
  investigatorSignedByName: string | null
  investigatorRole: InvestigatorRole | null
  investigatorSignedAt: string | null
  updatedAt: string | null
}

export type VisitCloseoutActionResult =
  | { ok: true; visitAutoCompleted?: boolean }
  | { ok: false; error: string }

export type VisitCloseoutBundle = {
  model: VisitProgressNoteModel
  events: VisitCloseoutEventRow[]
  guards: VisitCloseoutGuards
  noteLocked: boolean
  closeoutLocked: boolean
}

export const INVESTIGATOR_ROLE_OPTIONS: { value: InvestigatorRole; label: string }[] = [
  { value: 'principal_investigator', label: 'Principal Investigator' },
  { value: 'sub_investigator', label: 'Sub-Investigator' },
]

export function investigatorRoleLabel(role: InvestigatorRole | null) {
  if (!role) return '—'
  return INVESTIGATOR_ROLE_OPTIONS.find((o) => o.value === role)?.label ?? role
}
