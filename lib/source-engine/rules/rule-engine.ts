/**
 * Declarative rule engine — visibility, requiredness, disabled state, section state.
 */

import type {
  RuleAction,
  RuleCondition,
  RuleDefinition,
  SourceTemplateDefinition,
} from '@/lib/source-engine/definitions/types'
import {
  readContextValue,
  readResponseValue,
  type RuntimeContext,
  type SourceResponses,
} from '@/lib/source-engine/runtime/runtime-context'
import {
  defaultFieldState,
  defaultSectionState,
  type RuntimeFieldState,
  type RuntimeSectionState,
} from '@/lib/source-engine/runtime/runtime-state'
import type { RuleEvaluationResult } from '@/lib/source-engine/rules/rule.types'

export type ResolvedRuntimeState = {
  evaluation: RuleEvaluationResult
  fieldStates: Map<string, RuntimeFieldState>
  sectionStates: Map<string, RuntimeSectionState>
}

function toNumber(value: unknown): number | null {
  if (value == null || value === '') return null
  if (typeof value === 'object' && value !== null && 'value' in value) {
    return Number((value as { value: number }).value)
  }
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

export function evaluateCondition(
  condition: RuleCondition,
  responses: SourceResponses,
  context: RuntimeContext,
): boolean {
  if ('conditions' in condition) {
    const results = condition.conditions.map((c) => evaluateCondition(c, responses, context))
    return condition.op === 'and' ? results.every(Boolean) : results.some(Boolean)
  }

  const left =
    condition.fieldId != null
      ? readResponseValue(responses, condition.fieldId)
      : condition.contextKey != null
        ? readContextValue(context, condition.contextKey)
        : undefined

  switch (condition.op) {
    case 'exists':
      return left != null && left !== ''
    case 'not_exists':
      return left == null || left === ''
    case 'eq':
      return left === condition.value
    case 'neq':
      return left !== condition.value
    case 'gt': {
      const n = toNumber(left)
      const v = toNumber(condition.value)
      return n != null && v != null && n > v
    }
    case 'gte': {
      const n = toNumber(left)
      const v = toNumber(condition.value)
      return n != null && v != null && n >= v
    }
    case 'lt': {
      const n = toNumber(left)
      const v = toNumber(condition.value)
      return n != null && v != null && n < v
    }
    case 'lte': {
      const n = toNumber(left)
      const v = toNumber(condition.value)
      return n != null && v != null && n <= v
    }
    case 'between': {
      const n = toNumber(left)
      const [lo, hi] = condition.range ?? [0, 0]
      return n != null && n >= lo && n <= hi
    }
    case 'includes': {
      if (Array.isArray(left)) return left.includes(condition.value as string)
      if (typeof left === 'string' && typeof condition.value === 'string') {
        return left.includes(condition.value)
      }
      return false
    }
    case 'changed': {
      if (!condition.fieldId) return false
      const prev = responses.previousFields?.[condition.fieldId]
      return prev !== undefined && prev !== left
    }
    default:
      return false
  }
}

function buildStateMaps(template: SourceTemplateDefinition): {
  fieldStates: Map<string, RuntimeFieldState>
  sectionStates: Map<string, RuntimeSectionState>
} {
  const fieldStates = new Map<string, RuntimeFieldState>()
  for (const f of template.fields) {
    fieldStates.set(f.id, {
      ...defaultFieldState(f.id),
      required: Boolean(f.validation?.required),
    })
  }
  const sectionStates = new Map<string, RuntimeSectionState>()
  for (const s of template.sections) {
    sectionStates.set(s.id, defaultSectionState(s.id))
  }
  for (const rs of template.repeatableSections) {
    sectionStates.set(rs.id, {
      ...defaultSectionState(rs.id),
      allowAdd: rs.allowAdd,
      allowRemove: rs.allowRemove,
    })
  }
  return { fieldStates, sectionStates }
}

function applyAction(
  action: RuleAction,
  fieldStates: Map<string, RuntimeFieldState>,
  sectionStates: Map<string, RuntimeSectionState>,
  result: RuleEvaluationResult,
): void {
  switch (action.type) {
    case 'SHOW':
      if (action.fieldId && fieldStates.has(action.fieldId)) {
        fieldStates.get(action.fieldId)!.visible = true
      }
      if (action.sectionId && sectionStates.has(action.sectionId)) {
        sectionStates.get(action.sectionId)!.visible = true
      }
      if (action.repeatableSectionId && sectionStates.has(action.repeatableSectionId)) {
        sectionStates.get(action.repeatableSectionId)!.visible = true
      }
      break
    case 'HIDE':
      if (action.fieldId && fieldStates.has(action.fieldId)) {
        const s = fieldStates.get(action.fieldId)!
        s.visible = false
        s.required = false
      }
      if (action.sectionId && sectionStates.has(action.sectionId)) {
        sectionStates.get(action.sectionId)!.visible = false
      }
      if (action.repeatableSectionId && sectionStates.has(action.repeatableSectionId)) {
        sectionStates.get(action.repeatableSectionId)!.visible = false
      }
      break
    case 'REQUIRE':
      if (action.fieldId && fieldStates.has(action.fieldId)) {
        fieldStates.get(action.fieldId)!.required = true
      }
      if (action.sectionId && sectionStates.has(action.sectionId)) {
        sectionStates.get(action.sectionId)!.required = true
      }
      break
    case 'UNREQUIRE':
      if (action.fieldId && fieldStates.has(action.fieldId)) {
        fieldStates.get(action.fieldId)!.required = false
      }
      break
    case 'ENABLE':
      if (action.fieldId && fieldStates.has(action.fieldId)) {
        fieldStates.get(action.fieldId)!.disabled = false
      }
      if (action.sectionId && sectionStates.has(action.sectionId)) {
        const s = sectionStates.get(action.sectionId)!
        s.disabled = false
        s.enabled = true
      }
      break
    case 'DISABLE':
      if (action.fieldId && fieldStates.has(action.fieldId)) {
        fieldStates.get(action.fieldId)!.disabled = true
      }
      if (action.sectionId && sectionStates.has(action.sectionId)) {
        const s = sectionStates.get(action.sectionId)!
        s.disabled = true
        s.enabled = false
      }
      break
    case 'FLAG':
      result.flags.push({
        code: action.flagCode ?? 'RULE_FLAG',
        message: action.message ?? '',
        fieldId: action.fieldId,
        sectionId: action.sectionId,
      })
      if (action.fieldId && fieldStates.has(action.fieldId)) {
        fieldStates.get(action.fieldId)!.flags.push(action.flagCode ?? 'RULE_FLAG')
        if (action.message) fieldStates.get(action.fieldId)!.messages.push(action.message)
      }
      break
    case 'BLOCK_SIGNING':
      result.blockSigning = true
      if (action.sectionId && sectionStates.has(action.sectionId)) {
        sectionStates.get(action.sectionId)!.blockSigning = true
      }
      break
    case 'REQUIRE_REASON':
      result.requireReason = true
      break
    case 'CALCULATE':
    case 'CREATE_TASK':
      break
  }
  result.actions.push(action)
}

function applySignatureLockDefaults(
  fieldStates: Map<string, RuntimeFieldState>,
  sectionStates: Map<string, RuntimeSectionState>,
  context: RuntimeContext,
): void {
  const locked =
    context.locked ||
    context.signatureState === 'locked' ||
    (context.signatureState === 'signed' && !context.correctionMode && !context.addendumMode)

  if (!locked) return

  for (const state of fieldStates.values()) {
    state.disabled = true
    state.locked = true
  }
  for (const state of sectionStates.values()) {
    state.disabled = true
    state.locked = true
    state.enabled = false
  }
}

export function resolveRuntimeState(
  template: SourceTemplateDefinition,
  rules: RuleDefinition[],
  responses: SourceResponses,
  context: RuntimeContext,
): ResolvedRuntimeState {
  const { fieldStates, sectionStates } = buildStateMaps(template)
  const evaluation: RuleEvaluationResult = {
    firedRuleIds: [],
    actions: [],
    flags: [],
    blockSigning: false,
    requireReason: false,
  }

  const sorted = [...rules].sort((a, b) => (a.priority ?? 0) - (b.priority ?? 0))

  for (const rule of sorted) {
    if (rule.enabled === false) continue
    if (!evaluateCondition(rule.when, responses, context)) continue
    evaluation.firedRuleIds.push(rule.id)
    for (const action of rule.actions) {
      applyAction(action, fieldStates, sectionStates, evaluation)
    }
  }

  applySignatureLockDefaults(fieldStates, sectionStates, context)

  return { evaluation, fieldStates, sectionStates }
}

export function evaluateRules(
  template: SourceTemplateDefinition,
  rules: RuleDefinition[],
  responses: SourceResponses,
  context: RuntimeContext,
): RuleEvaluationResult {
  return resolveRuntimeState(template, rules, responses, context).evaluation
}

export function evaluateVisibility(
  fieldId: string,
  template: SourceTemplateDefinition,
  rules: RuleDefinition[],
  responses: SourceResponses,
  context: RuntimeContext,
): boolean {
  return resolveRuntimeState(template, rules, responses, context).fieldStates.get(fieldId)
    ?.visible ?? true
}

export function evaluateRequiredness(
  fieldId: string,
  template: SourceTemplateDefinition,
  rules: RuleDefinition[],
  responses: SourceResponses,
  context: RuntimeContext,
): boolean {
  return resolveRuntimeState(template, rules, responses, context).fieldStates.get(fieldId)
    ?.required ?? false
}

export function evaluateDisabledState(
  fieldId: string,
  template: SourceTemplateDefinition,
  rules: RuleDefinition[],
  responses: SourceResponses,
  context: RuntimeContext,
): boolean {
  return resolveRuntimeState(template, rules, responses, context).fieldStates.get(fieldId)
    ?.disabled ?? false
}

export function evaluateSectionState(
  sectionId: string,
  template: SourceTemplateDefinition,
  rules: RuleDefinition[],
  responses: SourceResponses,
  context: RuntimeContext,
): RuntimeSectionState {
  return (
    resolveRuntimeState(template, rules, responses, context).sectionStates.get(sectionId) ??
    defaultSectionState(sectionId)
  )
}

export function getRuntimeFieldState(
  fieldId: string,
  template: SourceTemplateDefinition,
  rules: RuleDefinition[],
  responses: SourceResponses,
  context: RuntimeContext,
): RuntimeFieldState {
  return (
    resolveRuntimeState(template, rules, responses, context).fieldStates.get(fieldId) ??
    defaultFieldState(fieldId)
  )
}

export function getRuntimeSectionState(
  sectionId: string,
  template: SourceTemplateDefinition,
  rules: RuleDefinition[],
  responses: SourceResponses,
  context: RuntimeContext,
): RuntimeSectionState {
  return evaluateSectionState(sectionId, template, rules, responses, context)
}
