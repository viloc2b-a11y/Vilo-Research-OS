export type RegulatorySignalType =
  | 'missed_visit'
  | 'out_of_window_visit'
  | 'blocked_procedure'
  | 'incomplete_procedure'
  | 'validation_finding'
  | 'pending_source_review'
  | 'overdue_workflow'
  | 'pending_signature'

export type RegulatorySignalSeverity = 'critical' | 'high' | 'warning' | 'info'

export type RegulatorySignalStatus = 'open' | 'resolved'

export type RegulatorySignalItem = {
  id: string
  signalType: RegulatorySignalType
  title: string
  description: string | null
  occurredAt: string
  visitId: string | null
  visitName: string | null
  severity: RegulatorySignalSeverity
  priority: string | null
  status: RegulatorySignalStatus
  isUnresolved: boolean
  recommendedAction: string
  sourceLabel: string
  href: string | null
  captureHref: string | null
  reviewHref: string | null
}

export type RegulatorySignalSummary = {
  total: number
  openUnresolved: number
  missedOowVisits: number
  blockedIncompleteProcedures: number
  unresolvedFindings: number
  overdueActions: number
}

export type SubjectRegulatorySignalsModel = {
  /** No formal protocol deviation adjudication table in schema. */
  hasFormalDeviationRecords: false
  items: RegulatorySignalItem[]
  summary: RegulatorySignalSummary
  hiddenCount: number
  moreHref: string | null
}
