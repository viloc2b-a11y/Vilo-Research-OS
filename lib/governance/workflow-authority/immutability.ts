/**
 * GOV-1 — Immutability contracts for workflow registry and escalation metadata.
 */

import type { WorkflowKey } from '@/lib/governance/workflow-authority/constants'

export class WorkflowKeyImmutableError extends Error {
  readonly workflowKey: string

  constructor(workflowKey: string) {
    super(
      `workflow_key "${workflowKey}" is immutable once referenced by runtime projections, replay artifacts, or governance signals. ` +
        'Set active=false to deprecate; do not rename.',
    )
    this.name = 'WorkflowKeyImmutableError'
    this.workflowKey = workflowKey
  }
}

export class EscalationRuleMetadataImmutableError extends Error {
  readonly ruleKey: string

  constructor(ruleKey: string, field: 'rule_key' | 'condition_expression' | 'condition_type') {
    super(
      `Escalation rule "${ruleKey}": ${field} is immutable historical governance metadata once referenced. ` +
        'Insert a new rule row with a new rule_key instead of mutating.',
    )
    this.name = 'EscalationRuleMetadataImmutableError'
    this.ruleKey = ruleKey
  }
}

/** Client-side guard before issuing an UPDATE that renames workflow_key. */
export function assertWorkflowKeyNotRenamed(input: {
  previousWorkflowKey: string
  nextWorkflowKey: string
}): void {
  if (input.previousWorkflowKey !== input.nextWorkflowKey) {
    throw new WorkflowKeyImmutableError(input.previousWorkflowKey)
  }
}

/** Deprecation path: retain workflow_key, flip active only. */
export function deprecateWorkflowRegistryRow<T extends { workflowKey: WorkflowKey; active: boolean }>(
  row: T,
): T {
  return { ...row, active: false }
}

/** Client-side guard before mutating condition_expression on an existing rule. */
export function assertConditionExpressionNotMutated(input: {
  ruleKey: string
  previousExpression: Record<string, unknown>
  nextExpression: Record<string, unknown>
}): void {
  const prev = JSON.stringify(input.previousExpression)
  const next = JSON.stringify(input.nextExpression)
  if (prev !== next) {
    throw new EscalationRuleMetadataImmutableError(input.ruleKey, 'condition_expression')
  }
}
