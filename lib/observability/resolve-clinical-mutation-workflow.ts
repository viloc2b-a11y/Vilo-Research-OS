/**
 * OBS-2 — Map clinical mutation / event_type to GOV-1 workflow_key when known.
 */

import { WORKFLOW_KEY, type WorkflowKey } from '@/lib/governance/workflow-authority/constants'

export function resolveWorkflowKeyForClinicalMutation(input: {
  mutation: string
  eventType: string
}): WorkflowKey | null {
  const mutation = input.mutation.toLowerCase()
  const eventType = input.eventType.toUpperCase()

  if (mutation.includes('source') || eventType.includes('SOURCE_RESPONSE')) {
    return WORKFLOW_KEY.SOURCE_SIGNING
  }
  if (mutation.includes('randomization') || eventType.includes('RANDOMIZATION')) {
    return WORKFLOW_KEY.RANDOMIZATION
  }
  if (mutation.includes('eligibility') || eventType.includes('ELIGIBILITY')) {
    return WORKFLOW_KEY.ELIGIBILITY
  }
  if (mutation.includes('adverse') || eventType.includes('ADVERSE')) {
    return WORKFLOW_KEY.AE_WORKFLOW
  }
  if (mutation.includes('deviation') || eventType.includes('DEVIATION')) {
    return WORKFLOW_KEY.PROTOCOL_DEVIATION
  }
  if (mutation.includes('visit') || eventType.includes('VISIT_')) {
    return WORKFLOW_KEY.VISIT_LOCKING
  }
  if (mutation.includes('financial') || eventType.includes('FINANCIAL')) {
    return WORKFLOW_KEY.FINANCIAL_RECONCILIATION
  }
  if (mutation.includes('query') || eventType.includes('QUERY')) {
    return WORKFLOW_KEY.QUERY_MANAGEMENT
  }
  if (mutation.includes('schedule') || eventType.includes('SCHEDULE')) {
    return WORKFLOW_KEY.SCHEDULING
  }
  if (mutation.includes('lab') || mutation.includes('safety') || eventType.includes('SAFETY')) {
    return WORKFLOW_KEY.LAB_SAFETY_ESCALATION
  }
  if (mutation.includes('runtime_automation') || eventType.includes('RUNTIME_AUTOMATION')) {
    return null
  }

  return null
}
