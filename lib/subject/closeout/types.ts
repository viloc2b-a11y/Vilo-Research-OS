export type CloseoutCheckSeverity = 'pass' | 'warning' | 'blocker'

export type CloseoutCheckCategory =
  | 'visits'
  | 'source'
  | 'signatures'
  | 'workflow'
  | 'safety'
  | 'reason'

export type CloseoutCheckItem = {
  id: string
  category: CloseoutCheckCategory
  label: string
  detail: string
  severity: CloseoutCheckSeverity
  href?: string
}

export type SubjectCloseoutReadiness = {
  items: CloseoutCheckItem[]
  blockerCount: number
  warningCount: number
  /** All blockers clear — required for Mark Completed. */
  canMarkCompleted: boolean
  /** No execution blockers — withdrawal/LTFU still require documented reason. */
  canTerminateWithReason: boolean
  /** Human-readable summary for server action errors. */
  blockerSummary: string | null
}
