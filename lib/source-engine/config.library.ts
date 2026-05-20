/**
 * Unified clinical field catalog by domain.
 * Reusable across study templates — not hardcoded to a single protocol.
 */

import { defaultSourcePath } from '@/lib/source-engine/adapters'
import type { ClinicalDomain, FieldDefinition, SelectOption, SourceWidgetType } from '@/lib/source-engine/types'

function f(
  key: string,
  label: string,
  type: SourceWidgetType,
  domain: ClinicalDomain,
  extra?: Partial<FieldDefinition>,
): FieldDefinition {
  return {
    key,
    label,
    type,
    domain,
    sourcePath: extra?.sourcePath ?? defaultSourcePath(domain, key),
    ...extra,
  }
}

const normalAbnormal: SelectOption[] = [
  { value: 'normal', label: 'Normal' },
  { value: 'abnormal', label: 'Abnormal' },
  { value: 'not_done', label: 'Not done' },
]

const positionOptions: SelectOption[] = [
  { value: 'sitting', label: 'Sitting' },
  { value: 'standing', label: 'Standing' },
  { value: 'supine', label: 'Supine' },
  { value: 'semi_fowler', label: 'Semi-Fowler' },
]

// ---------------------------------------------------------------------------
// Domain catalogs
// ---------------------------------------------------------------------------

export const DEMOGRAPHICS_FIELDS: FieldDefinition[] = [
  f('subject_identifier', 'Subject ID', 'text', 'demographics', { zodSchemaHint: 'z.string().min(1)' }),
  f('date_of_birth', 'Date of birth', 'date', 'demographics'),
  f('sex', 'Sex', 'select', 'demographics', {
    options: [
      { value: 'female', label: 'Female' },
      { value: 'male', label: 'Male' },
      { value: 'other', label: 'Other' },
      { value: 'unknown', label: 'Unknown' },
    ],
  }),
  f('wocbp', 'Woman of childbearing potential', 'boolean', 'demographics', {
    visibleWhen: { op: 'eq', fieldKey: 'sex', value: 'female' },
  }),
]

export const INFORMED_CONSENT_FIELDS: FieldDefinition[] = [
  f('consent_obtained', 'Consent obtained', 'boolean', 'informed_consent'),
  f('consent_version', 'Consent version', 'text', 'informed_consent'),
  f('consent_date', 'Consent date', 'date', 'informed_consent'),
  f('consent_verified_by', 'Verified by', 'text', 'informed_consent'),
  f('reconsent_required', 'Reconsent required', 'boolean', 'informed_consent'),
]

export const MEDICAL_HISTORY_FIELDS: FieldDefinition[] = [
  f('mh_reviewed', 'Medical history reviewed', 'boolean', 'medical_history'),
  f('mh_significant_findings', 'Significant findings', 'textarea', 'medical_history'),
  f('smoking_status', 'Smoking status', 'select', 'medical_history', {
    options: [
      { value: 'never', label: 'Never' },
      { value: 'former', label: 'Former' },
      { value: 'current', label: 'Current' },
    ],
  }),
  f('packs_per_day', 'Packs per day', 'decimal', 'medical_history', {
    visibleWhen: { op: 'eq', fieldKey: 'smoking_status', value: 'current' },
  }),
  f('years_smoked', 'Years smoked', 'decimal', 'medical_history', {
    visibleWhen: { op: 'in', fieldKey: 'smoking_status', value: ['current', 'former'] },
  }),
  f('pack_years', 'Pack-years', 'calculated', 'medical_history', {
    derivedFrom: { targetFieldKey: 'pack_years', formula: 'pack_years', inputs: ['packs_per_day', 'years_smoked'] },
  }),
]

export const CONMED_FIELDS: FieldDefinition[] = [
  f('conmeds_reviewed', 'Concomitant medications reviewed', 'boolean', 'concomitant_medications'),
  f('conmed_changes_since_last', 'Changes since last visit', 'boolean', 'concomitant_medications'),
  f('conmed_comments', 'Comments', 'textarea', 'concomitant_medications'),
]

/** Structured vitals — not a single note field. */
export const VITAL_SIGNS_FIELDS: FieldDefinition[] = [
  f('vitals_performed_datetime', 'Measurement date/time', 'datetime', 'vital_signs'),
  f('height', 'Height', 'unit_value', 'vital_signs', { unit: 'cm', zodSchemaHint: 'unitValue' }),
  f('weight', 'Weight', 'unit_value', 'vital_signs', { unit: 'kg', zodSchemaHint: 'unitValue' }),
  f('bmi', 'BMI', 'calculated', 'vital_signs', {
    derivedFrom: { targetFieldKey: 'bmi', formula: 'bmi', inputs: ['height', 'weight'] },
  }),
  f('temperature', 'Temperature', 'unit_value', 'vital_signs', { unit: '°C' }),
  f('blood_pressure_systolic', 'BP systolic', 'integer', 'vital_signs', { unit: 'mmHg' }),
  f('blood_pressure_diastolic', 'BP diastolic', 'integer', 'vital_signs', { unit: 'mmHg' }),
  f('blood_pressure_combined', 'Blood pressure (display)', 'calculated', 'vital_signs', {
    derivedFrom: {
      targetFieldKey: 'blood_pressure_combined',
      formula: 'blood_pressure_display',
      inputs: ['blood_pressure_systolic', 'blood_pressure_diastolic'],
    },
  }),
  f('pulse', 'Pulse', 'integer', 'vital_signs', { unit: 'bpm' }),
  f('heart_rate', 'Heart rate', 'integer', 'vital_signs', { unit: 'bpm' }),
  f('respiratory_rate', 'Respiratory rate', 'integer', 'vital_signs', { unit: '/min' }),
  f('oxygen_saturation', 'SpO₂', 'integer', 'vital_signs', { unit: '%' }),
  f('position', 'Position', 'select', 'vital_signs', { options: positionOptions }),
  f('rest_period_confirmed', 'Rest period confirmed (≥5 min)', 'boolean', 'vital_signs'),
  f('pre_dose_post_dose', 'Timing vs dose', 'select', 'vital_signs', {
    options: [
      { value: 'pre_dose', label: 'Pre-dose' },
      { value: 'post_dose', label: 'Post-dose' },
      { value: 'not_applicable', label: 'N/A' },
    ],
  }),
  f('vitals_clinically_significant', 'Clinically significant', 'radio', 'vital_signs', {
    options: normalAbnormal,
  }),
  f('vitals_comments', 'Comments', 'textarea', 'vital_signs'),
]

export const PHYSICAL_EXAM_FIELDS: FieldDefinition[] = [
  f('pe_performed', 'Physical exam performed', 'boolean', 'physical_exam'),
  f('pe_result', 'Overall result', 'select', 'physical_exam', { options: normalAbnormal }),
  f('pe_comments', 'Comments', 'textarea', 'physical_exam'),
]

export const PREGNANCY_TESTING_FIELDS: FieldDefinition[] = [
  f('pregnancy_test_required', 'Pregnancy test required', 'boolean', 'pregnancy_testing', {
    visibleWhen: {
      op: 'and',
      conditions: [
        { op: 'eq', fieldKey: 'sex', value: 'female' },
        { op: 'eq', fieldKey: 'wocbp', value: true },
      ],
    },
  }),
  f('pregnancy_test_type', 'Test type', 'select', 'pregnancy_testing', {
    options: [
      { value: 'urine', label: 'Urine' },
      { value: 'serum', label: 'Serum' },
    ],
    visibleWhen: { op: 'eq', fieldKey: 'pregnancy_test_required', value: true },
  }),
  f('pregnancy_test_result', 'Result', 'select', 'pregnancy_testing', {
    options: [
      { value: 'negative', label: 'Negative' },
      { value: 'positive', label: 'Positive' },
      { value: 'not_done', label: 'Not done' },
    ],
    visibleWhen: { op: 'eq', fieldKey: 'pregnancy_test_required', value: true },
  }),
  f('pregnancy_test_datetime', 'Test date/time', 'datetime', 'pregnancy_testing', {
    visibleWhen: { op: 'eq', fieldKey: 'pregnancy_test_required', value: true },
  }),
]

export const LABS_FIELDS: FieldDefinition[] = [
  f('lab_collection_datetime', 'Collection date/time', 'datetime', 'labs'),
  f('lab_panel', 'Panel', 'text', 'labs'),
  f('lab_result_summary', 'Result summary', 'textarea', 'labs'),
  f('lab_abnormal_flag', 'Abnormal flag', 'radio', 'labs', { options: normalAbnormal }),
]

export const URINALYSIS_FIELDS: FieldDefinition[] = [
  f('ua_performed_datetime', 'Performed date/time', 'datetime', 'urinalysis'),
  f('ua_result_summary', 'Result summary', 'textarea', 'urinalysis'),
  f('ua_abnormal_flag', 'Abnormal flag', 'radio', 'urinalysis', { options: normalAbnormal }),
]

export const ECG_FIELDS: FieldDefinition[] = [
  f('ecg_performed_datetime', 'ECG date/time', 'datetime', 'ecg'),
  f('ecg_result_summary', 'Result summary', 'textarea', 'ecg'),
  f('ecg_clinically_significant', 'Clinically significant', 'radio', 'ecg', { options: normalAbnormal }),
]

export const ADVERSE_EVENT_FIELDS: FieldDefinition[] = [
  f('ae_term', 'AE term', 'text', 'adverse_events'),
  f('ae_start_date', 'Start date', 'date', 'adverse_events'),
  f('ae_severity', 'Severity', 'select', 'adverse_events', {
    options: [
      { value: 'mild', label: 'Mild' },
      { value: 'moderate', label: 'Moderate' },
      { value: 'severe', label: 'Severe' },
    ],
  }),
  f('ae_serious', 'Serious', 'boolean', 'adverse_events'),
  f('ae_outcome', 'Outcome', 'select', 'adverse_events', {
    options: [
      { value: 'recovered', label: 'Recovered' },
      { value: 'recovering', label: 'Recovering' },
      { value: 'not_recovered', label: 'Not recovered' },
      { value: 'fatal', label: 'Fatal' },
    ],
  }),
]

export const RESCUE_MEDICATION_FIELDS: FieldDefinition[] = [
  f('rescue_administered', 'Rescue medication administered', 'boolean', 'rescue_medication'),
  f('rescue_agent', 'Agent', 'text', 'rescue_medication'),
  f('rescue_datetime', 'Administration date/time', 'datetime', 'rescue_medication'),
]

export const QUESTIONNAIRE_FIELDS: FieldDefinition[] = [
  f('questionnaire_id', 'Questionnaire', 'select', 'questionnaires'),
  f('questionnaire_score', 'Score', 'number', 'questionnaires'),
  f('questionnaire_completed', 'Completed', 'boolean', 'questionnaires'),
]

export const RESPIRATORY_SAMPLE_FIELDS: FieldDefinition[] = [
  f('resp_sample_collected', 'Sample collected', 'boolean', 'respiratory_samples'),
  f('resp_sample_type', 'Sample type', 'text', 'respiratory_samples'),
  f('resp_collection_datetime', 'Collection date/time', 'datetime', 'respiratory_samples'),
]

export const BIOSPECIMEN_FIELDS: FieldDefinition[] = [
  f('specimen_type', 'Specimen type', 'select', 'biospecimens'),
  f('specimen_collected', 'Collected', 'boolean', 'biospecimens'),
  f('specimen_collection_datetime', 'Collection date/time', 'datetime', 'biospecimens'),
  f('specimen_label_id', 'Label ID', 'text', 'biospecimens'),
]

export const INVESTIGATIONAL_PRODUCT_FIELDS: FieldDefinition[] = [
  f('ip_administered', 'IP administered', 'boolean', 'investigational_product'),
  f('ip_administration_datetime', 'Administration date/time', 'datetime', 'investigational_product'),
  f('ip_dose', 'Dose', 'text', 'investigational_product'),
  f('ip_route', 'Route', 'select', 'investigational_product', {
    options: [
      { value: 'oral', label: 'Oral' },
      { value: 'iv', label: 'IV' },
      { value: 'sc', label: 'SC' },
      { value: 'other', label: 'Other' },
    ],
  }),
]

export const INJECTION_SITE_FIELDS: FieldDefinition[] = [
  f('injection_site_location', 'Injection site', 'text', 'injection_site'),
  f('injection_site_reaction', 'Local reaction', 'select', 'injection_site', { options: normalAbnormal }),
]

export const OPHTHALMOLOGY_FIELDS: FieldDefinition[] = [
  f('ophth_exam_performed', 'Ophthalmology exam performed', 'boolean', 'ophthalmology'),
  f('ophth_result_summary', 'Result summary', 'textarea', 'ophthalmology'),
  f('cas_score', 'CAS Score', 'calculated', 'ophthalmology', {
    derivedFrom: { targetFieldKey: 'cas_score', formula: 'cas_score', inputs: [] },
  }),
]

export const ADRENAL_TESTING_FIELDS: FieldDefinition[] = [
  f('morning_cortisol_ug_dl', 'Morning cortisol', 'decimal', 'adrenal_testing', {
    unit: 'µg/dL',
    instructions: 'Fasting morning sample per protocol.',
  }),
  f('acth_stimulation_performed', 'ACTH stimulation test performed', 'boolean', 'adrenal_testing'),
  f('acth_stimulation_datetime', 'ACTH stim date/time', 'datetime', 'adrenal_testing', {
    visibleWhen: { op: 'eq', fieldKey: 'acth_stimulation_performed', value: true },
  }),
  f('acth_peak_cortisol_ug_dl', 'Peak cortisol post-ACTH', 'decimal', 'adrenal_testing', {
    unit: 'µg/dL',
    visibleWhen: { op: 'eq', fieldKey: 'acth_stimulation_performed', value: true },
  }),
  f('synthetic_steroid_panel_ordered', 'Synthetic steroid panel ordered', 'boolean', 'adrenal_testing'),
]

export const HIT_MONITORING_FIELDS: FieldDefinition[] = [
  f('platelet_count_baseline', 'Baseline platelet count', 'integer', 'hit_monitoring', { unit: '/µL' }),
  f('platelet_count_current', 'Current platelet count', 'integer', 'hit_monitoring', { unit: '/µL' }),
  f('platelet_drop_percent', 'Platelet drop %', 'decimal', 'hit_monitoring'),
  f('thrombosis_suspected', 'Thrombosis suspected', 'boolean', 'hit_monitoring'),
  f('four_t_score', '4T score', 'integer', 'hit_monitoring', {
    validation: [{ kind: 'min', value: 0, message: 'Minimum 0' }, { kind: 'max', value: 8, message: 'Maximum 8' }],
  }),
  f('anti_pf4_ordered', 'Anti-PF4 ordered', 'boolean', 'hit_monitoring'),
  f('anti_pf4_result', 'Anti-PF4 result', 'select', 'hit_monitoring', {
    options: [
      { value: 'positive', label: 'Positive' },
      { value: 'negative', label: 'Negative' },
      { value: 'pending', label: 'Pending' },
    ],
    visibleWhen: { op: 'eq', fieldKey: 'anti_pf4_ordered', value: true },
  }),
  f('d_dimer_ordered', 'D-dimer / fibrinogen ordered', 'boolean', 'hit_monitoring'),
  f('serotonin_release_assay_ordered', 'Serotonin release assay ordered', 'boolean', 'hit_monitoring', {
    visibleWhen: { op: 'eq', fieldKey: 'anti_pf4_result', value: 'positive' },
  }),
]

export const PK_SAMPLING_FIELDS: FieldDefinition[] = [
  f('pk_sample_collected', 'PK sample collected', 'boolean', 'pk_sampling', {
    visibleWhen: {
      op: 'eq',
      contextKey: 'pharmacokineticSubstudyParticipant',
      value: true,
    },
  }),
  f('pk_collection_datetime', 'PK collection date/time', 'datetime', 'pk_sampling', {
    visibleWhen: { op: 'eq', fieldKey: 'pk_sample_collected', value: true },
  }),
  f('pk_timepoint', 'PK timepoint', 'select', 'pk_sampling', {
    visibleWhen: { op: 'eq', fieldKey: 'pk_sample_collected', value: true },
  }),
  f('pk_sample_label', 'Sample label', 'text', 'pk_sampling', {
    visibleWhen: { op: 'eq', fieldKey: 'pk_sample_collected', value: true },
  }),
]

export const EDIARY_FIELDS: FieldDefinition[] = [
  f('ediary_entry_date', 'Entry date', 'date', 'ediary'),
  f('ediary_symptoms_reported', 'Symptoms reported', 'textarea', 'ediary'),
  f('ediary_completed', 'eDiary completed', 'boolean', 'ediary'),
  f('transit_time', 'Transit time', 'calculated', 'ediary', {
    derivedFrom: { targetFieldKey: 'transit_time', formula: 'transit_time', inputs: [] },
  }),
]

// ---------------------------------------------------------------------------
// Unified catalog
// ---------------------------------------------------------------------------

export const CLINICAL_DOMAIN_ORDER: ClinicalDomain[] = [
  'demographics',
  'informed_consent',
  'medical_history',
  'concomitant_medications',
  'vital_signs',
  'physical_exam',
  'pregnancy_testing',
  'labs',
  'urinalysis',
  'ecg',
  'adverse_events',
  'rescue_medication',
  'questionnaires',
  'respiratory_samples',
  'biospecimens',
  'investigational_product',
  'injection_site',
  'ophthalmology',
  'adrenal_testing',
  'hit_monitoring',
  'pk_sampling',
  'ediary',
]

export const CLINICAL_FIELD_CATALOG: Record<ClinicalDomain, FieldDefinition[]> = {
  demographics: DEMOGRAPHICS_FIELDS,
  informed_consent: INFORMED_CONSENT_FIELDS,
  medical_history: MEDICAL_HISTORY_FIELDS,
  concomitant_medications: CONMED_FIELDS,
  vital_signs: VITAL_SIGNS_FIELDS,
  physical_exam: PHYSICAL_EXAM_FIELDS,
  pregnancy_testing: PREGNANCY_TESTING_FIELDS,
  labs: LABS_FIELDS,
  urinalysis: URINALYSIS_FIELDS,
  ecg: ECG_FIELDS,
  adverse_events: ADVERSE_EVENT_FIELDS,
  rescue_medication: RESCUE_MEDICATION_FIELDS,
  questionnaires: QUESTIONNAIRE_FIELDS,
  respiratory_samples: RESPIRATORY_SAMPLE_FIELDS,
  biospecimens: BIOSPECIMEN_FIELDS,
  investigational_product: INVESTIGATIONAL_PRODUCT_FIELDS,
  injection_site: INJECTION_SITE_FIELDS,
  ophthalmology: OPHTHALMOLOGY_FIELDS,
  adrenal_testing: ADRENAL_TESTING_FIELDS,
  hit_monitoring: HIT_MONITORING_FIELDS,
  pk_sampling: PK_SAMPLING_FIELDS,
  ediary: EDIARY_FIELDS,
}

/** All fields flattened with unique keys. */
export function getAllCatalogFields(): FieldDefinition[] {
  return CLINICAL_DOMAIN_ORDER.flatMap((d) => CLINICAL_FIELD_CATALOG[d])
}

export function getCatalogFieldsByDomain(domain: ClinicalDomain): FieldDefinition[] {
  return CLINICAL_FIELD_CATALOG[domain] ?? []
}

export function getCatalogField(key: string): FieldDefinition | undefined {
  return getAllCatalogFields().find((field) => field.key === key)
}

/** Clone catalog fields for template binding (shallow). */
export function pickCatalogFields(keys: string[]): FieldDefinition[] {
  const map = new Map(getAllCatalogFields().map((field) => [field.key, field]))
  return keys.map((key) => map.get(key)).filter((field): field is FieldDefinition => Boolean(field))
}
