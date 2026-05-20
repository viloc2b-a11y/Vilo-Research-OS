/**
 * Rule engine types — re-export definition types + evaluation result shapes.
 */

export type {
  RuleAction,
  RuleActionType,
  RuleCondition,
  RuleConditionGroup,
  RuleConditionLeaf,
  RuleConditionOperator,
  RuleDefinition,
} from '@/lib/source-engine/definitions/types'

export type RuleEvaluationResult = {
  firedRuleIds: string[]
  actions: import('@/lib/source-engine/definitions/types').RuleAction[]
  flags: { code: string; message: string; fieldId?: string; sectionId?: string }[]
  blockSigning: boolean
  requireReason: boolean
}
