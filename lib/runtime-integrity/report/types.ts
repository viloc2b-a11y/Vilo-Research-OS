import type { DirectMutationFinding } from '@/lib/runtime-integrity/detect/direct-mutation-scanner'
import type { ReplayGap } from '@/lib/runtime-integrity/integrity/replay-gaps'
import type { ProjectionFreshnessIssue } from '@/lib/runtime-integrity/integrity/projection-freshness'

export const RUNTIME_INTEGRITY_VERSION = 1

export type RuntimeIntegrityScope = 'visit' | 'subject' | 'study'

export type RuntimeIntegrityReport = {
  version: number
  scope: RuntimeIntegrityScope
  scopeId: string
  organizationId: string
  studyId: string
  studySubjectId?: string | null
  visitId?: string | null
  computedAt: string
  overallStatus: 'healthy' | 'attention' | 'degraded' | 'critical'
  summary: string
  projectionFreshness: ProjectionFreshnessIssue[]
  replayGaps: ReplayGap[]
  staticAudit?: {
    blockers: number
    warnings: number
    topFindings: DirectMutationFinding[]
  }
  eventRegistry: {
    driftCount: number
    cataloguedSilentMutations: number
  }
  recommendations: string[]
  snapshot: Record<string, unknown>
}
