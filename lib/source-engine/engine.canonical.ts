/**
 * Canonical rule evaluation — TriggerRule + BusinessRule.
 */

import { getBySourcePath } from '@/lib/source-engine/adapters'
import {
  QuerySeverity,
  type BusinessRule,
  type BusinessRuleResult,
  type FieldSpec,
  type TriggerRule,
} from '@/lib/source-engine/canonical'

export function evaluateFieldSpecConditional(
  spec: FieldSpec,
  ctx: Record<string, unknown>,
): boolean {
  if (!spec.conditional) return true
  const left = getBySourcePath(ctx, spec.conditional.dependsOn)
  return left === spec.conditional.equals
}

export function validateFieldSpec(
  spec: FieldSpec,
  value: unknown,
  ctx: Record<string, unknown>,
): string[] {
  const errors: string[] = []
  const visible = evaluateFieldSpecConditional(spec, ctx)

  if (!visible) return errors

  const required =
    spec.required ||
    (spec.validation?.min !== undefined && value == null) ||
    false

  if (required && (value == null || value === '')) {
    errors.push(spec.validation?.message ?? `${spec.label} is required`)
  }

  const v = spec.validation
  if (v && value != null && typeof value === 'number') {
    if (v.min !== undefined && value < v.min) {
      errors.push(v.message ?? `${spec.label} below minimum ${v.min}`)
    }
    if (v.max !== undefined && value > v.max) {
      errors.push(v.message ?? `${spec.label} above maximum ${v.max}`)
    }
  }

  if (v?.pattern && typeof value === 'string') {
    const re = v.patternRegex ?? new RegExp(v.pattern)
    if (!re.test(value)) {
      errors.push(v.message ?? `${spec.label} format invalid`)
    }
  }

  if (v?.custom && !v.custom(value, ctx)) {
    errors.push(v.message ?? `${spec.label} failed custom validation`)
  }

  return errors
}

export function applyTriggerRules(
  rules: TriggerRule[],
  ctx: Record<string, unknown>,
): {
  visibleFields: Set<string>
  hiddenFields: Set<string>
  disabledFields: Set<string>
  calculated: Record<string, unknown>
} {
  const visibleFields = new Set<string>()
  const hiddenFields = new Set<string>()
  const disabledFields = new Set<string>()
  const calculated: Record<string, unknown> = {}

  for (const rule of rules) {
    const triggerVal = getBySourcePath(ctx, rule.triggerField)
    if (rule.action === 'CALCULATE') {
      if (rule.targetField && rule.calculation) {
        calculated[rule.targetField] = rule.calculation(ctx)
      }
      continue
    }
    if (triggerVal !== rule.triggerValue) continue

    const target = rule.targetField
    if (!target) continue

    switch (rule.action) {
      case 'SHOW':
        visibleFields.add(target)
        hiddenFields.delete(target)
        break
      case 'HIDE':
        hiddenFields.add(target)
        break
      case 'ENABLE':
        disabledFields.delete(target)
        break
      case 'DISABLE':
        disabledFields.add(target)
        break
    }
  }

  return { visibleFields, hiddenFields, disabledFields, calculated }
}

/** Run all CALCULATE rules (no trigger gate — inputs must be present in ctx). */
export function runCalculations(
  rules: TriggerRule[],
  ctx: Record<string, unknown>,
): Record<string, unknown> {
  const calculated: Record<string, unknown> = {}
  for (const rule of rules) {
    if (rule.action !== 'CALCULATE' || !rule.targetField || !rule.calculation) continue
    calculated[rule.targetField] = rule.calculation(ctx)
  }
  return calculated
}

export function evaluateBusinessRules(
  rules: BusinessRule[],
  ctx: Record<string, unknown>,
  options?: { allContexts?: Record<string, unknown>[] },
): BusinessRuleResult[] {
  const results: BusinessRuleResult[] = []
  const allContexts = options?.allContexts ?? []

  for (const rule of rules) {
    const fired = rule.condition(ctx, allContexts)
    if (fired) {
      rule.autoResolve?.(ctx)
    }
    results.push({
      ruleId: rule.id,
      severity: rule.severity,
      message: rule.message,
      fired,
    })
  }

  return results
}

export function querySeverityToLegacy(
  severity: QuerySeverity,
): 'info' | 'warning' | 'error' {
  switch (severity) {
    case QuerySeverity.CRITICAL:
    case QuerySeverity.ERROR:
      return 'error'
    case QuerySeverity.WARNING:
      return 'warning'
    default:
      return 'info'
  }
}
