/**
 * Reusable clinical field catalog by domain.
 * No inline conditional logic — rules live in rules/clinical-rules.examples.ts.
 */

import { defaultSourcePath } from '@/lib/source-engine/definitions/domains'
import type { ClinicalDomain, FieldDefinition, FieldType, SelectOption } from '@/lib/source-engine/definitions/types'

function field(
  id: string,
  label: string,
  type: FieldType,
  domain: ClinicalDomain,
  extra?: Partial<FieldDefinition>,
): FieldDefinition {
  return {
    id,
    label,
    type,
    domain,
    sourcePath: extra?.sourcePath ?? defaultSourcePath(domain, id),
    ...extra,
  }
}

const yesNo: SelectOption[] = [
  { value: 'yes', label: 'Yes' },
  { value: 'no', label: 'No' },
]

const sexOptions: SelectOption[] = [
  { value: 'female', label: 'Female' },
  { value: 'male', label: 'Male' },
  { value: 'other', label: 'Other' },
  { value: 'unknown', label: 'Unknown' },
]

// ---------------------------------------------------------------------------
// Vital Signs
// ---------------------------------------------------------------------------

export const VITAL_SIGNS_FIELDS: FieldDefinition[] = [
  field('height_cm', 'Height (cm)', 'unit_value', 'vital_signs', { unit: 'cm' }),
  field('weight_kg', 'Weight (kg)', 'unit_value', 'vital_signs', { unit: 'kg' }),
  field('bmi', 'BMI (kg/m²)', 'calculated', 'vital_signs', {
    derivedMetricId: 'bmi',
  }),
  field('temperature', 'Temperature', 'decimal', 'vital_signs'),
  field('temperature_unit', 'Temperature unit', 'select', 'vital_signs', {
    options: [
      { value: 'C', label: '°C' },
      { value: 'F', label: '°F' },
    ],
  }),
  field('systolic_bp', 'Systolic BP (mmHg)', 'integer', 'vital_signs', {
    validation: { min: 70, max: 250 },
  }),
  field('diastolic_bp', 'Diastolic BP (mmHg)', 'integer', 'vital_signs', {
    validation: { min: 40, max: 150 },
  }),
  field('pulse', 'Pulse (bpm)', 'integer', 'vital_signs', { validation: { min: 30, max: 220 } }),
  field('heart_rate', 'Heart rate (bpm)', 'integer', 'vital_signs'),
  field('respiratory_rate', 'Respiratory rate', 'integer', 'vital_signs'),
  field('oxygen_saturation', 'SpO₂ (%)', 'integer', 'vital_signs', {
    validation: { min: 50, max: 100 },
  }),
  field('position', 'Position', 'select', 'vital_signs', {
    options: [
      { value: 'sitting', label: 'Sitting' },
      { value: 'standing', label: 'Standing' },
      { value: 'supine', label: 'Supine' },
    ],
  }),
  field('rest_period_confirmed', 'Rest period confirmed', 'boolean', 'vital_signs'),
  field('bp_display', 'Blood pressure display', 'calculated', 'vital_signs', {
    derivedMetricId: 'blood_pressure_display',
  }),
]

// ---------------------------------------------------------------------------
// Demographics
// ---------------------------------------------------------------------------

export const DEMOGRAPHICS_FIELDS: FieldDefinition[] = [
  field('date_of_birth', 'Date of birth', 'date', 'demographics'),
  field('birth_year', 'Birth year', 'integer', 'demographics', {
    validation: { min: 1900, max: 2100 },
  }),
  field('age', 'Age (years)', 'integer', 'demographics'),
  field('sex_at_birth', 'Sex at birth', 'select', 'demographics', { options: sexOptions }),
  field('ethnicity', 'Ethnicity', 'select', 'demographics', {
    options: [
      { value: 'hispanic_latino', label: 'Hispanic or Latino' },
      { value: 'not_hispanic_latino', label: 'Not Hispanic or Latino' },
      { value: 'unknown', label: 'Unknown' },
    ],
  }),
  field('race', 'Race', 'multiselect', 'demographics', {
    options: [
      { value: 'white', label: 'White' },
      { value: 'black', label: 'Black or African American' },
      { value: 'asian', label: 'Asian' },
      { value: 'native', label: 'American Indian / Alaska Native' },
      { value: 'pacific', label: 'Native Hawaiian / Pacific Islander' },
      { value: 'other', label: 'Other' },
    ],
  }),
  field('childbearing_potential', 'Childbearing potential', 'boolean', 'demographics'),
]

// ---------------------------------------------------------------------------
// Medical History (row-level fields for repeatable section)
// ---------------------------------------------------------------------------

export const MEDICAL_HISTORY_ROW_FIELDS: FieldDefinition[] = [
  field('condition_term', 'Condition', 'text', 'medical_history', {
    validation: { required: true, minLength: 1 },
  }),
  field('mh_start_date', 'Start date', 'date', 'medical_history', { sourcePath: 'mh.start_date' }),
  field('mh_end_date', 'End date', 'date', 'medical_history', { sourcePath: 'mh.end_date' }),
  field('mh_ongoing', 'Ongoing', 'boolean', 'medical_history', { sourcePath: 'mh.ongoing' }),
  field('clinically_significant', 'Clinically significant', 'boolean', 'medical_history'),
  field('related_to_eligibility', 'Related to eligibility', 'boolean', 'medical_history'),
]

// ---------------------------------------------------------------------------
// Concomitant Medications
// ---------------------------------------------------------------------------

export const CONMED_ROW_FIELDS: FieldDefinition[] = [
  field('medication_name', 'Medication', 'text', 'concomitant_medications', {
    validation: { required: true },
  }),
  field('indication', 'Indication', 'text', 'concomitant_medications'),
  field('dose', 'Dose', 'decimal', 'concomitant_medications'),
  field('dose_unit', 'Dose unit', 'text', 'concomitant_medications'),
  field('route', 'Route', 'select', 'concomitant_medications', {
    options: [
      { value: 'oral', label: 'Oral' },
      { value: 'iv', label: 'IV' },
      { value: 'sc', label: 'Subcutaneous' },
      { value: 'topical', label: 'Topical' },
      { value: 'other', label: 'Other' },
    ],
  }),
  field('frequency', 'Frequency', 'text', 'concomitant_medications'),
  field('conmed_start_date', 'Start date', 'date', 'concomitant_medications', {
    sourcePath: 'conmed.start_date',
  }),
  field('conmed_end_date', 'End date', 'date', 'concomitant_medications', {
    sourcePath: 'conmed.end_date',
  }),
  field('conmed_ongoing', 'Ongoing', 'boolean', 'concomitant_medications', {
    sourcePath: 'conmed.ongoing',
  }),
  field('related_ae_id', 'Related AE', 'text', 'concomitant_medications'),
  field('related_medical_history_id', 'Related MH', 'text', 'concomitant_medications'),
]

// ---------------------------------------------------------------------------
// Adverse Events
// ---------------------------------------------------------------------------

export const ADVERSE_EVENT_ROW_FIELDS: FieldDefinition[] = [
  field('ae_term', 'AE term', 'text', 'adverse_events', { validation: { required: true } }),
  field('onset_date', 'Onset date', 'date', 'adverse_events'),
  field('outcome', 'Outcome', 'select', 'adverse_events', {
    options: [
      { value: 'recovered', label: 'Recovered' },
      { value: 'recovering', label: 'Recovering' },
      { value: 'not_recovered', label: 'Not recovered' },
      { value: 'fatal', label: 'Fatal' },
      { value: 'unknown', label: 'Unknown' },
    ],
  }),
  field('severity', 'Severity', 'select', 'adverse_events', {
    options: [
      { value: 'mild', label: 'Mild' },
      { value: 'moderate', label: 'Moderate' },
      { value: 'severe', label: 'Severe' },
      { value: 'life_threatening', label: 'Life-threatening' },
    ],
  }),
  field('seriousness', 'Serious', 'boolean', 'adverse_events'),
  field('relationship_to_ip', 'Relationship to IP', 'select', 'adverse_events', {
    options: [
      { value: 'unrelated', label: 'Unrelated' },
      { value: 'possible', label: 'Possible' },
      { value: 'probable', label: 'Probable' },
      { value: 'definite', label: 'Definite' },
    ],
  }),
  field('action_taken', 'Action taken', 'textarea', 'adverse_events'),
  field('ae_end_date', 'End date', 'date', 'adverse_events', { sourcePath: 'ae.end_date' }),
  field('caused_study_discontinuation', 'Caused study discontinuation', 'boolean', 'adverse_events'),
]

// ---------------------------------------------------------------------------
// Labs
// ---------------------------------------------------------------------------

export const LAB_ROW_FIELDS: FieldDefinition[] = [
  field('specimen_type', 'Specimen type', 'select', 'labs', {
    options: [
      { value: 'blood', label: 'Blood' },
      { value: 'urine', label: 'Urine' },
      { value: 'plasma', label: 'Plasma' },
      { value: 'serum', label: 'Serum' },
    ],
  }),
  field('collection_date', 'Collection date', 'date', 'labs'),
  field('collection_time', 'Collection time', 'time', 'labs'),
  field('result_value', 'Result', 'decimal', 'labs'),
  field('result_unit', 'Unit', 'text', 'labs'),
  field('reference_low', 'Reference low', 'decimal', 'labs'),
  field('reference_high', 'Reference high', 'decimal', 'labs'),
  field('abnormal_flag', 'Abnormal flag', 'select', 'labs', {
    options: [
      { value: 'normal', label: 'Normal' },
      { value: 'low', label: 'Low' },
      { value: 'high', label: 'High' },
      { value: 'critical', label: 'Critical' },
    ],
  }),
  field('lab_clinically_significant', 'Clinically significant', 'boolean', 'labs', {
    sourcePath: 'labs.clinically_significant',
  }),
  field('investigator_assessment', 'Investigator assessment', 'textarea', 'labs'),
]

// ---------------------------------------------------------------------------
// Pregnancy
// ---------------------------------------------------------------------------

export const PREGNANCY_FIELDS: FieldDefinition[] = [
  field('pregnancy_test_type', 'Test type', 'select', 'pregnancy_testing', {
    options: [
      { value: 'urine', label: 'Urine' },
      { value: 'serum', label: 'Serum' },
    ],
  }),
  field('pregnancy_test_result', 'Result', 'select', 'pregnancy_testing', {
    options: [
      { value: 'negative', label: 'Negative' },
      { value: 'positive', label: 'Positive' },
      { value: 'not_done', label: 'Not done' },
    ],
  }),
  field('pregnancy_collection_date', 'Collection date', 'date', 'pregnancy_testing', {
    sourcePath: 'pregnancy.collection_date',
  }),
  field('pregnancy_collection_time', 'Collection time', 'time', 'pregnancy_testing', {
    sourcePath: 'pregnancy.collection_time',
  }),
  field('wocbp_confirmed', 'WOCBP confirmed', 'boolean', 'pregnancy_testing'),
]

// ---------------------------------------------------------------------------
// Adrenal Testing
// ---------------------------------------------------------------------------

export const ADRENAL_TESTING_FIELDS: FieldDefinition[] = [
  field('morning_cortisol', 'Morning cortisol (µg/dL)', 'decimal', 'adrenal_testing'),
  field('acth', 'ACTH', 'decimal', 'adrenal_testing'),
  field('aldosterone', 'Aldosterone', 'decimal', 'adrenal_testing'),
  field('prc_pra', 'PRC/PRA', 'decimal', 'adrenal_testing'),
  field('dhea_s', 'DHEA-S', 'decimal', 'adrenal_testing'),
  field('cortisol_binding_globulin', 'Cortisol binding globulin', 'decimal', 'adrenal_testing'),
  field('acth_stim_time_0', 'ACTH stim T0', 'decimal', 'adrenal_testing'),
  field('acth_stim_30_min', 'ACTH stim 30 min', 'decimal', 'adrenal_testing'),
  field('acth_stim_60_min', 'ACTH stim 60 min', 'decimal', 'adrenal_testing'),
  field('synthetic_steroid_panel_required', 'Synthetic steroid panel required', 'boolean', 'adrenal_testing'),
]

// ---------------------------------------------------------------------------
// HIT Monitoring
// ---------------------------------------------------------------------------

export const HIT_MONITORING_FIELDS: FieldDefinition[] = [
  field('platelet_count', 'Platelet count', 'integer', 'hit_monitoring'),
  field('platelet_baseline', 'Platelet baseline', 'integer', 'hit_monitoring'),
  field('platelet_drop_percent', 'Platelet drop %', 'calculated', 'hit_monitoring', {
    derivedMetricId: 'platelet_drop_percent',
  }),
  field('thrombosis_suspected', 'Thrombosis suspected', 'boolean', 'hit_monitoring'),
  field('four_t_score', '4T score', 'integer', 'hit_monitoring', { validation: { min: 0, max: 8 } }),
  field('anti_pf4', 'Anti-PF4', 'select', 'hit_monitoring', {
    options: [
      { value: 'negative', label: 'Negative' },
      { value: 'positive', label: 'Positive' },
      { value: 'indeterminate', label: 'Indeterminate' },
      { value: 'not_done', label: 'Not done' },
    ],
  }),
  field('serotonin_release_assay', 'Serotonin release assay', 'select', 'hit_monitoring', {
    options: yesNo.map((o) => ({ value: o.value, label: o.label })),
  }),
  field('d_dimer', 'D-dimer', 'decimal', 'hit_monitoring'),
  field('fibrinogen', 'Fibrinogen', 'decimal', 'hit_monitoring'),
]

// ---------------------------------------------------------------------------
// PK Sampling
// ---------------------------------------------------------------------------

export const PK_ROW_FIELDS: FieldDefinition[] = [
  field(
    'pharmacokinetic_substudy_participant',
    'Pharmacokinetic substudy participant',
    'boolean',
    'pk_sampling',
  ),
  field('nominal_timepoint', 'Nominal timepoint', 'text', 'pk_sampling'),
  field('actual_collection_time', 'Actual collection time', 'datetime', 'pk_sampling'),
  field('minutes_from_ip_start', 'Minutes from IP start', 'integer', 'pk_sampling'),
  field('pk_window_status', 'PK window status', 'calculated', 'pk_sampling', {
    derivedMetricId: 'pk_window_status',
  }),
]

// ---------------------------------------------------------------------------
// Informed consent (for date validation rules)
// ---------------------------------------------------------------------------

export const INFORMED_CONSENT_FIELDS: FieldDefinition[] = [
  field('consent_date', 'Informed consent date', 'date', 'informed_consent'),
]

// ---------------------------------------------------------------------------
// Aggregate catalog
// ---------------------------------------------------------------------------

export const CLINICAL_FIELD_CATALOG: FieldDefinition[] = [
  ...VITAL_SIGNS_FIELDS,
  ...DEMOGRAPHICS_FIELDS,
  ...MEDICAL_HISTORY_ROW_FIELDS,
  ...CONMED_ROW_FIELDS,
  ...ADVERSE_EVENT_ROW_FIELDS,
  ...LAB_ROW_FIELDS,
  ...PREGNANCY_FIELDS,
  ...ADRENAL_TESTING_FIELDS,
  ...HIT_MONITORING_FIELDS,
  ...PK_ROW_FIELDS,
  ...INFORMED_CONSENT_FIELDS,
]

const catalogById = new Map(CLINICAL_FIELD_CATALOG.map((f) => [f.id, f]))

export function getCatalogField(id: string): FieldDefinition | undefined {
  return catalogById.get(id)
}

export function getCatalogFieldsByDomain(domain: ClinicalDomain): FieldDefinition[] {
  return CLINICAL_FIELD_CATALOG.filter((f) => f.domain === domain)
}

export function pickCatalogFields(ids: string[]): FieldDefinition[] {
  return ids.map((id) => catalogById.get(id)).filter((f): f is FieldDefinition => Boolean(f))
}
