export type SubjectWorkflowActionType =
  | 'action'
  | 'query'
  | 'signature_request'
  | 'follow_up'
  | 'correction'

export type SubjectWorkflowStatus = 'open' | 'in_progress' | 'resolved' | 'cancelled'
export type SubjectWorkflowPriority = 'low' | 'normal' | 'high' | 'urgent'

export type SubjectWorkflowAction = {
  id: string
  organizationId: string
  studyId: string
  subjectId: string
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
