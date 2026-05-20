/**
 * Unified runtime resolver — rules + calculations + validation snapshot.
 * Entry point for future dynamic eSource UI and visit execution shells.
 */

import type { RuleDefinition, SourceTemplateDefinition } from '@/lib/source-engine/definitions/types'
import { calculateDerivedMetrics } from '@/lib/source-engine/calculators/calculation-engine'
import type { DerivedMetricDefinition } from '@/lib/source-engine/definitions/types'
import { resolveRuntimeState } from '@/lib/source-engine/rules/rule-engine'
import type { RuntimeContext, SourceResponses } from '@/lib/source-engine/runtime/runtime-context'
import type { RuntimeEvaluationSnapshot } from '@/lib/source-engine/runtime/runtime-state'
import { validateTemplate } from '@/lib/source-engine/validators/validation-engine'

export type ResolveRuntimeOptions = {
  rules: RuleDefinition[]
  metrics: DerivedMetricDefinition[]
}

export function resolveSourceRuntime(
  template: SourceTemplateDefinition,
  responses: SourceResponses,
  context: RuntimeContext,
  options: ResolveRuntimeOptions,
): RuntimeEvaluationSnapshot {
  const { evaluation, fieldStates, sectionStates } = resolveRuntimeState(
    template,
    options.rules,
    responses,
    context,
  )

  const derivedValues = calculateDerivedMetrics(
    options.metrics,
    template,
    responses,
    context,
  )

  for (const [fieldId, value] of Object.entries(derivedValues)) {
    const state = fieldStates.get(fieldId)
    if (state) {
      state.calculatedValue = value
    }
  }

  const validationResults = validateTemplate(template, responses, context, {
    fieldStates,
    sectionStates,
  })

  const fields: RuntimeEvaluationSnapshot['fields'] = {}
  for (const [id, state] of fieldStates) {
    fields[id] = state
  }

  const sections: RuntimeEvaluationSnapshot['sections'] = {}
  const repeatableSections: RuntimeEvaluationSnapshot['repeatableSections'] = {}

  for (const [id, state] of sectionStates) {
    if (template.repeatableSections.some((rs) => rs.id === id)) {
      repeatableSections[id] = state
    } else {
      sections[id] = state
    }
  }

  return {
    fields,
    sections,
    repeatableSections,
    validationResults,
    firedRuleIds: evaluation.firedRuleIds,
    triggeredRuleActions: evaluation.actions,
    derivedValues,
  }
}
