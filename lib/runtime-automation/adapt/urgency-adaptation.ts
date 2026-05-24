import type { VisitCoordinatorOrchestration } from '@/lib/coordinator-orchestration/types'
import type { AdaptedUrgency, TriggeredAutomationRule } from '@/lib/runtime-automation/types'

export function adaptRuntimeUrgency(input: {
  orchestration: VisitCoordinatorOrchestration
  triggered: TriggeredAutomationRule[]
}): AdaptedUrgency {
  const base = input.orchestration.urgency.urgencyScore
  const reasons: string[] = []
  let boost = 0

  if (input.triggered.some((t) => t.trigger === 'unresolved_safety')) {
    boost += 12
    reasons.push('safety trigger')
  }
  if (input.triggered.some((t) => t.trigger === 'financial_leakage' && t.severity === 'critical')) {
    boost += 10
    reasons.push('critical financial leakage')
  }
  if (input.triggered.some((t) => t.trigger === 'visit_window_pressure')) {
    boost += 8
    reasons.push('visit window pressure')
  }
  if (input.triggered.some((t) => t.trigger === 'coordinator_overload')) {
    boost += 5
    reasons.push('coordinator overload — urgency adapted not blind-throttled')
  }
  if (input.triggered.some((t) => t.trigger === 'repeated_reschedules')) {
    boost += 7
    reasons.push('repeated reschedules')
  }

  const adapted = Math.min(100, base + boost)

  return {
    baseUrgencyScore: base,
    adaptedUrgencyScore: adapted,
    urgencyBoost: boost,
    adaptationReasons: reasons,
  }
}
