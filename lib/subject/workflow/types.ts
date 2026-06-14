export type SubjectWorkflowActionType =
  | 'action'
  | 'query'
  | 'signature_request'
  | 'follow_up'
  | 'correction'
  | 'capa_item'
  | 'amendment_reconsent'
  | 'deviation_followup'
  | 'safety_followup'

export type SubjectWorkflowStatus = 'open' | 'in_progress' | 'resolved' | 'cancelled'
export type SubjectWorkflowPriority = 'low' | 'normal' | 'high' | 'urgent'

export type SubjectWorkflowAction = {
  id: string
  organizationId: string
  studyId: string
  subjectId: string | null
  visitId: string | null
  procedureExecutionId: string | null
  sourceResponseSetId: string | null
  actionType: SubjectWorkflowActionType
  status: SubjectWorkflowStatus
  priority: SubjectWorkflowPriority
  title: string
  description: string | null
  assignedRole: string | null
  assignedUserId: string | null
  dueDate: string | null
  sourceSectionKey: string | null
  createdBy: string | null
  createdAt: string
  resolvedAt: string | null
  resolutionNote: string | null
  deepLink: string
  // D1 — object links
  capaId: string | null
  amendmentImpactId: string | null
  deviationId: string | null
  safetyEventId: string | null
  // D2 — SLA and escalation
  slaDays: number | null
  slaDeadline: string | null
  escalationLevel: number
  escalatedAt: string | null
  escalatedTo: string | null
}

export type SubjectWorkflowSummary = {
  openActions: number
  overdue: number
  pendingPiSignatures: number
  pendingCraQueries: number
  followUps: number
  recentlyResolved: number
}

export type SubjectWorkflowVisitCounts = {
  openQueries: number
  pendingSignatures: number
  overdueActions: number
  openActions: number
}

export type WorkflowActionState = {
  ok: boolean
  message: string | null
}

export const INITIAL_WORKFLOW_ACTION_STATE: WorkflowActionState = {
  ok: false,
  message: null,
}
