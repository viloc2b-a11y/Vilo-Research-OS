/**
 * GOV-1 — Workflow decision authority matrix.
 */

export {
  getWorkflowAuthority,
  WorkflowDecisionAuthorityNotFoundError,
} from '@/lib/governance/workflow-authority/get-workflow-authority'

export { getWorkflowEscalationRules } from '@/lib/governance/workflow-authority/get-workflow-escalation-rules'

export {
  assertConditionExpressionNotMutated,
  assertWorkflowKeyNotRenamed,
  deprecateWorkflowRegistryRow,
  EscalationRuleMetadataImmutableError,
  WorkflowKeyImmutableError,
} from '@/lib/governance/workflow-authority/immutability'

export {
  assertGovernedTraceUsesEnumAuthority,
  buildGovernedWorkflowTraceRefs,
  rejectFreeTextAuthorityValue,
} from '@/lib/governance/workflow-authority/observability-contract'

export type { GovernedWorkflowTraceRefs } from '@/lib/governance/workflow-authority/observability-contract'

export {
  assertWorkflowAuthorityLevel,
  assertWorkflowKey,
  EFFECTIVE_AUTHORITY_LEVEL,
  GOV1_SEEDED_WORKFLOW_KEYS,
  isWorkflowAuthorityLevel,
  isWorkflowCategory,
  isWorkflowEscalationConditionType,
  isWorkflowKey,
  mapWorkflowAuthorityEscalationRuleRow,
  mapWorkflowDecisionAuthorityRow,
  WORKFLOW_AUTHORITY_LEVEL,
  WORKFLOW_AUTHORITY_LEVELS,
  WORKFLOW_CATEGORIES,
  WORKFLOW_CATEGORY,
  WORKFLOW_ESCALATION_CONDITION_TYPE,
  WORKFLOW_ESCALATION_CONDITION_TYPES,
  WORKFLOW_ESCALATION_RULE_KEY,
  WORKFLOW_ESCALATION_RULE_KEYS,
  WORKFLOW_KEY,
  WORKFLOW_KEYS,
  WORKFLOW_REGISTRY_ACTIVE,
} from '@/lib/governance/workflow-authority/types'

export type {
  EffectiveAuthorityLevel,
  Gov1SeededWorkflowKey,
  WorkflowAuthorityEscalationRule,
  WorkflowAuthorityEscalationRuleRow,
  WorkflowAuthorityLevel,
  WorkflowCategory,
  WorkflowDecisionAuthority,
  WorkflowDecisionAuthorityRow,
  WorkflowEscalationConditionType,
  WorkflowEscalationRuleKey,
  WorkflowKey,
  WorkflowRegistryActive,
} from '@/lib/governance/workflow-authority/types'
