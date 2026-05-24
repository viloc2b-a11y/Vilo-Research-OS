/**
 * Temporal Consistency Engine v0 — compare provided timestamps only (no data fetch).
 */

import {
  isTemporalConstraintTypeV0Supported,
  TEMPORAL_EVALUATION_RESULT,
  TEMPORAL_SEVERITY,
} from '@/lib/temporal-consistency/constants'
import type {
  TemporalConsistencyEvaluateInput,
  TemporalConsistencyEvaluateOutcome,
} from '@/lib/temporal-consistency/types'

function toIso(value: string | Date | null | undefined): string | null {
  if (value === null || value === undefined) return null
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return date.toISOString()
}

function compareMs(a: string, b: string): number {
  return new Date(a).getTime() - new Date(b).getTime()
}

export function evaluateTemporalConsistencyRule(
  input: TemporalConsistencyEvaluateInput,
): TemporalConsistencyEvaluateOutcome {
  const { rule } = input

  if (!isTemporalConstraintTypeV0Supported(rule.constraintType)) {
    return {
      evaluationResult: TEMPORAL_EVALUATION_RESULT.NOT_APPLICABLE,
      severity: rule.severity,
      eventAValue: null,
      eventBValue: null,
      reason: `constraint_type "${rule.constraintType}" not supported in v0 evaluator`,
    }
  }

  const eventAValue = toIso(input.eventAValue)
  const eventBValue = toIso(input.eventBValue)

  if (!eventAValue || !eventBValue) {
    return {
      evaluationResult: TEMPORAL_EVALUATION_RESULT.PENDING,
      severity: rule.severity,
      eventAValue,
      eventBValue,
      reason: 'insufficient evidence: missing event_a_value and/or event_b_value',
    }
  }

  const delta = compareMs(eventAValue, eventBValue)
  let satisfied = false

  switch (rule.constraintType) {
    case 'a_before_b':
      satisfied = delta < 0
      break
    case 'a_before_or_equal_b':
      satisfied = delta <= 0
      break
    case 'a_after_b':
      satisfied = delta > 0
      break
    case 'a_after_or_equal_b':
      satisfied = delta >= 0
      break
    default:
      return {
        evaluationResult: TEMPORAL_EVALUATION_RESULT.NOT_APPLICABLE,
        severity: rule.severity,
        eventAValue,
        eventBValue,
        reason: `unsupported constraint_type "${rule.constraintType}"`,
      }
  }

  if (satisfied) {
    return {
      evaluationResult: TEMPORAL_EVALUATION_RESULT.PASS,
      severity: rule.severity,
      eventAValue,
      eventBValue,
      reason: null,
    }
  }

  const isBlocker =
    input.enforce === true &&
    rule.systemBlocking &&
    rule.severity === TEMPORAL_SEVERITY.BLOCKER

  if (rule.severity === TEMPORAL_SEVERITY.WARNING) {
    return {
      evaluationResult: TEMPORAL_EVALUATION_RESULT.WARNING,
      severity: rule.severity,
      eventAValue,
      eventBValue,
      reason: `temporal rule "${rule.ruleKey}" warning: constraint not satisfied`,
    }
  }

  if (isBlocker) {
    return {
      evaluationResult: TEMPORAL_EVALUATION_RESULT.BLOCKED,
      severity: rule.severity,
      eventAValue,
      eventBValue,
      reason: `temporal rule "${rule.ruleKey}" blocked runtime (enforce=true)`,
    }
  }

  return {
    evaluationResult: TEMPORAL_EVALUATION_RESULT.FAIL,
    severity: rule.severity,
    eventAValue,
    eventBValue,
    reason: `temporal rule "${rule.ruleKey}" failed`,
  }
}
