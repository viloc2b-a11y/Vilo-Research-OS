import type { RevenueLeakageItem } from '@/lib/financial-runtime/types'
import type { VisitReadinessProjection } from '@/lib/projections/types'

export type VisitOrchestrationContext = {
  visitId: string
  organizationId: string
  studyId: string
  studySubjectId: string
  readiness: VisitReadinessProjection
  operationalIntelligence: {
    burdenScore?: number
    complexityScore?: number
    frictionScore?: number
    riskLevel?: string
    riskScore?: number
    signalCount?: number
  }
  financialRuntime: {
    leakageScore?: number
    leakageItemCount?: number
    topLeakage?: string[]
    unsignedProcedureCount?: number
    missingSourceCount?: number
    earnedRateBasisPoints?: number
  }
  leakageItems: RevenueLeakageItem[]
  replaySummary: string | null
  rescheduleCount: number
  overdueWorkflowCount: number
}

type SnapshotOi = VisitOrchestrationContext['operationalIntelligence']
type SnapshotFin = VisitOrchestrationContext['financialRuntime']

export function buildVisitOrchestrationContext(input: {
  readiness: VisitReadinessProjection
  leakageItems?: RevenueLeakageItem[]
  rescheduleCount?: number
  overdueWorkflowCount?: number
}): VisitOrchestrationContext {
  const snap = input.readiness.snapshot
  const oi = (snap.operationalIntelligence as SnapshotOi | undefined) ?? {}
  const fin = (snap.financialRuntime as SnapshotFin | undefined) ?? {}

  return {
    visitId: input.readiness.visitId,
    organizationId: input.readiness.organizationId,
    studyId: input.readiness.studyId,
    studySubjectId: input.readiness.studySubjectId,
    readiness: input.readiness,
    operationalIntelligence: oi,
    financialRuntime: {
      leakageScore: fin.leakageScore ?? 0,
      leakageItemCount: fin.leakageItemCount ?? 0,
      topLeakage: fin.topLeakage ?? [],
      unsignedProcedureCount: input.readiness.unsignedProcedureCount,
      missingSourceCount: input.readiness.missingSourceCount,
      earnedRateBasisPoints: fin.earnedRateBasisPoints,
    },
    leakageItems: input.leakageItems ?? [],
    replaySummary: (snap.replayBlockedSummary as string | undefined) ?? null,
    rescheduleCount: input.rescheduleCount ?? 0,
    overdueWorkflowCount: input.overdueWorkflowCount ?? 0,
  }
}
