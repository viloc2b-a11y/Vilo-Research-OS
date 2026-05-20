/**
 * Runtime rule examples — demonstrates visibility, requirement, validation, derived values.
 * Run via: node scripts/validate-source-engine.mjs
 */

import { sourceContextToRuleContext, toFieldSpecs } from '@/lib/source-engine/adapters'
import {
  applyTriggerRules,
  evaluateBusinessRules,
} from '@/lib/source-engine/engine.canonical'
import {
  calculateDerivedValues,
  evaluateTriggers,
  getRuntimeFieldState,
  resolveEffectiveSections,
  validateTemplate,
} from '@/lib/source-engine/engine.rules'
import {
  GENERIC_PHASE3_IMMUNOLOGY_LEGACY_BUSINESS_RULES,
  GENERIC_PHASE3_IMMUNOLOGY_LEGACY_TRIGGER_RULES,
} from '@/lib/source-engine/rules.generic-phase3-immunology-legacy'
import {
  DYNAMIC_TRIGGERS,
  VILO_BUSINESS_RULES,
} from '@/lib/source-engine/vilo-dynamic-rules'
import { SignatureState } from '@/lib/source-engine/canonical'
import { GENERIC_PHASE3_IMMUNOLOGY_LEGACY_PILOT_TEMPLATE } from '@/lib/source-engine/templates.generic-phase3-immunology-legacy'
import type { SourceRuntimeContext } from '@/lib/source-engine/types'

export function exampleWocbpPregnancyVisibility(): boolean {
  const ctx: SourceRuntimeContext = {
    sex: 'female',
    wocbp: true,
    responses: { sex: 'female', wocbp: true },
    config: GENERIC_PHASE3_IMMUNOLOGY_LEGACY_PILOT_TEMPLATE.config,
  }
  const sections = resolveEffectiveSections(GENERIC_PHASE3_IMMUNOLOGY_LEGACY_PILOT_TEMPLATE, ctx)
  return sections.pregnancy_testing?.visible === true
}

export function exampleLowCortisolActhWorkflow(): boolean {
  const ctx: SourceRuntimeContext = {
    region: 'US',
    responses: { morning_cortisol_ug_dl: 2.1 },
    config: GENERIC_PHASE3_IMMUNOLOGY_LEGACY_PILOT_TEMPLATE.config,
  }
  const { actions } = evaluateTriggers(GENERIC_PHASE3_IMMUNOLOGY_LEGACY_PILOT_TEMPLATE, ctx)
  return actions.some(
    (a) => a.type === 'workflow' && a.title.includes('ACTH'),
  )
}

export function exampleHitMonitoringPathway(): boolean {
  const ctx: SourceRuntimeContext = {
    responses: {
      platelet_count_current: 95_000,
      platelet_drop_percent: 35,
    },
    config: GENERIC_PHASE3_IMMUNOLOGY_LEGACY_PILOT_TEMPLATE.config,
  }
  const sections = resolveEffectiveSections(GENERIC_PHASE3_IMMUNOLOGY_LEGACY_PILOT_TEMPLATE, ctx)
  return sections.hit_monitoring?.visible === true
}

export function exampleBmiDerived(): number | null {
  const ctx: SourceRuntimeContext = {
    responses: {
      height: { value: 170, unit: 'cm' },
      weight: { value: 70, unit: 'kg' },
    },
  }
  const derived = calculateDerivedValues(GENERIC_PHASE3_IMMUNOLOGY_LEGACY_PILOT_TEMPLATE, ctx)
  const bmi = derived.bmi
  return typeof bmi === 'number' ? bmi : null
}

export function exampleVitalsStructuredRequired(): boolean {
  const section = GENERIC_PHASE3_IMMUNOLOGY_LEGACY_PILOT_TEMPLATE.sections.find((s) => s.key === 'vital_signs')!
  const field = section.fields.find((f) => f.key === 'blood_pressure_systolic')!
  const ctx: SourceRuntimeContext = { responses: {} }
  const state = getRuntimeFieldState(field, section, ctx)
  return state.visible && !state.disabled
}

export function examplePositivePregnancyFinding(): boolean {
  const ctx: SourceRuntimeContext = {
    sex: 'female',
    wocbp: true,
    responses: { pregnancy_test_result: 'positive' },
    config: GENERIC_PHASE3_IMMUNOLOGY_LEGACY_PILOT_TEMPLATE.config,
  }
  const result = validateTemplate(GENERIC_PHASE3_IMMUNOLOGY_LEGACY_PILOT_TEMPLATE, ctx)
  return result.findings.some((f) => f.ruleId === 'pregnancy_positive')
}

export function exampleCanonicalBusinessRuleCortisol(): boolean {
  const specs = toFieldSpecs(
    GENERIC_PHASE3_IMMUNOLOGY_LEGACY_PILOT_TEMPLATE.sections.flatMap((s) => s.fields),
  )
  const ctx = sourceContextToRuleContext(
    {
      responses: { morning_cortisol_ug_dl: 2.5 },
      region: 'US',
    },
    specs,
  )
  ctx['adrenal.morning_cortisol_ug_dl'] = 2.5
  const results = evaluateBusinessRules(GENERIC_PHASE3_IMMUNOLOGY_LEGACY_BUSINESS_RULES, ctx)
  return results.some((r) => r.ruleId === 'cortisol_low_acth' && r.fired)
}

export function exampleCanonicalTriggerBmi(): boolean {
  const ctx = buildCanonicalVitalsCtx()
  const { calculated } = applyTriggerRules(GENERIC_PHASE3_IMMUNOLOGY_LEGACY_TRIGGER_RULES, ctx)
  const bmi = calculated['vitals.bmi']
  return typeof bmi === 'number' && Math.abs(bmi - 24.2) < 0.2
}

function buildCanonicalVitalsCtx(): Record<string, unknown> {
  return {
    'vitals.height': { value: 170, unit: 'cm' },
    'vitals.weight': { value: 70, unit: 'kg' },
  }
}

export function exampleViloBmiTrigger(): boolean {
  const ctx = { weight_kg: 70, height_cm: 170 }
  const { calculated } = applyTriggerRules(DYNAMIC_TRIGGERS, ctx)
  return typeof calculated.bmi === 'number' && Math.abs(calculated.bmi - 24.22) < 0.05
}

export function exampleViloHemolysisReject(): boolean {
  const ctx: Record<string, unknown> = { hemolysis_grade: '4_HEMOLYZED' }
  const results = evaluateBusinessRules(VILO_BUSINESS_RULES, ctx)
  const fired = results.find((r) => r.ruleId === 'HEMOLYSIS_REJECT')
  return Boolean(fired?.fired) && ctx.sample_status === 'REJECTED'
}

export function exampleViloIpKitDuplicate(): boolean {
  const contexts = [{ ip_kit_id: 'KIT-001' }, { ip_kit_id: 'KIT-001' }, { ip_kit_id: 'KIT-002' }]
  const results = evaluateBusinessRules(VILO_BUSINESS_RULES, contexts[0], {
    allContexts: contexts,
  })
  return results.some((r) => r.ruleId === 'IP_KIT_DUPLICATE' && r.fired)
}

export function exampleViloSignatureBreak(): boolean {
  const ctx: Record<string, unknown> = {
    signature_state: SignatureState.SIGNED,
    is_edit_mode: true,
  }
  evaluateBusinessRules(VILO_BUSINESS_RULES, ctx)
  return ctx.signature_state === SignatureState.BROKEN
}

export function runAllExamples(): { name: string; pass: boolean }[] {
  return [
    { name: 'WOCBP shows pregnancy section', pass: exampleWocbpPregnancyVisibility() },
    { name: 'Low cortisol fires ACTH workflow', pass: exampleLowCortisolActhWorkflow() },
    { name: 'Platelet risk shows HIT section', pass: exampleHitMonitoringPathway() },
    { name: 'BMI derived ~24.2', pass: Math.abs((exampleBmiDerived() ?? 0) - 24.2) < 0.2 },
    { name: 'Vitals BP field visible', pass: exampleVitalsStructuredRequired() },
    { name: 'Positive pregnancy finding', pass: examplePositivePregnancyFinding() },
    { name: 'Canonical cortisol business rule', pass: exampleCanonicalBusinessRuleCortisol() },
    { name: 'Canonical trigger BMI calculate', pass: exampleCanonicalTriggerBmi() },
    { name: 'Vilo BMI trigger', pass: exampleViloBmiTrigger() },
    { name: 'Vilo hemolysis reject', pass: exampleViloHemolysisReject() },
    { name: 'Vilo IP kit duplicate', pass: exampleViloIpKitDuplicate() },
    { name: 'Vilo signature break on edit', pass: exampleViloSignatureBreak() },
  ]
}
