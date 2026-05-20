/**
 * Phase 1 foundation examples — lightweight acceptance checks (no test runner required).
 */

import { DERIVED_METRICS_CATALOG } from '@/lib/source-engine/calculators/derived-metrics.catalog'
import { calculateBmi } from '@/lib/source-engine/calculators/clinical-calculators'
import { GENERIC_PHASE3_IMMUNOLOGY_TEMPLATE } from '@/lib/source-engine/definitions/template.examples'
import { CLINICAL_RULES_EXAMPLES } from '@/lib/source-engine/rules/clinical-rules.examples'
import { evaluateCondition } from '@/lib/source-engine/rules/rule-engine'
import { createEmptyResponses, type RuntimeContext } from '@/lib/source-engine/runtime/runtime-context'
import { resolveSourceRuntime } from '@/lib/source-engine/runtime/runtime-resolver'
import { validateForSignature } from '@/lib/source-engine/validators/validation-engine'

function baseContext(overrides: Partial<RuntimeContext> = {}): RuntimeContext {
  return {
    studyId: 'study-1',
    studyVersionId: 'sv-1',
    siteId: 'site-1',
    subjectId: 'subj-1',
    visitId: 'visit-1',
    visitName: 'Visit 2',
    visitType: 'treatment',
    visitDate: '2026-05-15',
    scheduledDate: '2026-05-14',
    country: 'US',
    timezone: 'America/New_York',
    isScreening: false,
    isTreatment: true,
    isFollowUp: false,
    isPhoneVisit: false,
    isOffSiteVisit: false,
    isPharmacokineticSubstudy: false,
    sexAtBirth: 'female',
    wocbp: true,
    subjectAge: 42,
    userRole: 'coordinator',
    signatureState: 'unsigned',
    locked: false,
    ...overrides,
  }
}

export function exampleBmiCalculation(): boolean {
  const bmi = calculateBmi({ value: 170, unit: 'cm' }, { value: 70, unit: 'kg' })
  return bmi != null && Math.abs(bmi - 24.22) < 0.1
}

export function exampleWocbpPregnancyRule(): boolean {
  const responses = createEmptyResponses()
  const ctx = baseContext()
  const rule = CLINICAL_RULES_EXAMPLES.find((r) => r.id === 'RULE_WOCBP_PREGNANCY')!
  return evaluateCondition(rule.when, responses, ctx)
}

export function exampleHitWorkupRule(): boolean {
  const responses = createEmptyResponses()
  responses.fields.platelet_drop_percent = 35
  const ctx = baseContext()
  const rule = CLINICAL_RULES_EXAMPLES.find((r) => r.id === 'RULE_HIT_WORKUP')!
  return evaluateCondition(rule.when, responses, ctx)
}

export function exampleResolveRuntime(): boolean {
  const responses = createEmptyResponses()
  responses.fields.height_cm = { value: 165, unit: 'cm' }
  responses.fields.weight_kg = { value: 60, unit: 'kg' }
  responses.fields.sex_at_birth = 'female'
  const snapshot = resolveSourceRuntime(
    GENERIC_PHASE3_IMMUNOLOGY_TEMPLATE,
    responses,
    baseContext({ wocbp: true }),
    { rules: CLINICAL_RULES_EXAMPLES, metrics: DERIVED_METRICS_CATALOG },
  )
  return (
    snapshot.derivedValues.bmi != null &&
    snapshot.fields.pregnancy_test_result?.visible === true
  )
}

export function exampleSignedLockedValidation(): boolean {
  const responses = createEmptyResponses()
  responses.previousFields = { height_cm: { value: 160, unit: 'cm' } }
  responses.fields.height_cm = { value: 165, unit: 'cm' }
  const summary = validateForSignature(
    GENERIC_PHASE3_IMMUNOLOGY_TEMPLATE,
    responses,
    baseContext({ signatureState: 'signed', locked: false }),
  )
  return summary.blocksSignature
}

export function runPhase1Examples(): { name: string; pass: boolean }[] {
  return [
    { name: 'BMI calculation', pass: exampleBmiCalculation() },
    { name: 'WOCBP pregnancy rule condition', pass: exampleWocbpPregnancyRule() },
    { name: 'HIT workup rule condition', pass: exampleHitWorkupRule() },
    { name: 'Resolve runtime snapshot', pass: exampleResolveRuntime() },
    { name: 'Signed source edit blocks signature', pass: exampleSignedLockedValidation() },
  ]
}
