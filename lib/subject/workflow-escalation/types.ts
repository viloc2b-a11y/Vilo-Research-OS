export type WorkflowEscalationGroup =
  | 'critical_overdue'
  | 'due_soon'
  | 'pending_signatures'
  | 'other_open'

export type WorkflowEscalationItemKind =
  | 'workflow_action'
  | 'signature'
  | 'validation_finding'
  | 'validation_blocked'
  | 'validation_incomplete'

export type WorkflowEscalationItem = {
  id: string
  group: WorkflowEscalationGroup
  kind: WorkflowEscalationItemKind
  title: string
  description: string | null
  dueDate: string | null
  isOverdue: boolean
  priority: string | null
  severity: string | null
  assignedLabel: string | null
  visitName: string | null
  visitId: string | null
  sourceLabel: string | null
  href: string | null
  recommendedAction: string
  workflowActionId: string | null
  statusLabel: string
}

export type WorkflowEscalationSummary = {
  totalOpen: number
  overdue: number
  highPriority: number
  pendingSignatures: number
  unresolvedFindings: number
}

export type WorkflowEscalationGroupSection = {
  group: WorkflowEscalationGroup
  title: string
  items: WorkflowEscalationItem[]
  hiddenCount: number
  moreHref: string | null
}

export type SubjectWorkflowEscalationModel = {
  summary: WorkflowEscalationSummary
  sections: WorkflowEscalationGroupSection[]
}
