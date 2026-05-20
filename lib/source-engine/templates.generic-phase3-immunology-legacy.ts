/**
 * Example study template — generic Phase 3 immunology / endocrine pilot slice.
 * Composes catalog fields into sections; wires conditional triggers.
 */

import { pickCatalogFields } from '@/lib/source-engine/config.library'
import type {
  ConditionalTrigger,
  SourceSectionDefinition,
  SourceTemplateDefinition,
  StudyEngineConfig,
} from '@/lib/source-engine/types'

export const GENERIC_PHASE3_IMMUNOLOGY_LEGACY_ENGINE_CONFIG: StudyEngineConfig = {
  cortisol: {
    lowThresholdUgDl: 3,
    stimRangeMinUgDl: 3,
    stimRangeMaxUgDl: 10,
    acthPeakFailureUgDl: 18,
    steroidPanelCutoffUgDl: 15,
    usCanadaRegions: ['US', 'CA', 'United States', 'Canada'],
  },
  hit: {
    plateletDropPercent: 30,
    plateletLowPerUl: 150_000,
  },
}

function section(
  key: string,
  label: string,
  fieldKeys: string[],
  extra?: Partial<SourceSectionDefinition>,
): SourceSectionDefinition {
  return {
    key,
    label,
    fields: pickCatalogFields(fieldKeys),
    enabledByDefault: true,
    ...extra,
  }
}

export const GENERIC_PHASE3_IMMUNOLOGY_LEGACY_PILOT_SECTIONS: SourceSectionDefinition[] = [
  section('vital_signs', 'Vital Signs', [
    'vitals_performed_datetime',
    'height',
    'weight',
    'bmi',
    'temperature',
    'blood_pressure_systolic',
    'blood_pressure_diastolic',
    'blood_pressure_combined',
    'pulse',
    'heart_rate',
    'respiratory_rate',
    'oxygen_saturation',
    'position',
    'rest_period_confirmed',
    'pre_dose_post_dose',
    'vitals_clinically_significant',
    'vitals_comments',
  ], {
    domain: 'vital_signs',
    instructions: 'Structured vitals per protocol — not a narrative-only note.',
    partial: true,
    signatures: [
      { role: 'coordinator', label: 'Coordinator attestation', lockSectionOnSign: false },
    ],
  }),
  section('pregnancy_testing', 'Pregnancy Testing', [
    'pregnancy_test_required',
    'pregnancy_test_type',
    'pregnancy_test_result',
    'pregnancy_test_datetime',
  ], {
    domain: 'pregnancy_testing',
    partial: true,
    enabledByDefault: false,
    visibleWhen: {
      op: 'and',
      conditions: [
        { op: 'eq', contextKey: 'sex', value: 'female' },
        { op: 'eq', contextKey: 'wocbp', value: true },
      ],
    },
  }),
  section('adrenal_testing', 'Adrenal Testing', [
    'morning_cortisol_ug_dl',
    'acth_stimulation_performed',
    'acth_stimulation_datetime',
    'acth_peak_cortisol_ug_dl',
    'synthetic_steroid_panel_ordered',
  ], {
    domain: 'adrenal_testing',
    partial: true,
    enabledByDefault: true,
  }),
  section('hit_monitoring', 'HIT / Platelet Monitoring', [
    'platelet_count_baseline',
    'platelet_count_current',
    'platelet_drop_percent',
    'thrombosis_suspected',
    'four_t_score',
    'anti_pf4_ordered',
    'anti_pf4_result',
    'd_dimer_ordered',
    'serotonin_release_assay_ordered',
  ], {
    domain: 'hit_monitoring',
    partial: true,
    enabledByDefault: false,
  }),
  section('pk_sampling', 'PK Sampling', [
    'pk_sample_collected',
    'pk_collection_datetime',
    'pk_timepoint',
    'pk_sample_label',
  ], {
    domain: 'pk_sampling',
    partial: true,
    enabledByDefault: false,
    visibleWhen: {
      op: 'eq',
      contextKey: 'pharmacokineticSubstudyParticipant',
      value: true,
    },
  }),
]

export const GENERIC_PHASE3_IMMUNOLOGY_LEGACY_PILOT_TRIGGERS: ConditionalTrigger[] = [
  {
    id: 'wocbp_pregnancy',
    label: 'WOCBP → pregnancy test',
    when: {
      op: 'and',
      conditions: [
        { op: 'eq', contextKey: 'sex', value: 'female' },
        { op: 'eq', contextKey: 'wocbp', value: true },
      ],
    },
    actions: [
      { type: 'show_section', sectionKey: 'pregnancy_testing' },
      { type: 'require_field', fieldKey: 'pregnancy_test_result' },
    ],
  },
  {
    id: 'cortisol_low_acth',
    label: 'Low cortisol → ACTH required',
    when: { op: 'lt', fieldKey: 'morning_cortisol_ug_dl', value: 3 },
    actions: [
      { type: 'show_section', sectionKey: 'adrenal_testing' },
      { type: 'require_field', fieldKey: 'acth_stimulation_performed' },
      {
        type: 'workflow',
        workflowKind: 'follow_up',
        title: 'ACTH stimulation test required',
      },
    ],
  },
  {
    id: 'hit_pathway',
    label: 'Platelet / thrombosis → HIT panel',
    when: {
      op: 'or',
      conditions: [
        { op: 'gte', fieldKey: 'platelet_drop_percent', value: 30 },
        { op: 'lt', fieldKey: 'platelet_count_current', value: 150_000 },
        { op: 'eq', fieldKey: 'thrombosis_suspected', value: true },
      ],
    },
    actions: [
      { type: 'show_section', sectionKey: 'hit_monitoring' },
      { type: 'require_field', fieldKey: 'four_t_score' },
      { type: 'workflow', workflowKind: 'follow_up', title: 'HIT monitoring pathway' },
    ],
  },
  {
    id: 'anti_pf4_positive_sra',
    label: 'Anti-PF4 positive → SRA',
    when: { op: 'eq', fieldKey: 'anti_pf4_result', value: 'positive' },
    actions: [{ type: 'require_field', fieldKey: 'serotonin_release_assay_ordered' }],
  },
  {
    id: 'pharmacokinetic_substudy',
    label: 'Pharmacokinetic substudy participant',
    when: {
      op: 'eq',
      contextKey: 'pharmacokineticSubstudyParticipant',
      value: true,
    },
    actions: [{ type: 'show_section', sectionKey: 'pk_sampling' }],
  },
  {
    id: 'phone_visit_restrictions',
    label: 'Phone/off-site visit restrictions',
    when: { op: 'in', contextKey: 'visitType', value: ['phone', 'off_site'] },
    actions: [
      { type: 'hide_section', sectionKey: 'biospecimens' },
      { type: 'hide_section', sectionKey: 'investigational_product' },
    ],
  },
]

export const GENERIC_PHASE3_IMMUNOLOGY_LEGACY_PILOT_TEMPLATE: SourceTemplateDefinition = {
  id: 'generic_phase3_immunology_legacy_pilot',
  label: 'Generic Phase 3 Immunology — Legacy Source Engine Template',
  version: '1.0.0',
  protocolRef: 'GENERIC-PHASE3-IMMUNOLOGY',
  sections: GENERIC_PHASE3_IMMUNOLOGY_LEGACY_PILOT_SECTIONS,
  triggers: GENERIC_PHASE3_IMMUNOLOGY_LEGACY_PILOT_TRIGGERS,
  config: GENERIC_PHASE3_IMMUNOLOGY_LEGACY_ENGINE_CONFIG,
}
