/**
 * Generates fixtures/source-builder/canonical-clinical-library.v1.json
 * Run: node scripts/build-canonical-clinical-library.mjs
 */
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { projectRoot } from './lib/env.mjs'

const YES_NO = [
  { code: 'yes', label: 'Yes' },
  { code: 'no', label: 'No' },
]
const YES_NO_NA = [
  { code: 'yes', label: 'Yes' },
  { code: 'no', label: 'No' },
  { code: 'na', label: 'N/A' },
]
const BODY_POSITION = [
  { code: 'sitting', label: 'Sitting' },
  { code: 'standing', label: 'Standing' },
  { code: 'supine', label: 'Supine' },
  { code: 'semi_fowler', label: 'Semi-Fowler' },
]
const PRE_POST_IP_TIMING = [
  { code: 'pre_ip', label: 'Pre-IP' },
  { code: 'post_ip', label: 'Post-IP' },
  { code: 'not_applicable', label: 'Not applicable' },
]
const AE_SEVERITY = [
  { code: 'mild', label: 'Mild' },
  { code: 'moderate', label: 'Moderate' },
  { code: 'severe', label: 'Severe' },
  { code: 'life_threatening', label: 'Life-threatening' },
]
const AE_OUTCOME = [
  { code: 'recovered', label: 'Recovered' },
  { code: 'recovering', label: 'Recovering' },
  { code: 'not_recovered', label: 'Not recovered' },
  { code: 'sequelae', label: 'Recovered with sequelae' },
  { code: 'fatal', label: 'Fatal' },
  { code: 'unknown', label: 'Unknown' },
]
const AE_CAUSALITY = [
  { code: 'unrelated', label: 'Unrelated' },
  { code: 'unlikely', label: 'Unlikely' },
  { code: 'possible', label: 'Possible' },
  { code: 'probable', label: 'Probable' },
  { code: 'definite', label: 'Definite' },
]
const ROUTE = [
  { code: 'oral', label: 'Oral' },
  { code: 'iv', label: 'IV' },
  { code: 'im', label: 'IM' },
  { code: 'sc', label: 'Subcutaneous' },
  { code: 'topical', label: 'Topical' },
  { code: 'inhalation', label: 'Inhalation' },
  { code: 'other', label: 'Other' },
]
const LAB_SOURCE_TYPE = [
  { code: 'local', label: 'Local' },
  { code: 'central', label: 'Central' },
]
const PROCESSING_STATUS = [
  { code: 'collected', label: 'Collected' },
  { code: 'in_transit', label: 'In transit' },
  { code: 'received', label: 'Received' },
  { code: 'resulted', label: 'Resulted' },
  { code: 'cancelled', label: 'Cancelled' },
]
const ECG_INTERPRETATION = [
  { code: 'normal', label: 'Normal' },
  { code: 'abnormal_ncs', label: 'Abnormal, not clinically significant' },
  { code: 'abnormal_cs', label: 'Abnormal, clinically significant' },
  { code: 'uninterpretable', label: 'Uninterpretable' },
]
const TEMP_UNIT = [
  { code: 'C', label: '°C' },
  { code: 'F', label: '°F' },
]
const TEMP_METHOD = [
  { code: 'oral', label: 'Oral' },
  { code: 'tympanic', label: 'Tympanic' },
  { code: 'axillary', label: 'Axillary' },
  { code: 'temporal', label: 'Temporal' },
]
const WEIGHT_UNIT = [
  { code: 'kg', label: 'kg' },
  { code: 'lb', label: 'lb' },
]
const HEIGHT_UNIT = [
  { code: 'cm', label: 'cm' },
  { code: 'in', label: 'in' },
]
const FASTING_STATUS = [
  { code: 'fasting', label: 'Fasting' },
  { code: 'non_fasting', label: 'Non-fasting' },
  { code: 'unknown', label: 'Unknown' },
]
const SPECIMEN_TYPE = [
  { code: 'blood', label: 'Blood' },
  { code: 'urine', label: 'Urine' },
  { code: 'nasal_swab', label: 'Nasal swab' },
  { code: 'saliva', label: 'Saliva' },
  { code: 'other', label: 'Other' },
]

function f(
  field_key,
  display_label,
  data_type,
  extra = {},
) {
  return {
    field_key,
    display_label,
    data_type,
    required_default: extra.required_default ?? false,
    list_code: extra.list_code ?? null,
    unit: extra.unit ?? null,
    validation: extra.validation ?? [],
    audit_relevance: extra.audit_relevance ?? 'medium',
    protocol_notes: extra.protocol_notes ?? '',
    scope: extra.scope ?? 'core',
  }
}

const csCommentRule = (whenField = 'clinically_significant') => ({
  kind: 'required_when',
  when_field: whenField,
  when_value: 'yes',
  fields: ['clinical_comment'],
  message: 'Clinical comment required when clinically significant is Yes.',
})

const VITALS_CORE_V1 = {
  library_code: 'VITALS_CORE_V1',
  library_kind: 'core',
  clinical_domain: 'vital_signs',
  description: 'Canonical vital signs and body measurements for interventional eSource.',
  fields: [
    f('heart_rate', 'Heart rate', 'integer', { unit: 'bpm', validation: [{ kind: 'min', value: 30, message: 'HR minimum 30' }, { kind: 'max', value: 220, message: 'HR maximum 220' }], audit_relevance: 'high' }),
    f('respiratory_rate', 'Respiratory rate', 'integer', { unit: '/min', validation: [{ kind: 'min', value: 4, message: 'RR minimum 4' }, { kind: 'max', value: 60, message: 'RR maximum 60' }] }),
    f('systolic_bp', 'Systolic blood pressure', 'integer', { unit: 'mmHg', validation: [{ kind: 'min', value: 70, message: 'SBP minimum 70' }, { kind: 'max', value: 250, message: 'SBP maximum 250' }], audit_relevance: 'high' }),
    f('diastolic_bp', 'Diastolic blood pressure', 'integer', { unit: 'mmHg', validation: [{ kind: 'min', value: 40, message: 'DBP minimum 40' }, { kind: 'max', value: 150, message: 'DBP maximum 150' }], audit_relevance: 'high' }),
    f('temperature', 'Temperature', 'number', { validation: [{ kind: 'min', value: 32, message: 'Temperature too low' }, { kind: 'max', value: 45, message: 'Temperature too high' }] }),
    f('temperature_unit', 'Temperature unit', 'select', { list_code: 'TEMP_UNIT' }),
    f('temperature_method', 'Temperature method', 'select', { list_code: 'TEMP_METHOD' }),
    f('weight', 'Weight', 'number', { validation: [{ kind: 'min', value: 1, message: 'Weight required' }] }),
    f('weight_unit', 'Weight unit', 'select', { list_code: 'WEIGHT_UNIT' }),
    f('height', 'Height', 'number', { validation: [{ kind: 'min', value: 1, message: 'Height required' }] }),
    f('height_unit', 'Height unit', 'select', { list_code: 'HEIGHT_UNIT' }),
    f('bmi', 'BMI', 'number', { protocol_notes: 'May be derived from height/weight when both captured.' }),
    f('body_position', 'Body position', 'select', { list_code: 'BODY_POSITION' }),
    f('resting_duration_minutes', 'Resting duration (minutes)', 'integer', { validation: [{ kind: 'min', value: 0, message: 'Non-negative minutes' }, { kind: 'max', value: 60, message: 'Maximum 60 minutes' }] }),
    f('collection_datetime', 'Collection date/time', 'datetime', { required_default: true, audit_relevance: 'high' }),
    f('collection_timepoint', 'Collection timepoint', 'string'),
    f('pre_post_ip_timing', 'Pre/post IP timing', 'select', { list_code: 'PRE_POST_IP_TIMING' }),
    f('abnormal_flag', 'Abnormal flag', 'select', { list_code: 'YES_NO' }),
    f('clinically_significant', 'Clinically significant', 'select', { list_code: 'YES_NO', audit_relevance: 'high' }),
    f('clinical_comment', 'Clinical comment', 'textarea', { validation: [csCommentRule()], audit_relevance: 'high' }),
    f('collected_by', 'Collected by', 'string'),
    f('source_origin', 'Source origin', 'select', { list_code: 'SOURCE_ORIGIN' }),
  ],
}

const AE_CORE_V1 = {
  library_code: 'AE_CORE_V1',
  library_kind: 'core',
  clinical_domain: 'adverse_events',
  description: 'Canonical adverse event capture for interventional trials.',
  fields: [
    f('ae_term', 'AE term', 'string', { required_default: true, audit_relevance: 'high' }),
    f('ae_onset_datetime', 'AE onset date/time', 'datetime', { required_default: true, audit_relevance: 'high' }),
    f('ae_resolution_datetime', 'AE resolution date/time', 'datetime', {
      validation: [{
        kind: 'required_when',
        when_field: 'ae_ongoing',
        when_value: 'no',
        fields: ['ae_resolution_datetime'],
        message: 'Resolution date/time required unless AE is ongoing.',
      }],
    }),
    f('ae_ongoing', 'AE ongoing', 'select', { list_code: 'YES_NO', required_default: true }),
    f('ae_severity', 'AE severity', 'select', { list_code: 'AE_SEVERITY', required_default: true }),
    f('ae_serious', 'Serious AE', 'select', { list_code: 'YES_NO', required_default: true, audit_relevance: 'high' }),
    f('ae_seriousness_category', 'Seriousness category', 'string', {
      validation: [{
        kind: 'required_when',
        when_field: 'ae_serious',
        when_value: 'yes',
        fields: ['ae_seriousness_category'],
        message: 'Seriousness category required when AE is serious.',
      }],
    }),
    f('ae_causality', 'Causality', 'select', { list_code: 'AE_CAUSALITY' }),
    f('ae_expectedness', 'Expectedness', 'select', { list_code: 'YES_NO' }),
    f('ae_related_to_ip', 'Related to IP', 'select', { list_code: 'YES_NO' }),
    f('ae_action_taken', 'Action taken', 'textarea'),
    f('ae_outcome', 'Outcome', 'select', { list_code: 'AE_OUTCOME', required_default: true }),
    f('ae_followup_required', 'Follow-up required', 'select', { list_code: 'YES_NO' }),
    f('requires_medical_monitor_notification', 'Medical monitor notification required', 'select', { list_code: 'YES_NO', audit_relevance: 'high' }),
    f('requires_unblinding', 'Requires unblinding', 'select', { list_code: 'YES_NO', audit_relevance: 'high' }),
    f('unblinding_comment', 'Unblinding reason/comment', 'textarea', {
      validation: [{
        kind: 'required_when',
        when_field: 'requires_unblinding',
        when_value: 'yes',
        fields: ['unblinding_comment'],
        message: 'Unblinding comment required when unblinding is Yes.',
      }],
    }),
    f('expedited_reporting_required', 'Expedited reporting required', 'select', { list_code: 'YES_NO' }),
    f('ae_followup_plan', 'Follow-up plan', 'textarea', {
      validation: [{
        kind: 'required_when',
        when_field: 'ae_followup_required',
        when_value: 'yes',
        fields: ['ae_followup_plan'],
        message: 'Follow-up plan required when follow-up is required.',
      }],
    }),
    f('meddra_soc', 'MedDRA SOC', 'string'),
    f('meddra_hlgt', 'MedDRA HLGT', 'string'),
    f('meddra_hlt', 'MedDRA HLT', 'string'),
    f('meddra_pt', 'MedDRA PT', 'string'),
    f('meddra_code', 'MedDRA code', 'string'),
    f('reported_by', 'Reported by', 'string'),
    f('investigator_awareness_datetime', 'Investigator awareness date/time', 'datetime', { audit_relevance: 'high' }),
  ],
}

const CONMED_CORE_V1 = {
  library_code: 'CONMED_CORE_V1',
  library_kind: 'core',
  clinical_domain: 'concomitant_medications',
  description: 'Canonical concomitant medication row fields.',
  fields: [
    f('medication_name', 'Medication name', 'string', { required_default: true }),
    f('generic_name', 'Generic name', 'string'),
    f('indication', 'Indication', 'string'),
    f('dose', 'Dose', 'number'),
    f('dose_unit', 'Dose unit', 'string'),
    f('route', 'Route', 'select', { list_code: 'ROUTE' }),
    f('frequency', 'Frequency', 'string'),
    f('start_date', 'Start date', 'date', { required_default: true }),
    f('end_date', 'End date', 'date', {
      validation: [{
        kind: 'required_when',
        when_field: 'ongoing',
        when_value: 'no',
        fields: ['end_date'],
        message: 'End date required unless medication is ongoing.',
      }],
    }),
    f('ongoing', 'Ongoing', 'select', { list_code: 'YES_NO', required_default: true }),
    f('prohibited_therapy', 'Prohibited therapy', 'select', { list_code: 'YES_NO', audit_relevance: 'high' }),
    f('medical_monitor_comment', 'Medical monitor comment', 'textarea', {
      validation: [{
        kind: 'required_when',
        when_field: 'prohibited_therapy',
        when_value: 'yes',
        fields: ['medical_monitor_comment'],
        message: 'Medical monitor comment required for prohibited therapy.',
      }],
    }),
    f('requires_medical_monitor_review', 'Requires medical monitor review', 'select', { list_code: 'YES_NO' }),
    f('related_to_ae', 'Related to AE', 'select', { list_code: 'YES_NO' }),
    f('linked_ae_id', 'Linked AE ID', 'string', {
      validation: [{
        kind: 'required_when',
        when_field: 'related_to_ae',
        when_value: 'yes',
        fields: ['linked_ae_id'],
        message: 'Linked AE required when related to AE is Yes.',
      }],
    }),
    f('prescribed_by', 'Prescribed by', 'string'),
    f('verified_with_subject', 'Verified with subject', 'select', { list_code: 'YES_NO' }),
  ],
}

const IP_ADMIN_CORE_V1 = {
  library_code: 'IP_ADMIN_CORE_V1',
  library_kind: 'core',
  clinical_domain: 'investigational_product',
  description: 'eSource IP administration documentation (not inventory/accountability).',
  fields: [
    f('ip_dispensed', 'IP dispensed', 'select', { list_code: 'YES_NO' }),
    f('ip_administered', 'IP administered', 'select', { list_code: 'YES_NO', required_default: true, audit_relevance: 'high' }),
    f('ip_returned', 'IP returned', 'select', { list_code: 'YES_NO' }),
    f('ip_missed', 'IP missed', 'select', { list_code: 'YES_NO' }),
    f('missed_reason', 'Missed reason/comment', 'textarea', {
      validation: [{
        kind: 'required_when',
        when_field: 'ip_missed',
        when_value: 'yes',
        fields: ['missed_reason'],
        message: 'Missed reason required when IP missed is Yes.',
      }],
    }),
    f('kit_number', 'Kit number', 'string', {
      validation: [{
        kind: 'required_when',
        when_field: 'ip_administered',
        when_value: 'yes',
        fields: ['kit_number', 'ip_number'],
        message: 'Kit number or IP number required when IP administered.',
      }],
    }),
    f('ip_number', 'IP number', 'string'),
    f('batch_lot_number', 'Batch/lot number', 'string'),
    f('expiration_date', 'Expiration date', 'date'),
    f('route', 'Route', 'select', { list_code: 'ROUTE' }),
    f('dose', 'Dose', 'number'),
    f('dose_unit', 'Dose unit', 'string'),
    f('administration_datetime', 'Administration date/time', 'datetime', { audit_relevance: 'high' }),
    f('anatomical_site', 'Anatomical site', 'string'),
    f('subject_identity_confirmed', 'Subject identity confirmed', 'select', { list_code: 'YES_NO', audit_relevance: 'high' }),
    f('second_verifier_required', 'Second verifier required', 'select', { list_code: 'YES_NO' }),
    f('second_verifier_name', 'Second verifier name', 'string', {
      validation: [{
        kind: 'required_when',
        when_field: 'second_verifier_required',
        when_value: 'yes',
        fields: ['second_verifier_name'],
        message: 'Second verifier name required when dual verification required.',
      }],
    }),
    f('pre_ip_checks_completed', 'Pre-IP checks completed', 'select', { list_code: 'YES_NO' }),
    f('post_ip_checks_completed', 'Post-IP checks completed', 'select', { list_code: 'YES_NO' }),
    f('pre_ip_vitals_completed', 'Pre-IP vitals completed', 'select', { list_code: 'YES_NO' }),
    f('administered_by', 'Administered by', 'string', {
      validation: [{
        kind: 'required_when',
        when_field: 'ip_administered',
        when_value: 'yes',
        fields: ['administered_by'],
        message: 'Administered by required when IP administered is Yes.',
      }],
    }),
    f('witnessed_by', 'Witnessed by', 'string'),
    f('administration_comment', 'Administration comment', 'textarea'),
    f('infusion_reaction', 'Infusion reaction', 'select', { list_code: 'YES_NO' }),
    f('immediate_ae_observed', 'Immediate AE observed', 'select', { list_code: 'YES_NO' }),
    f('immediate_ae_comment', 'Immediate AE comment', 'textarea', {
      validation: [{
        kind: 'required_when',
        when_field: 'immediate_ae_observed',
        when_value: 'yes',
        fields: ['immediate_ae_comment'],
        message: 'Comment required when immediate AE observed is Yes.',
      }],
    }),
  ],
}

const LAB_CORE_V1 = {
  library_code: 'LAB_CORE_V1',
  library_kind: 'core',
  clinical_domain: 'labs',
  description: 'Canonical lab collection and result metadata (not full analyte panel).',
  fields: [
    f('collection_datetime', 'Collection date/time', 'datetime', { required_default: true, audit_relevance: 'high' }),
    f('fasting_status', 'Fasting status', 'select', { list_code: 'FASTING_STATUS' }),
    f('fasting_hours', 'Fasting hours', 'integer', {
      validation: [{
        kind: 'required_when',
        when_field: 'fasting_status',
        when_value: 'fasting',
        fields: ['fasting_hours'],
        message: 'Fasting hours required when fasting status is fasting.',
      }],
    }),
    f('specimen_type', 'Specimen type', 'select', { list_code: 'SPECIMEN_TYPE', required_default: true }),
    f('accession_number', 'Accession number', 'string'),
    f('local_vs_central', 'Local vs central', 'select', { list_code: 'LAB_SOURCE_TYPE' }),
    f('processing_status', 'Processing status', 'select', { list_code: 'PROCESSING_STATUS' }),
    f('abnormal_flag', 'Abnormal flag', 'select', { list_code: 'YES_NO' }),
    f('clinically_significant', 'Clinically significant', 'select', { list_code: 'YES_NO', audit_relevance: 'high' }),
    f('clinical_comment', 'Clinical comment', 'textarea', { validation: [csCommentRule()] }),
    f('repeat_required', 'Repeat required', 'select', { list_code: 'YES_NO' }),
    f('repeat_reason', 'Repeat reason', 'textarea', {
      validation: [{
        kind: 'required_when',
        when_field: 'repeat_required',
        when_value: 'yes',
        fields: ['repeat_reason', 'repeat_scheduled_date'],
        message: 'Repeat reason and scheduled date required when repeat is required.',
      }],
    }),
    f('repeat_scheduled_date', 'Repeat scheduled date', 'date'),
    f('linked_ae', 'Linked to AE', 'select', { list_code: 'YES_NO' }),
    f('linked_ae_id', 'Linked AE ID', 'string', {
      validation: [{
        kind: 'required_when',
        when_field: 'linked_ae',
        when_value: 'yes',
        fields: ['linked_ae_id'],
        message: 'Linked AE ID required when linked to AE is Yes.',
      }],
    }),
    f('collected_by', 'Collected by', 'string'),
    f('shipped_datetime', 'Shipped date/time', 'datetime'),
    f('received_by_lab', 'Received by lab', 'select', { list_code: 'YES_NO' }),
  ],
}

const ECG_CORE_V1 = {
  library_code: 'ECG_CORE_V1',
  library_kind: 'core',
  clinical_domain: 'ecg',
  description: 'Canonical ECG procedure documentation.',
  fields: [
    f('ecg_performed', 'ECG performed', 'select', { list_code: 'YES_NO', required_default: true }),
    f('ecg_datetime', 'ECG date/time', 'datetime', {
      validation: [{
        kind: 'required_when',
        when_field: 'ecg_performed',
        when_value: 'yes',
        fields: ['ecg_datetime', 'ecg_interpretation'],
        message: 'ECG date/time and interpretation required when ECG performed.',
      }],
    }),
    f('heart_rate', 'Heart rate', 'integer', { unit: 'bpm' }),
    f('pr_interval', 'PR interval', 'integer', { unit: 'ms' }),
    f('qrs_interval', 'QRS interval', 'integer', { unit: 'ms' }),
    f('qt_interval', 'QT interval', 'integer', { unit: 'ms' }),
    f('qtc_interval', 'QTc interval', 'integer', { unit: 'ms' }),
    f('ecg_interpretation', 'ECG interpretation', 'select', { list_code: 'ECG_INTERPRETATION' }),
    f('clinically_significant', 'Clinically significant', 'select', { list_code: 'YES_NO' }),
    f('interpretation_comment', 'Interpretation comment', 'textarea', { validation: [csCommentRule('clinically_significant')] }),
    f('attached_ecg_file', 'Attached ECG file', 'file'),
    f('machine_id', 'Machine ID', 'string'),
    f('interpreted_by', 'Interpreted by', 'string'),
    f('reviewed_by_investigator', 'Reviewed by investigator', 'string', { audit_relevance: 'high' }),
  ],
}

const PHYSICAL_EXAM_CORE_V1 = {
  library_code: 'PHYSICAL_EXAM_CORE_V1',
  library_kind: 'core',
  clinical_domain: 'physical_exam',
  description: 'Canonical targeted physical examination documentation.',
  fields: [
    f('exam_performed', 'Physical exam performed', 'select', { list_code: 'YES_NO', required_default: true }),
    f('exam_datetime', 'Exam date/time', 'datetime', {
      validation: [{
        kind: 'required_when',
        when_field: 'exam_performed',
        when_value: 'yes',
        fields: ['exam_datetime'],
        message: 'Exam date/time required when exam performed is Yes.',
      }],
    }),
    f('overall_normal', 'Overall normal', 'select', { list_code: 'YES_NO' }),
    f('cardiovascular_review', 'Cardiovascular review', 'textarea'),
    f('respiratory_review', 'Respiratory review', 'textarea'),
    f('gi_review', 'GI review', 'textarea'),
    f('neuro_review', 'Neurologic review', 'textarea'),
    f('musculoskeletal_review', 'Musculoskeletal review', 'textarea'),
    f('skin_review', 'Skin review', 'textarea'),
    f('targeted_exam_reason', 'Targeted exam reason', 'textarea'),
    f('abnormal_findings', 'Abnormal findings', 'textarea', {
      validation: [{
        kind: 'required_when',
        when_field: 'overall_normal',
        when_value: 'no',
        fields: ['abnormal_findings'],
        message: 'Abnormal findings required when overall normal is No.',
      }],
    }),
    f('clinically_significant', 'Clinically significant', 'select', { list_code: 'YES_NO' }),
    f('investigator_comment', 'Investigator comment', 'textarea', {
      validation: [{
        kind: 'required_when',
        when_field: 'clinically_significant',
        when_value: 'yes',
        fields: ['investigator_comment'],
        message: 'Investigator comment required when clinically significant is Yes.',
      }],
    }),
  ],
}

const PARA_ADRENAL_OVERLAY_V1 = {
  library_code: 'PARA_ADRENAL_OVERLAY_V1',
  library_kind: 'overlay',
  clinical_domain: 'adrenal_testing',
  description: 'PARA adrenal insufficiency symptom overlay (namespaced fields).',
  fields: [
    f('adrenal_fatigue', 'Adrenal fatigue', 'select', { list_code: 'YES_NO', scope: 'overlay' }),
    f('adrenal_weakness', 'Adrenal weakness', 'select', { list_code: 'YES_NO', scope: 'overlay' }),
    f('adrenal_low_bp', 'Adrenal low blood pressure', 'select', { list_code: 'YES_NO', scope: 'overlay' }),
    f('adrenal_low_blood_sugar', 'Adrenal low blood sugar', 'select', { list_code: 'YES_NO', scope: 'overlay' }),
    f('adrenal_irritability', 'Adrenal irritability', 'select', { list_code: 'YES_NO', scope: 'overlay' }),
    f('adrenal_depression', 'Adrenal depression', 'select', { list_code: 'YES_NO', scope: 'overlay' }),
    f('adrenal_weight_loss', 'Adrenal weight loss', 'select', { list_code: 'YES_NO', scope: 'overlay' }),
    f('adrenal_lightheadedness', 'Adrenal lightheadedness', 'select', { list_code: 'YES_NO', scope: 'overlay' }),
    f('adrenal_skin_darkening', 'Adrenal skin darkening', 'select', { list_code: 'YES_NO', scope: 'overlay' }),
    f('adrenal_abdominal_discomfort', 'Adrenal abdominal discomfort', 'select', { list_code: 'YES_NO', scope: 'overlay' }),
    f('adrenal_nausea', 'Adrenal nausea', 'select', { list_code: 'YES_NO', scope: 'overlay' }),
    f('adrenal_vomiting', 'Adrenal vomiting', 'select', { list_code: 'YES_NO', scope: 'overlay' }),
    f('adrenal_chronic_diarrhea', 'Adrenal chronic diarrhea', 'select', { list_code: 'YES_NO', scope: 'overlay' }),
    f('adrenal_loss_of_appetite', 'Adrenal loss of appetite', 'select', { list_code: 'YES_NO', scope: 'overlay' }),
    f('adrenal_salt_craving', 'Adrenal salt craving', 'select', { list_code: 'YES_NO', scope: 'overlay' }),
    f('adrenal_symptoms_present', 'Adrenal symptoms present', 'select', { list_code: 'YES_NO', scope: 'overlay', audit_relevance: 'high' }),
    f('adrenal_action_required', 'Adrenal action required', 'select', { list_code: 'YES_NO', scope: 'overlay', audit_relevance: 'high' }),
  ],
}

const PARA_HIT_OVERLAY_V1 = {
  library_code: 'PARA_HIT_OVERLAY_V1',
  library_kind: 'overlay',
  clinical_domain: 'hit_monitoring',
  description: 'PARA HIT / anti-PF4 monitoring overlay (namespaced fields).',
  fields: [
    f('hit_platelet_count', 'Platelet count', 'integer', { unit: '/µL', scope: 'overlay' }),
    f('hit_platelet_drop_percent', 'Platelet drop percent', 'number', { scope: 'overlay' }),
    f('hit_thrombosis_suspected', 'Thrombosis suspected', 'select', { list_code: 'YES_NO', scope: 'overlay' }),
    f('hit_thrombosis_confirmed', 'Thrombosis confirmed', 'select', { list_code: 'YES_NO', scope: 'overlay' }),
    f('hit_four_t_score_required', '4T score required', 'select', { list_code: 'YES_NO', scope: 'overlay' }),
    f('hit_four_t_score', '4T score', 'integer', { scope: 'overlay', validation: [{ kind: 'min', value: 0, message: 'Min 0' }, { kind: 'max', value: 8, message: 'Max 8' }] }),
    f('hit_anti_pf4_required', 'Anti-PF4 required', 'select', { list_code: 'YES_NO', scope: 'overlay' }),
    f('hit_anti_pf4_result', 'Anti-PF4 result', 'select', { list_code: 'YES_NO', scope: 'overlay' }),
    f('hit_serotonin_release_assay_required', 'Serotonin release assay required', 'select', { list_code: 'YES_NO', scope: 'overlay' }),
    f('hit_d_dimer_required', 'D-dimer required', 'select', { list_code: 'YES_NO', scope: 'overlay' }),
    f('hit_fibrinogen_required', 'Fibrinogen required', 'select', { list_code: 'YES_NO', scope: 'overlay' }),
    f('hit_ip_hold_required', 'IP hold required', 'select', { list_code: 'YES_NO', scope: 'overlay', audit_relevance: 'high' }),
    f('hit_medical_monitor_contact_required', 'Medical monitor contact required', 'select', { list_code: 'YES_NO', scope: 'overlay', audit_relevance: 'high' }),
  ],
}

const MV_HOUSEHOLD_SYMPTOM_OVERLAY_V1 = {
  library_code: 'MV_HOUSEHOLD_SYMPTOM_OVERLAY_V1',
  library_kind: 'overlay',
  clinical_domain: 'respiratory_samples',
  description: 'STUDY-INF-001 household symptom and swab overlay (namespaced fields).',
  fields: [
    f('mv_cough', 'Cough', 'select', { list_code: 'YES_NO', scope: 'overlay' }),
    f('mv_sore_throat', 'Sore throat', 'select', { list_code: 'YES_NO', scope: 'overlay' }),
    f('mv_nasal_congestion', 'Nasal congestion', 'select', { list_code: 'YES_NO', scope: 'overlay' }),
    f('mv_headache', 'Headache', 'select', { list_code: 'YES_NO', scope: 'overlay' }),
    f('mv_feverishness_or_chills', 'Feverishness or chills', 'select', { list_code: 'YES_NO', scope: 'overlay' }),
    f('mv_muscle_or_joint_pain', 'Muscle or joint pain', 'select', { list_code: 'YES_NO', scope: 'overlay' }),
    f('mv_fatigue', 'Fatigue', 'select', { list_code: 'YES_NO', scope: 'overlay' }),
    f('mv_rhinorrhea', 'Rhinorrhea', 'select', { list_code: 'YES_NO', scope: 'overlay' }),
    f('mv_temperature', 'Temperature', 'number', { scope: 'overlay' }),
    f('mv_symptoms_worse_than_baseline', 'Symptoms worse than baseline', 'select', { list_code: 'YES_NO', scope: 'overlay' }),
    f('mv_local_influenza_test_result', 'Local influenza test result', 'select', { list_code: 'YES_NO_NA', scope: 'overlay' }),
    f('mv_local_sars_cov_2_result', 'Local SARS-CoV-2 result', 'select', { list_code: 'YES_NO_NA', scope: 'overlay' }),
    f('mv_sick_visit_required', 'Sick visit required', 'select', { list_code: 'YES_NO', scope: 'overlay', audit_relevance: 'high' }),
    f('mv_swab_required', 'Swab required', 'select', { list_code: 'YES_NO', scope: 'overlay', audit_relevance: 'high' }),
  ],
}

const doc = {
  library_version: '12A.1.0',
  library_id: 'canonical-clinical-library',
  description:
    'Phase 12A canonical clinical field libraries for protocol-grade source document generation. Core blocks are reusable; overlays are protocol-specific extensions.',
  controlled_lists: {
    YES_NO,
    YES_NO_NA,
    BODY_POSITION,
    PRE_POST_IP_TIMING,
    AE_SEVERITY,
    AE_OUTCOME,
    AE_CAUSALITY,
    ROUTE,
    LAB_SOURCE_TYPE,
    PROCESSING_STATUS,
    ECG_INTERPRETATION,
    TEMP_UNIT,
    TEMP_METHOD,
    WEIGHT_UNIT,
    HEIGHT_UNIT,
    FASTING_STATUS,
    SPECIMEN_TYPE,
    SOURCE_ORIGIN: [
      { code: 'vilo_esource', label: 'Vilo eSource' },
      { code: 'external_edc', label: 'External EDC' },
      { code: 'central_lab', label: 'Central lab' },
      { code: 'local_lab', label: 'Local lab' },
      { code: 'site_file', label: 'Site file' },
    ],
  },
  libraries: {
    VITALS_CORE_V1,
    AE_CORE_V1,
    CONMED_CORE_V1,
    IP_ADMIN_CORE_V1,
    LAB_CORE_V1,
    ECG_CORE_V1,
    PHYSICAL_EXAM_CORE_V1,
  },
  overlays: {
    PARA_ADRENAL_OVERLAY_V1,
    PARA_HIT_OVERLAY_V1,
    MV_HOUSEHOLD_SYMPTOM_OVERLAY_V1,
  },
}

const outPath = join(projectRoot, 'fixtures/source-builder/canonical-clinical-library.v1.json')
writeFileSync(outPath, JSON.stringify(doc, null, 2) + '\n', 'utf8')
console.log(`Wrote ${outPath}`)
