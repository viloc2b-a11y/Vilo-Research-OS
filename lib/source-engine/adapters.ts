/**
 * Adapters between canonical FieldSpec and legacy catalog FieldDefinition.
 */

import {
  Domain,
  FieldType as CanonicalFieldType,
  type FieldSpec,
  type FieldSpecValidation,
} from '@/lib/source-engine/canonical'
import type {
  ClinicalDomain,
  FieldCondition,
  FieldDefinition,
  FieldValidationRule,
  SourceWidgetType,
} from '@/lib/source-engine/types'

export const CLINICAL_DOMAIN_TO_CANONICAL: Record<ClinicalDomain, Domain> = {
  demographics: Domain.DEMO,
  informed_consent: Domain.ELIGIBILITY,
  medical_history: Domain.MH,
  concomitant_medications: Domain.CM,
  vital_signs: Domain.VITALS,
  physical_exam: Domain.PROCEDURES,
  pregnancy_testing: Domain.PREGNANCY,
  labs: Domain.LABS_LOCAL,
  urinalysis: Domain.LABS_LOCAL,
  ecg: Domain.PROCEDURES,
  adverse_events: Domain.AE,
  rescue_medication: Domain.CM,
  questionnaires: Domain.PROS,
  respiratory_samples: Domain.PROCEDURES,
  biospecimens: Domain.PLASMA,
  investigational_product: Domain.IRT_SUPPLY,
  injection_site: Domain.PROCEDURES,
  ophthalmology: Domain.PROCEDURES,
  adrenal_testing: Domain.LABS_CENTRAL,
  hit_monitoring: Domain.FINDINGS,
  pk_sampling: Domain.PLASMA,
  ediary: Domain.PROS,
}

export const WIDGET_TO_CANONICAL_FIELD_TYPE: Record<SourceWidgetType, CanonicalFieldType> = {
  text: CanonicalFieldType.TEXT,
  textarea: CanonicalFieldType.TEXT,
  number: CanonicalFieldType.NUMBER,
  integer: CanonicalFieldType.NUMBER,
  decimal: CanonicalFieldType.NUMBER,
  date: CanonicalFieldType.DATE,
  datetime: CanonicalFieldType.DATE,
  time: CanonicalFieldType.TIME,
  boolean: CanonicalFieldType.BOOLEAN,
  select: CanonicalFieldType.ENUM,
  radio: CanonicalFieldType.ENUM,
  multiselect: CanonicalFieldType.ENUM_ARRAY,
  checkbox: CanonicalFieldType.BOOLEAN,
  calculated: CanonicalFieldType.NUMBER,
  unit_value: CanonicalFieldType.NUMBER,
  signature: CanonicalFieldType.TEXT,
  file_upload: CanonicalFieldType.FILE,
}

export function defaultSourcePath(domain: ClinicalDomain, fieldKey: string): string {
  const segment = domain.replace(/_/g, '.')
  return `${segment}.${fieldKey}`
}

function isLeafCondition(
  condition: FieldCondition,
): condition is Extract<FieldCondition, { op: Exclude<import('@/lib/source-engine/types').ConditionOperator, 'and' | 'or'> }> {
  return condition.op !== 'and' && condition.op !== 'or'
}

function conditionToConditional(
  condition: FieldCondition | undefined,
): FieldSpec['conditional'] | undefined {
  if (!condition) return undefined
  if (condition.op === 'and' || condition.op === 'or') {
    const first = condition.conditions[0]
    if (!first || !isLeafCondition(first)) return undefined
    const dependsOn = first.fieldKey ?? first.contextKey ?? ''
    return { dependsOn, equals: first.value }
  }
  if (!isLeafCondition(condition)) return undefined
  const dependsOn = condition.fieldKey ?? condition.contextKey ?? ''
  if (!dependsOn) return undefined
  return { dependsOn, equals: condition.value }
}

function validationRulesToSpec(
  rules: FieldValidationRule[] | undefined,
): FieldSpecValidation | undefined {
  if (!rules?.length) return undefined
  const out: FieldSpecValidation = {}
  for (const rule of rules) {
    if (rule.kind === 'min') out.min = rule.value
    if (rule.kind === 'max') out.max = rule.value
    if (rule.kind === 'regex') out.pattern = rule.pattern
    if (rule.kind === 'required') out.message = rule.message
  }
  return Object.keys(out).length > 0 ? out : undefined
}

export function toFieldSpec(def: FieldDefinition): FieldSpec {
  const domain = CLINICAL_DOMAIN_TO_CANONICAL[def.domain]
  return {
    id: def.key,
    domain,
    label: def.label,
    type: WIDGET_TO_CANONICAL_FIELD_TYPE[def.type],
    required: Boolean(def.validation?.some((r) => r.kind === 'required') || def.requiredWhen),
    options: def.options?.map((o) => o.value),
    validation: validationRulesToSpec(def.validation),
    conditional: conditionToConditional(def.visibleWhen ?? def.requiredWhen),
    sourcePath: def.sourcePath ?? defaultSourcePath(def.domain, def.key),
  }
}

export function toFieldSpecs(defs: FieldDefinition[]): FieldSpec[] {
  return defs.map(toFieldSpec)
}

import type { SourceRuntimeContext } from '@/lib/source-engine/types'

/** Build flat + nested rule context (supports `sourcePath` dot lookups). */
export function buildRuleContext(
  responses: Record<string, unknown>,
  extra: Record<string, unknown> = {},
): Record<string, unknown> {
  return { ...extra, ...responses }
}

export function sourceContextToRuleContext(
  context: SourceRuntimeContext,
  specs?: FieldSpec[],
): Record<string, unknown> {
  const extra: Record<string, unknown> = {
    visitType: context.visitType,
    visitWindowStatus: context.visitWindowStatus,
    region: context.region,
    sex: context.sex,
    wocbp: context.wocbp,
    ageGroup: context.ageGroup,
    pharmacokineticSubstudyParticipant: context.pharmacokineticSubstudyParticipant,
    subjectRole: context.subjectRole,
  }

  const ctx = buildRuleContext(
    context.responses as Record<string, unknown>,
    extra,
  )

  for (const [key, val] of Object.entries(context.responses)) {
    if (val !== undefined) {
      ctx[key] = val
    }
  }

  if (specs) {
    for (const spec of specs) {
      const val = context.responses[spec.id]
      if (val !== undefined) {
        ctx[spec.id] = val
        setBySourcePath(ctx, spec.sourcePath, val)
      }
    }
  }

  return ctx
}

export function getBySourcePath(ctx: Record<string, unknown>, path: string): unknown {
  if (path in ctx) return ctx[path]
  const parts = path.split('.')
  let cur: unknown = ctx
  for (const part of parts) {
    if (cur == null || typeof cur !== 'object') return undefined
    cur = (cur as Record<string, unknown>)[part]
  }
  return cur
}

export function setBySourcePath(
  ctx: Record<string, unknown>,
  path: string,
  value: unknown,
): Record<string, unknown> {
  const next = { ...ctx, [path]: value }
  const parts = path.split('.')
  if (parts.length === 1) return next

  let cur: Record<string, unknown> = next
  for (let i = 0; i < parts.length - 1; i++) {
    const p = parts[i]
    if (cur[p] == null || typeof cur[p] !== 'object') {
      cur[p] = {}
    }
    cur = cur[p] as Record<string, unknown>
  }
  cur[parts[parts.length - 1]] = value
  return next
}
