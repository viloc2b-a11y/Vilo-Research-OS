/**
 * Phase 11 — E2E runtime validation report types.
 */

export type ChainCheckStatus = 'pass' | 'fail' | 'skip' | 'warn'

export type RuntimeChainCheck = {
  id: string
  goal: number
  label: string
  status: ChainCheckStatus
  detail: string
  evidence?: Record<string, unknown>
}

export type RuntimeValidationFailure = {
  checkId: string
  severity: 'blocker' | 'warning' | 'info'
  message: string
  remediation?: string
}

export type RuntimeE2EReport = {
  phase: 'phase11-runtime-e2e'
  runAt: string
  mode: 'offline' | 'live' | 'hybrid'
  pilot: {
    studyId: string | null
    studySubjectId: string | null
    visitId: string | null
    organizationId: string | null
  }
  overallStatus: 'pass' | 'fail' | 'degraded'
  chainChecks: RuntimeChainCheck[]
  failures: RuntimeValidationFailure[]
  integrityAudit: {
    directMutationBlockers: number
    directMutationWarnings: number
    catalogSilent: number
  } | null
  integrityReport: Record<string, unknown> | null
  replaySummary: Record<string, unknown> | null
  projectionSummary: Record<string, unknown> | null
  uiModelSummary: Record<string, unknown> | null
  remainingBlockers: string[]
  recommendedFixes: string[]
}
