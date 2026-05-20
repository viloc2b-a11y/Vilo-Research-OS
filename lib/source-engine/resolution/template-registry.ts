/**
 * Study-agnostic Source Engine template registry (Phase 3D).
 * Keys are generic — no sponsor/protocol-specific identifiers.
 */

import { DERIVED_METRICS_CATALOG } from '@/lib/source-engine/calculators/derived-metrics.catalog'
import { pickCatalogFields } from '@/lib/source-engine/definitions/field.catalog'
import {
  LABS_SECTION,
  PK_SAMPLES_SECTION,
} from '@/lib/source-engine/definitions/section.catalog'
import type {
  DerivedMetricDefinition,
  RuleDefinition,
  SourceTemplateDefinition,
} from '@/lib/source-engine/definitions/types'
import { GENERIC_OA_PHASE3_TEMPLATE } from '@/lib/source-engine/definitions/template.examples'
import { CLINICAL_RULES_EXAMPLES } from '@/lib/source-engine/rules/clinical-rules.examples'

export const REGISTRY_TEMPLATE_IDS = [
  'GENERIC_OA_PHASE3_TEMPLATE',
  'GENERIC_RESPIRATORY_PHASE3_TEMPLATE',
  'GENERIC_BIOSPECIMEN_COLLECTION_TEMPLATE',
] as const

export type RegistryTemplateId = (typeof REGISTRY_TEMPLATE_IDS)[number]

const VITALS_SECTION = GENERIC_OA_PHASE3_TEMPLATE.sections.find((s) => s.id === 'vital_signs')!

const GENERIC_RESPIRATORY_PHASE3_TEMPLATE: SourceTemplateDefinition = {
  id: 'GENERIC_RESPIRATORY_PHASE3',
  label: 'Generic Respiratory Phase 3',
  version: '1.0.0',
  protocolRef: 'GENERIC-RESPIRATORY-PHASE3',
  sections: [
    VITALS_SECTION,
    {
      id: 'respiratory_assessment',
      label: 'Respiratory Assessment',
      domain: 'vital_signs',
      fieldIds: ['respiratory_rate', 'oxygen_saturation', 'position', 'rest_period_confirmed'],
      enabledByDefault: true,
    },
  ],
  repeatableSections: [LABS_SECTION],
  fields: pickCatalogFields([
    'height_cm',
    'weight_kg',
    'bmi',
    'respiratory_rate',
    'oxygen_saturation',
    'position',
    'rest_period_confirmed',
    'systolic_bp',
    'diastolic_bp',
    ...LABS_SECTION.childFieldIds,
  ]),
  ruleIds: ['RULE_WOCBP_PREGNANCY', 'RULE_REMOTE_VISIT_LIMITS'],
  derivedMetricIds: ['bmi', 'blood_pressure_display', 'visit_window_status'],
  signaturePolicyId: 'vilo_default_signature',
  auditPolicyId: 'vilo_default_audit',
  config: GENERIC_OA_PHASE3_TEMPLATE.config,
}

const GENERIC_BIOSPECIMEN_COLLECTION_TEMPLATE: SourceTemplateDefinition = {
  id: 'GENERIC_BIOSPECIMEN_COLLECTION',
  label: 'Generic Biospecimen Collection',
  version: '1.0.0',
  protocolRef: 'GENERIC-BIOSPECIMEN-COLLECTION',
  sections: [
    {
      id: 'pk_eligibility',
      label: 'PK / Biospecimen Eligibility',
      domain: 'pk_sampling',
      fieldIds: ['pharmacokinetic_substudy_participant'],
      enabledByDefault: true,
    },
  ],
  repeatableSections: [PK_SAMPLES_SECTION],
  fields: pickCatalogFields([
    'pharmacokinetic_substudy_participant',
    'nominal_timepoint',
    'actual_collection_time',
    'minutes_from_ip_start',
    'pk_window_status',
    ...PK_SAMPLES_SECTION.childFieldIds,
  ]),
  ruleIds: ['RULE_PHARMACOKINETIC_SUBSTUDY_SECTION'],
  derivedMetricIds: ['pk_window_status', 'minutes_from_ip_start'],
  signaturePolicyId: 'vilo_default_signature',
  auditPolicyId: 'vilo_default_audit',
  config: GENERIC_OA_PHASE3_TEMPLATE.config,
}

const TEMPLATE_BY_ID: Record<RegistryTemplateId, SourceTemplateDefinition> = {
  GENERIC_OA_PHASE3_TEMPLATE,
  GENERIC_RESPIRATORY_PHASE3_TEMPLATE,
  GENERIC_BIOSPECIMEN_COLLECTION_TEMPLATE,
}

const RULES_BY_TEMPLATE: Record<RegistryTemplateId, RuleDefinition[]> = {
  GENERIC_OA_PHASE3_TEMPLATE: CLINICAL_RULES_EXAMPLES,
  GENERIC_RESPIRATORY_PHASE3_TEMPLATE: CLINICAL_RULES_EXAMPLES.filter((r) =>
    ['RULE_WOCBP_PREGNANCY', 'RULE_REMOTE_VISIT_LIMITS'].includes(r.id),
  ),
  GENERIC_BIOSPECIMEN_COLLECTION_TEMPLATE: CLINICAL_RULES_EXAMPLES.filter((r) =>
    r.id === 'RULE_PHARMACOKINETIC_SUBSTUDY_SECTION',
  ),
}

const METRICS_BY_TEMPLATE: Record<RegistryTemplateId, DerivedMetricDefinition[]> = {
  GENERIC_OA_PHASE3_TEMPLATE: DERIVED_METRICS_CATALOG,
  GENERIC_RESPIRATORY_PHASE3_TEMPLATE: DERIVED_METRICS_CATALOG.filter((m) =>
    ['bmi', 'blood_pressure_display', 'visit_window_status'].includes(m.id),
  ),
  GENERIC_BIOSPECIMEN_COLLECTION_TEMPLATE: DERIVED_METRICS_CATALOG.filter((m) =>
    ['pk_window_status', 'minutes_from_ip_start'].includes(m.id),
  ),
}

/** Optional study-level bindings (study UUID → registry template id). */
export const STUDY_SOURCE_ENGINE_BINDINGS: Record<string, RegistryTemplateId> = {}

export function isRegistryTemplateId(value: string): value is RegistryTemplateId {
  return (REGISTRY_TEMPLATE_IDS as readonly string[]).includes(value)
}

const TEMPLATE_ID_TO_REGISTRY: Record<string, RegistryTemplateId> = {
  GENERIC_OA_PHASE3: 'GENERIC_OA_PHASE3_TEMPLATE',
  GENERIC_RESPIRATORY_PHASE3: 'GENERIC_RESPIRATORY_PHASE3_TEMPLATE',
  GENERIC_BIOSPECIMEN_COLLECTION: 'GENERIC_BIOSPECIMEN_COLLECTION_TEMPLATE',
}

export function getTemplateByRegistryId(id: string): SourceTemplateDefinition | null {
  if (isRegistryTemplateId(id)) return TEMPLATE_BY_ID[id]
  const mapped = TEMPLATE_ID_TO_REGISTRY[id]
  if (mapped) return TEMPLATE_BY_ID[mapped]
  return null
}

export function resolveRegistryIdFromTemplateKey(key: string): RegistryTemplateId | null {
  if (isRegistryTemplateId(key)) return key
  if (TEMPLATE_ID_TO_REGISTRY[key]) return TEMPLATE_ID_TO_REGISTRY[key]
  const mapped = mapProvenanceHintToRegistryKey(key)
  return mapped
}

function mapProvenanceHintToRegistryKey(hint: string): RegistryTemplateId | null {
  const h = hint.toUpperCase()
  if (h.includes('BIOSPECIMEN') || h.includes('PK') || h.includes('SPECIMEN')) {
    return 'GENERIC_BIOSPECIMEN_COLLECTION_TEMPLATE'
  }
  if (h.includes('RESPIRATORY') || h.includes('SPIRO') || h.includes('PULM')) {
    return 'GENERIC_RESPIRATORY_PHASE3_TEMPLATE'
  }
  if (h.includes('IMMUNO') || h.includes('ENDOCRINE') || h.includes('OA')) {
    return 'GENERIC_OA_PHASE3_TEMPLATE'
  }
  return null
}

export function getRulesForRegistryTemplate(id: RegistryTemplateId): RuleDefinition[] {
  return RULES_BY_TEMPLATE[id]
}

export function getMetricsForRegistryTemplate(id: RegistryTemplateId): DerivedMetricDefinition[] {
  return METRICS_BY_TEMPLATE[id]
}

/** Dev/fallback only — not production source of truth. */
export function getFallbackGenericTemplate(): SourceTemplateDefinition {
  return GENERIC_OA_PHASE3_TEMPLATE
}

export function getFallbackGenericRules(): RuleDefinition[] {
  return CLINICAL_RULES_EXAMPLES
}

export function getFallbackGenericMetrics(): DerivedMetricDefinition[] {
  return DERIVED_METRICS_CATALOG
}
