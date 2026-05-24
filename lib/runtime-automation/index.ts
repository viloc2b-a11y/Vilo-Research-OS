export type {
  VisitRuntimeAutomation,
  SubjectRuntimeAutomation,
  RuntimeAutomationPlan,
  ProposedAutomationAction,
  AutomationTriggerKind,
  AutomationActionKind,
  AutomationGovernanceSafeguard,
  ApplyAutomationResult,
} from '@/lib/runtime-automation/types'

export { RUNTIME_AUTOMATION_RULES_V1 } from '@/lib/runtime-automation/rules/registry'
export { computeVisitRuntimeAutomation } from '@/lib/runtime-automation/compute-visit'
export { computeSubjectRuntimeAutomation } from '@/lib/runtime-automation/compute-subject'
export {
  upsertVisitRuntimeAutomationProjection,
  upsertSubjectRuntimeAutomationProjection,
} from '@/lib/runtime-automation/persist'
export { enrichVisitReadinessWithRuntimeAutomation } from '@/lib/runtime-automation/integration/projection-bridge'
export { enrichSubjectRuntimeWithRuntimeAutomation } from '@/lib/runtime-automation/integration/subject-projection-bridge'
export { deriveAutomationPlanFromOrchestration } from '@/lib/runtime-automation/integration/coordinator-bridge'
export {
  applyVisitRuntimeAutomationPlan,
  proposeVisitRuntimeAutomationEvent,
} from '@/lib/runtime-automation/execute/apply-plan'
export { reverseRuntimeAutomationExecution } from '@/lib/runtime-automation/execute/reverse-execution'
export { overrideRuntimeAutomationExecution } from '@/lib/runtime-automation/execute/override-execution'
export { RUNTIME_AUTOMATION_VERSION } from '@/lib/runtime-automation/constants'
