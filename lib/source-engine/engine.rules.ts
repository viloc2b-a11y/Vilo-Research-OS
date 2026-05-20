/**
 * Pure rule engine for configurable clinical source templates.
 */

import type {
  ConditionOperator,
  DerivedCalculation,
  FieldCondition,
  FieldDefinition,
  FieldResponseValue,
  FieldRuntimeState,
  FieldValidationRule,
  SourceRuntimeContext,
  SourceSectionDefinition,
  SourceTemplateDefinition,
  SourceValidationFinding,
  SourceValidationResult,
  TriggerAction,
  TriggerEvaluationResult,
  UnitValue,
} from '@/lib/source-engine/types'

// ---------------------------------------------------------------------------
// Context helpers
// ---------------------------------------------------------------------------

function getContextValue(context: SourceRuntimeContext, path: string): unknown {
  const parts = path.split('.')
  let cur: unknown = context
  for (const part of parts) {
    if (cur == null || typeof cur !== 'object') return undefined
    cur = (cur as Record<string, unknown>)[part]
  }
  return cur
}

function isLeafCondition(
  condition: FieldCondition,
): condition is Extract<FieldCondition, { op: Exclude<ConditionOperator, 'and' | 'or'> }> {
  return condition.op !== 'and' && condition.op !== 'or'
}

function resolveOperand(condition: FieldCondition, context: SourceRuntimeContext): unknown {
  if (!isLeafCondition(condition)) return undefined
  if (condition.fieldKey !== undefined) {
    return context.responses[condition.fieldKey]
  }
  if (condition.contextKey !== undefined) {
    return getContextValue(context, condition.contextKey)
  }
  return condition.value
}

function toNumber(value: unknown): number | null {
  if (value == null) return null
  if (typeof value === 'number' && !Number.isNaN(value)) return value
  if (typeof value === 'object' && value !== null && 'value' in value) {
    const v = (value as UnitValue).value
    return typeof v === 'number' && !Number.isNaN(v) ? v : null
  }
  const n = Number(value)
  return Number.isNaN(n) ? null : n
}

function isEmpty(value: unknown): boolean {
  if (value == null) return true
  if (typeof value === 'string') return value.trim() === ''
  if (Array.isArray(value)) return value.length === 0
  return false
}

// ---------------------------------------------------------------------------
// Condition evaluation
// ---------------------------------------------------------------------------

export function evaluateCondition(
  condition: FieldCondition | undefined,
  context: SourceRuntimeContext,
): boolean {
  if (!condition) return true

  if (condition.op === 'and') {
    return condition.conditions.every((c) => evaluateCondition(c, context))
  }
  if (condition.op === 'or') {
    return condition.conditions.some((c) => evaluateCondition(c, context))
  }

  if (!isLeafCondition(condition)) return false

  const left = resolveOperand(condition, context)
  const right = condition.value

  switch (condition.op) {
    case 'exists':
      return !isEmpty(left)
    case 'not_exists':
      return isEmpty(left)
    case 'eq':
      return left === right
    case 'neq':
      return left !== right
    case 'in':
      return Array.isArray(right) && right.includes(left as string | number | boolean)
    case 'not_in':
      return Array.isArray(right) && !right.includes(left as string | number | boolean)
    case 'gt': {
      const a = toNumber(left)
      const b = toNumber(right)
      return a != null && b != null && a > b
    }
    case 'gte': {
      const a = toNumber(left)
      const b = toNumber(right)
      return a != null && b != null && a >= b
    }
    case 'lt': {
      const a = toNumber(left)
      const b = toNumber(right)
      return a != null && b != null && a < b
    }
    case 'lte': {
      const a = toNumber(left)
      const b = toNumber(right)
      return a != null && b != null && a <= b
    }
    default:
      return false
  }
}

export function evaluateVisibility(
  field: FieldDefinition,
  context: SourceRuntimeContext,
): boolean {
  if (!evaluateCondition(field.visibleWhen, context)) return false
  return true
}

export function evaluateRequirement(
  field: FieldDefinition,
  context: SourceRuntimeContext,
): boolean {
  if (field.validation?.some((r) => r.kind === 'required')) return true
  if (field.requiredWhen && evaluateCondition(field.requiredWhen, context)) return true
  return false
}

function isSectionDisabled(sectionKey: string, context: SourceRuntimeContext): boolean {
  return context.disabledSectionKeys?.includes(sectionKey) ?? false
}

function isSectionLocked(section: SourceSectionDefinition, context: SourceRuntimeContext): boolean {
  if (!section.lockAfterSignature) return false
  const sig = context.sectionSignatures?.[section.key]
  if (!sig) return false
  return Boolean(sig.coordinator || sig.principal_investigator || sig.sub_investigator)
}

export function getRuntimeFieldState(
  field: FieldDefinition,
  section: SourceSectionDefinition,
  context: SourceRuntimeContext,
): FieldRuntimeState {
  const sectionDisabled = isSectionDisabled(section.key, context)
  const locked = isSectionLocked(section, context)
  const visible = !sectionDisabled && evaluateVisibility(field, context)
  const disabled =
    sectionDisabled ||
    (locked && !context.correctionMode && !context.addendumMode) ||
    (field.disabledWhen ? evaluateCondition(field.disabledWhen, context) : false)
  const required = visible && !disabled && evaluateRequirement(field, context)

  const derived = field.derivedFrom
    ? calculateSingleDerived(field.derivedFrom, context.responses, context)
    : undefined

  return {
    visible,
    required,
    disabled: disabled || field.type === 'calculated',
    locked,
    calculatedValue: derived,
  }
}

// ---------------------------------------------------------------------------
// Derived values
// ---------------------------------------------------------------------------

function heightMeters(height: unknown): number | null {
  const n = toNumber(height)
  if (n == null) return null
  // Assume cm if > 3, else meters
  return n > 3 ? n / 100 : n
}

function weightKg(weight: unknown): number | null {
  return toNumber(weight)
}

export function calculateSingleDerived(
  calc: DerivedCalculation,
  responses: Record<string, FieldResponseValue>,
  context: SourceRuntimeContext,
): FieldResponseValue {
  switch (calc.formula) {
    case 'bmi': {
      const h = heightMeters(responses[calc.inputs[0] ?? 'height'])
      const w = weightKg(responses[calc.inputs[1] ?? 'weight'])
      if (h == null || w == null || h <= 0) return null
      return Math.round((w / (h * h)) * 10) / 10
    }
    case 'pack_years': {
      const packs = toNumber(responses[calc.inputs[0] ?? 'packs_per_day'])
      const years = toNumber(responses[calc.inputs[1] ?? 'years_smoked'])
      if (packs == null || years == null) return null
      return Math.round(packs * years * 10) / 10
    }
    case 'blood_pressure_display': {
      const sys = responses[calc.inputs[0] ?? 'blood_pressure_systolic']
      const dia = responses[calc.inputs[1] ?? 'blood_pressure_diastolic']
      if (sys == null || dia == null) return null
      return `${sys}/${dia} mmHg`
    }
    case 'visit_window_status': {
      const actual = context.visitActualDay
      const start = context.windowStartDay
      const end = context.windowEndDay
      if (actual == null) return context.visitWindowStatus ?? null
      if (start != null && actual < start) return 'out_of_window'
      if (end != null && actual > end) return 'out_of_window'
      return 'in_window'
    }
    case 'cas_score':
      // Placeholder — study-specific scoring wired via template config later
      return responses[calc.targetFieldKey] ?? null
    case 'transit_time':
      return responses[calc.targetFieldKey] ?? null
    default:
      return null
  }
}

export function calculateDerivedValues(
  template: SourceTemplateDefinition,
  context: SourceRuntimeContext,
): Record<string, FieldResponseValue> {
  const out: Record<string, FieldResponseValue> = {}
  for (const section of template.sections) {
    for (const field of section.fields) {
      if (field.derivedFrom) {
        out[field.key] = calculateSingleDerived(field.derivedFrom, context.responses, context)
      }
    }
  }
  return out
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

function validateRule(
  rule: FieldValidationRule,
  value: FieldResponseValue,
): string | null {
  switch (rule.kind) {
    case 'required':
      return isEmpty(value) ? rule.message : null
    case 'min': {
      const n = toNumber(value)
      return n != null && n < rule.value ? rule.message : null
    }
    case 'max': {
      const n = toNumber(value)
      return n != null && n > rule.value ? rule.message : null
    }
    case 'minLength':
      return typeof value === 'string' && value.length < rule.value ? rule.message : null
    case 'maxLength':
      return typeof value === 'string' && value.length > rule.value ? rule.message : null
    case 'regex':
      return typeof value === 'string' && !new RegExp(rule.pattern).test(value) ? rule.message : null
    case 'enum':
      return value != null && !rule.values.includes(String(value)) ? rule.message : null
  }
  return null
}

export function validateField(
  field: FieldDefinition,
  value: FieldResponseValue,
  context: SourceRuntimeContext,
  section: SourceSectionDefinition,
): string[] {
  const state = getRuntimeFieldState(field, section, context)
  if (!state.visible || state.disabled) return []

  const errors: string[] = []
  if (state.required && isEmpty(value) && field.type !== 'calculated') {
    errors.push(`${field.label} is required`)
  }
  for (const rule of field.validation ?? []) {
    const msg = validateRule(rule, value)
    if (msg) errors.push(msg)
  }
  return errors
}

export function validateSection(
  section: SourceSectionDefinition,
  responses: Record<string, FieldResponseValue>,
  context: SourceRuntimeContext,
): SourceValidationResult {
  const fieldErrors: Record<string, string[]> = {}
  const findings: SourceValidationFinding[] = []

  if (isSectionDisabled(section.key, context)) {
    return { valid: true, fieldErrors, sectionErrors: {}, findings }
  }

  if (section.visibleWhen && !evaluateCondition(section.visibleWhen, context)) {
    return { valid: true, fieldErrors, sectionErrors: {}, findings }
  }

  const mergedContext: SourceRuntimeContext = {
    ...context,
    responses: { ...context.responses, ...responses },
  }

  for (const field of section.fields) {
    const state = getRuntimeFieldState(field, section, mergedContext)
    if (!state.visible) continue
    const value =
      field.type === 'calculated' && state.calculatedValue !== undefined
        ? state.calculatedValue
        : (responses[field.key] ?? mergedContext.responses[field.key] ?? null)
    const errors = validateField(field, value, mergedContext, section)
    if (errors.length > 0) fieldErrors[field.key] = errors
  }

  const valid = Object.keys(fieldErrors).length === 0
  return { valid, fieldErrors, sectionErrors: {}, findings }
}

export function validateTemplate(
  template: SourceTemplateDefinition,
  context: SourceRuntimeContext,
): SourceValidationResult {
  const fieldErrors: Record<string, string[]> = {}
  const sectionErrors: Record<string, string[]> = {}
  const findings: SourceValidationFinding[] = []

  for (const section of template.sections) {
    const sectionResponses: Record<string, FieldResponseValue> = {}
    for (const field of section.fields) {
      if (context.responses[field.key] !== undefined) {
        sectionResponses[field.key] = context.responses[field.key]
      }
    }
    const result = validateSection(section, sectionResponses, context)
    Object.assign(fieldErrors, result.fieldErrors)
    Object.assign(sectionErrors, result.sectionErrors)
    findings.push(...result.findings)
  }

  findings.push(...evaluateClinicalFindings(template, context))

  return {
    valid: Object.keys(fieldErrors).length === 0 && Object.keys(sectionErrors).length === 0,
    fieldErrors,
    sectionErrors,
    findings,
  }
}

/** Protocol-style clinical findings (generic multi-study CRF patterns). */
function evaluateClinicalFindings(
  template: SourceTemplateDefinition,
  context: SourceRuntimeContext,
): SourceValidationFinding[] {
  const findings: SourceValidationFinding[] = []
  const cfg = template.config ?? context.config
  const cortisol = toNumber(context.responses.morning_cortisol_ug_dl)
  const region = context.region ?? ''
  const cortisolCfg = cfg?.cortisol

  if (cortisol != null && cortisolCfg) {
    if (cortisol < cortisolCfg.lowThresholdUgDl) {
      findings.push({
        fieldKey: 'morning_cortisol_ug_dl',
        severity: 'error',
        message: `Morning cortisol < ${cortisolCfg.lowThresholdUgDl} µg/dL — ACTH stimulation required`,
        ruleId: 'cortisol_low_requires_acth',
      })
    } else if (
      cortisolCfg.usCanadaRegions.includes(region) &&
      cortisol > cortisolCfg.stimRangeMinUgDl &&
      cortisol < cortisolCfg.stimRangeMaxUgDl
    ) {
      findings.push({
        fieldKey: 'morning_cortisol_ug_dl',
        severity: 'warning',
        message: `Morning cortisol in indeterminate range — consider ACTH stimulation (US/Canada)`,
        ruleId: 'cortisol_indeterminate_acth',
      })
    }
    const peak = toNumber(context.responses.acth_peak_cortisol_ug_dl)
    if (peak != null && context.responses.acth_stimulation_performed === true) {
      if (peak < cortisolCfg.acthPeakFailureUgDl) {
        findings.push({
          fieldKey: 'acth_peak_cortisol_ug_dl',
          severity: 'error',
          message: `ACTH peak cortisol < ${cortisolCfg.acthPeakFailureUgDl} µg/dL`,
          ruleId: 'acth_peak_failure',
        })
      }
      if (peak < cortisolCfg.steroidPanelCutoffUgDl) {
        findings.push({
          severity: 'warning',
          message: 'Consider synthetic steroid panel',
          ruleId: 'steroid_panel_suggested',
        })
      }
    }
  }

  const hitCfg = cfg?.hit
  if (hitCfg) {
    const current = toNumber(context.responses.platelet_count_current)
    const drop = toNumber(context.responses.platelet_drop_percent)
    const thrombosis = context.responses.thrombosis_suspected === true
    if (
      (drop != null && drop >= hitCfg.plateletDropPercent) ||
      (current != null && current < hitCfg.plateletLowPerUl) ||
      thrombosis
    ) {
      findings.push({
        severity: 'warning',
        message: 'Platelet/HIT monitoring pathway — complete 4T, Anti-PF4, and coagulation workup',
        ruleId: 'hit_monitoring_pathway',
      })
    }
    if (context.responses.anti_pf4_result === 'positive') {
      findings.push({
        fieldKey: 'serotonin_release_assay_ordered',
        severity: 'warning',
        message: 'Anti-PF4 positive — serotonin release assay indicated',
        ruleId: 'sra_after_positive_pf4',
      })
    }
  }

  if (context.responses.pregnancy_test_result === 'positive') {
    findings.push({
      fieldKey: 'pregnancy_test_result',
      severity: 'error',
      message: 'Positive pregnancy test — review eligibility',
      ruleId: 'pregnancy_positive',
    })
  }

  return findings
}

// ---------------------------------------------------------------------------
// Triggers
// ---------------------------------------------------------------------------

export function evaluateTriggers(
  template: SourceTemplateDefinition,
  context: SourceRuntimeContext,
): TriggerEvaluationResult {
  const firedTriggers: string[] = []
  const actions: TriggerAction[] = []

  for (const trigger of template.triggers) {
    if (evaluateCondition(trigger.when, context)) {
      firedTriggers.push(trigger.id)
      actions.push(...trigger.actions)
    }
  }

  // Built-in endocrine/immunology triggers when template config present
  actions.push(...builtinTriggers(template, context))

  return { firedTriggers, actions }
}

function builtinTriggers(
  template: SourceTemplateDefinition,
  context: SourceRuntimeContext,
): TriggerAction[] {
  const actions: TriggerAction[] = []
  const cfg = template.config ?? context.config

  if (
    context.sex === 'female' &&
    context.wocbp === true
  ) {
    actions.push({ type: 'show_section', sectionKey: 'pregnancy_testing' })
    actions.push({ type: 'require_field', fieldKey: 'pregnancy_test_result' })
  }

  const cortisol = toNumber(context.responses.morning_cortisol_ug_dl)
  const cortisolCfg = cfg?.cortisol
  if (cortisol != null && cortisolCfg) {
    if (cortisol < cortisolCfg.lowThresholdUgDl) {
      actions.push({ type: 'show_section', sectionKey: 'adrenal_testing' })
      actions.push({ type: 'require_field', fieldKey: 'acth_stimulation_performed' })
      actions.push({
        type: 'workflow',
        workflowKind: 'follow_up',
        title: 'ACTH stimulation test required (low cortisol)',
      })
    } else if (
      cortisolCfg.usCanadaRegions.includes(context.region ?? '') &&
      cortisol > cortisolCfg.stimRangeMinUgDl &&
      cortisol < cortisolCfg.stimRangeMaxUgDl
    ) {
      actions.push({ type: 'show_section', sectionKey: 'adrenal_testing' })
    }
    const peak = toNumber(context.responses.acth_peak_cortisol_ug_dl)
    if (peak != null && peak < (cortisolCfg.steroidPanelCutoffUgDl ?? 15)) {
      actions.push({ type: 'require_field', fieldKey: 'synthetic_steroid_panel_ordered' })
    }
  }

  const hitCfg = cfg?.hit
  if (hitCfg) {
    const current = toNumber(context.responses.platelet_count_current)
    const drop = toNumber(context.responses.platelet_drop_percent)
    if (
      (drop != null && drop >= hitCfg.plateletDropPercent) ||
      (current != null && current < hitCfg.plateletLowPerUl) ||
      context.responses.thrombosis_suspected === true
    ) {
      actions.push({ type: 'show_section', sectionKey: 'hit_monitoring' })
      actions.push({ type: 'require_field', fieldKey: 'four_t_score' })
      actions.push({ type: 'require_field', fieldKey: 'anti_pf4_ordered' })
      actions.push({
        type: 'workflow',
        workflowKind: 'follow_up',
        title: 'HIT / 4T monitoring pathway',
      })
    }
    if (context.responses.anti_pf4_result === 'positive') {
      actions.push({ type: 'require_field', fieldKey: 'serotonin_release_assay_ordered' })
    }
  }

  if (context.pharmacokineticSubstudyParticipant) {
    actions.push({ type: 'show_section', sectionKey: 'pk_sampling' })
  }

  if (context.visitType === 'phone' || context.visitType === 'off_site') {
    actions.push({ type: 'hide_section', sectionKey: 'biospecimens' })
    actions.push({ type: 'hide_section', sectionKey: 'investigational_product' })
  }

  if (context.subjectRole === 'household_contact') {
    actions.push({ type: 'hide_section', sectionKey: 'investigational_product' })
    actions.push({ type: 'hide_section', sectionKey: 'pk_sampling' })
  }

  return actions
}

/** Merge trigger actions into effective section visibility for UI consumers. */
export function resolveEffectiveSections(
  template: SourceTemplateDefinition,
  context: SourceRuntimeContext,
): Record<string, { visible: boolean; required: boolean }> {
  const { actions } = evaluateTriggers(template, context)
  const map: Record<string, { visible: boolean; required: boolean }> = {}

  for (const section of template.sections) {
    const baseVisible =
      !isSectionDisabled(section.key, context) &&
      evaluateCondition(section.visibleWhen, context)
    map[section.key] = { visible: baseVisible, required: false }
  }

  for (const action of actions) {
    if (action.type === 'show_section' && map[action.sectionKey]) {
      map[action.sectionKey].visible = true
    }
    if (action.type === 'hide_section' && map[action.sectionKey]) {
      map[action.sectionKey].visible = false
    }
    if (action.type === 'require_section' && map[action.sectionKey]) {
      map[action.sectionKey].visible = true
      map[action.sectionKey].required = true
    }
  }

  return map
}
