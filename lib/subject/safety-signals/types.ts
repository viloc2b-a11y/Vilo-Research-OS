export type SafetySignalKind =
  | 'validation_finding'
  | 'workflow_action'
  | 'operational_event'
  | 'allergy_record'
  | 'procedure_validation'

export type SafetySignalSeverity = 'info' | 'warning' | 'error' | 'high' | 'unknown'

export type SafetySignalItem = {
  id: string
  kind: SafetySignalKind
  title: string
  description: string | null
  occurredAt: string
  visitId: string | null
  visitName: string | null
  severity: SafetySignalSeverity
  status: string | null
  isUnresolved: boolean
  actionNeeded: boolean
  sourceLabel: string
  href: string | null
  captureHref: string | null
  reviewHref: string | null
  missingFollowUp: boolean
}

export type SafetySignalSummary = {
  total: number
  openUnresolved: number
  seriousHigh: number
  recentUpdated: number
  missingFollowUp: number
}

export type SubjectSafetySignalsModel = {
  /** No structured AE table — signals are source-backed operational items only. */
  hasStructuredAeData: false
  items: SafetySignalItem[]
  summary: SafetySignalSummary
  hiddenCount: number
  moreHref: string | null
}
