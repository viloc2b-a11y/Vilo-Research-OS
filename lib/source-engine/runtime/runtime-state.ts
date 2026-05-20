/**
 * Resolved runtime state per field and section after rules + calculations.
 */

import type { RuleAction, ValidationResult } from '@/lib/source-engine/definitions/types'

export type RuntimeFieldState = {
  fieldId: string
  visible: boolean
  required: boolean
  disabled: boolean
  locked: boolean
  calculatedValue?: unknown
  flags: string[]
  messages: string[]
}

export type RuntimeSectionState = {
  sectionId: string
  visible: boolean
  enabled: boolean
  required: boolean
  disabled: boolean
  locked: boolean
  /** Repeatable only */
  allowAdd?: boolean
  allowRemove?: boolean
  blockSigning?: boolean
  flags: string[]
}

export type RuntimeEvaluationSnapshot = {
  fields: Record<string, RuntimeFieldState>
  sections: Record<string, RuntimeSectionState>
  repeatableSections: Record<string, RuntimeSectionState>
  validationResults: ValidationResult[]
  firedRuleIds: string[]
  /** Rule actions fired on last evaluation (includes CREATE_TASK). */
  triggeredRuleActions: RuleAction[]
  derivedValues: Record<string, unknown>
}

export function defaultFieldState(fieldId: string): RuntimeFieldState {
  return {
    fieldId,
    visible: true,
    required: false,
    disabled: false,
    locked: false,
    flags: [],
    messages: [],
  }
}

export function defaultSectionState(sectionId: string): RuntimeSectionState {
  return {
    sectionId,
    visible: true,
    enabled: true,
    required: false,
    disabled: false,
    locked: false,
    flags: [],
  }
}
