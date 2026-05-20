/**
 * Example source templates — generic multi-domain CRF patterns (not sponsor-confidential).
 */

import { DERIVED_METRICS_CATALOG } from '@/lib/source-engine/calculators/derived-metrics.catalog'
import { pickCatalogFields } from '@/lib/source-engine/definitions/field.catalog'
import {
  ADVERSE_EVENTS_SECTION,
  CONCOMITANT_MEDICATIONS_SECTION,
  LABS_SECTION,
  PK_SAMPLES_SECTION,
} from '@/lib/source-engine/definitions/section.catalog'
import type { SectionDefinition, SourceTemplateDefinition } from '@/lib/source-engine/definitions/types'
import { CLINICAL_RULES_EXAMPLES } from '@/lib/source-engine/rules/clinical-rules.examples'

const VITAL_SIGNS_SECTION: SectionDefinition = {
  id: 'vital_signs',
  label: 'Vital Signs',
  domain: 'vital_signs',
  fieldIds: [
    'height_cm',
    'weight_kg',
    'bmi',
    'temperature',
    'temperature_unit',
    'systolic_bp',
    'diastolic_bp',
    'bp_display',
    'pulse',
    'respiratory_rate',
    'oxygen_saturation',
    'position',
    'rest_period_confirmed',
  ],
  enabledByDefault: true,
}

const PREGNANCY_SECTION: SectionDefinition = {
  id: 'pregnancy_testing',
  label: 'Pregnancy Testing',
  domain: 'pregnancy_testing',
  fieldIds: [
    'pregnancy_test_type',
    'pregnancy_test_result',
    'pregnancy_collection_date',
    'pregnancy_collection_time',
    'wocbp_confirmed',
  ],
  enabledByDefault: false,
}

const ADRENAL_SECTION: SectionDefinition = {
  id: 'adrenal_testing',
  label: 'Adrenal Testing',
  domain: 'adrenal_testing',
  fieldIds: [
    'morning_cortisol',
    'acth',
    'aldosterone',
    'acth_stim_time_0',
    'acth_stim_30_min',
    'acth_stim_60_min',
    'synthetic_steroid_panel_required',
  ],
  enabledByDefault: true,
}

const HIT_SECTION: SectionDefinition = {
  id: 'hit_monitoring',
  label: 'HIT Monitoring',
  domain: 'hit_monitoring',
  fieldIds: [
    'platelet_count',
    'platelet_baseline',
    'platelet_drop_percent',
    'thrombosis_suspected',
    'four_t_score',
    'anti_pf4',
    'serotonin_release_assay',
    'd_dimer',
    'fibrinogen',
  ],
  enabledByDefault: true,
}

const PHYSICAL_EXAM_SECTION: SectionDefinition = {
  id: 'physical_exam',
  label: 'Physical Exam',
  domain: 'physical_exam',
  fieldIds: [],
  enabledByDefault: true,
}

const DEMO_SECTION: SectionDefinition = {
  id: 'demographics',
  label: 'Demographics',
  domain: 'demographics',
  fieldIds: ['sex_at_birth', 'childbearing_potential', 'age'],
  enabledByDefault: true,
}

/**
 * Generic endocrine / immunology / PK pilot template demonstrating:
 * vitals, pregnancy, adrenal, HIT, PK repeatable, remote visit rules, signatures.
 */
/** Production registry id: {@link GENERIC_OA_PHASE3_TEMPLATE} */
export const GENERIC_OA_PHASE3_TEMPLATE: SourceTemplateDefinition = {
  id: 'GENERIC_OA_PHASE3',
  label: 'Generic OA Phase 3',
  version: '1.0.0',
  protocolRef: 'GENERIC-OA-PHASE3',
  sections: [
    DEMO_SECTION,
    VITAL_SIGNS_SECTION,
    PREGNANCY_SECTION,
    ADRENAL_SECTION,
    HIT_SECTION,
    PHYSICAL_EXAM_SECTION,
  ],
  repeatableSections: [
    CONCOMITANT_MEDICATIONS_SECTION,
    ADVERSE_EVENTS_SECTION,
    LABS_SECTION,
    PK_SAMPLES_SECTION,
  ],
  fields: pickCatalogFields([
    'sex_at_birth',
    'childbearing_potential',
    'age',
    'height_cm',
    'weight_kg',
    'bmi',
    'temperature',
    'temperature_unit',
    'systolic_bp',
    'diastolic_bp',
    'bp_display',
    'pulse',
    'respiratory_rate',
    'oxygen_saturation',
    'position',
    'rest_period_confirmed',
    'pregnancy_test_type',
    'pregnancy_test_result',
    'pregnancy_collection_date',
    'pregnancy_collection_time',
    'wocbp_confirmed',
    'morning_cortisol',
    'acth',
    'aldosterone',
    'acth_stim_time_0',
    'acth_stim_30_min',
    'acth_stim_60_min',
    'synthetic_steroid_panel_required',
    'platelet_count',
    'platelet_baseline',
    'platelet_drop_percent',
    'thrombosis_suspected',
    'four_t_score',
    'anti_pf4',
    'serotonin_release_assay',
    'd_dimer',
    'fibrinogen',
    'pharmacokinetic_substudy_participant',
    'nominal_timepoint',
    'actual_collection_time',
    'minutes_from_ip_start',
    'pk_window_status',
    ...CONCOMITANT_MEDICATIONS_SECTION.childFieldIds,
    ...ADVERSE_EVENTS_SECTION.childFieldIds,
    ...LABS_SECTION.childFieldIds,
    ...PK_SAMPLES_SECTION.childFieldIds,
  ]),
  ruleIds: CLINICAL_RULES_EXAMPLES.map((r) => r.id),
  derivedMetricIds: DERIVED_METRICS_CATALOG.map((m) => m.id),
  signaturePolicyId: 'vilo_default_signature',
  auditPolicyId: 'vilo_default_audit',
  config: {
    cortisol: {
      lowThresholdUgDl: 3,
      stimRangeMinUgDl: 3,
      stimRangeMaxUgDl: 10,
      acthPeakFailureUgDl: 18,
      steroidPanelCutoffUgDl: 18,
      usCanadaCountries: ['US', 'CA'],
    },
    hit: {
      plateletDropPercent: 30,
      plateletLowPerUl: 150000,
    },
    pk: {
      windowMinutesBefore: 15,
      windowMinutesAfter: 15,
    },
    visitWindow: {
      warningDaysOutside: 3,
      errorDaysOutside: 7,
    },
  },
}

/** @deprecated Use {@link GENERIC_OA_PHASE3_TEMPLATE} */
export const GENERIC_PHASE3_IMMUNOLOGY_TEMPLATE = GENERIC_OA_PHASE3_TEMPLATE

export const EXAMPLE_TEMPLATES = [GENERIC_OA_PHASE3_TEMPLATE] as const
