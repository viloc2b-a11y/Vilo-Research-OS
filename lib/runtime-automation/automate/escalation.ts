import type { ProposedAutomationAction } from '@/lib/runtime-automation/types'

/** Escalation automation — routes to operational escalation queue (derived labels only until apply). */
export function buildEscalationAutomationDetail(action: ProposedAutomationAction): string {
  return `${action.detail} Coordinator must acknowledge operational escalation.`
}
