/**
 * Phase 16B — Coordinator operational surface view models (presentation only).
 */

export type OperationalWorkQueueItem = {
  label: string
  kind: string
  priority: number
  href?: string | null
  scopeLabel?: string | null
}

export type OperationalWorkQueueBucket = {
  bucket: string
  items: OperationalWorkQueueItem[]
}

export type OperationalNextActionItem = {
  id: string
  label: string
  detail: string | null
  href: string | null
  priority: number
  scopeLabel: string
  requiresPiReview: boolean
  requiresEscalation: boolean
}

export type SiteOperationsSurface = {
  activeStudies: Array<{ id: string; name: string; href: string; status: string | null }>
  blockedVisitCount: number
  overdueVisitCount: number
  subjectsNeedingActionCount: number
  unresolvedSourceSignatureCount: number
  topNextActions: OperationalNextActionItem[]
  workQueueBuckets: OperationalWorkQueueBucket[]
  projectionDataAvailable: boolean
}

export type StudyOperationsSurface = {
  studyExecutionReady: boolean
  operationalRiskLevel: string | null
  visitStatusCounts: Record<string, number>
  sourcePackageSummary: {
    draft: number
    inProgress: number
    submitted: number
    other: number
  }
  regulatoryReadinessNote: string
  activeBlockers: Array<{ id: string; label: string; detail: string; href: string | null }>
  workQueueBuckets: OperationalWorkQueueBucket[]
  projectionDataAvailable: boolean
}

export type SubjectOperationsSurface = {
  currentVisit: { id: string; label: string; status: string; href: string } | null
  nextScheduledVisit: { id: string; label: string; scheduledDate: string; href: string } | null
  openSourceItems: Array<{ id: string; title: string; detail: string; href: string }>
  safetyIndicators: Array<{ id: string; label: string; detail: string; href: string | null }>
  clinicalLinks: Array<{ label: string; href: string }>
  workQueueBuckets: OperationalWorkQueueBucket[]
  projectionDataAvailable: boolean
}
