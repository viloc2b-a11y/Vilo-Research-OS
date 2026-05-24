import type { VisitCoordinatorOrchestration } from '@/lib/coordinator-orchestration/types'
import { buildVisitAutomationContext } from '@/lib/runtime-automation/context/build-automation-context'
import { buildVisitRuntimeAutomationPlan } from '@/lib/runtime-automation/plan/build-plan'
import type { RuntimeAutomationPlan } from '@/lib/runtime-automation/types'
import type { VisitReadinessProjection } from '@/lib/projections/types'

/**
 * Pure bridge: coordinator orchestration → automation plan (no I/O).
 */
export function deriveAutomationPlanFromOrchestration(input: {
  readiness: VisitReadinessProjection
  orchestration: VisitCoordinatorOrchestration
  rescheduleCount?: number
  overdueWorkflowCount?: number
}): RuntimeAutomationPlan {
  const ctx = buildVisitAutomationContext({
    readiness: input.readiness,
    orchestration: input.orchestration,
    rescheduleCount: input.rescheduleCount,
    overdueWorkflowCount: input.overdueWorkflowCount,
  })
  return buildVisitRuntimeAutomationPlan(ctx)
}
