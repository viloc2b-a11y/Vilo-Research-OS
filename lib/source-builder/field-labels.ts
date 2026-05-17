/** Human-readable labels for operational field keys. */
export const FIELD_LABELS: Record<string, string> = {
  performed_datetime: 'Performed date/time',
  collection_datetime: 'Collection date/time',
  administration_datetime: 'Administration date/time',
  contact_datetime: 'Contact date/time',
  reviewed_datetime: 'Reviewed date/time',
  completion_datetime: 'Completion date/time',
  performed_date: 'Performed date',
  consent_version: 'Consent version',
  document_version: 'Document version',
  consent_obtained: 'Consent obtained',
  action_completed: 'Action completed',
  copy_provided: 'Copy provided',
  criteria_met: 'Criteria met',
  deviations_noted: 'Deviations noted',
  training_datetime: 'Training date/time',
  training_completed: 'Training completed',
  completed: 'Completed',
  systolic_bp: 'Systolic BP (mmHg)',
  diastolic_bp: 'Diastolic BP (mmHg)',
  heart_rate: 'Heart rate',
  temperature: 'Temperature',
  clinically_significant: 'Clinically significant',
  measurement_value: 'Measurement value',
  unit: 'Unit',
  result_summary: 'Result summary',
  abnormal_flag: 'Abnormal flag',
  action_taken: 'Action taken',
  repeat_required: 'Repeat required',
  report_reference: 'Report reference',
  sample_collected: 'Sample collected',
  within_window: 'Within window',
  processing_datetime: 'Processing date/time',
  relative_to_dose_time: 'Relative to dose',
  route: 'Route',
  dose: 'Dose',
  administration_completed: 'Administration completed',
  post_dose_observation_completed: 'Post-dose observation completed',
  issues: 'Issues',
  ae_present: 'AE present',
  event_present: 'Event present',
  log_updated: 'Log updated',
  changes_since_last_visit: 'Changes since last visit',
  conmed_log_updated: 'ConMed log updated',
  contact_method: 'Contact method',
  subject_reached: 'Subject reached',
  followup_required: 'Follow-up required',
  ae_review_completed: 'AE review completed',
  conmed_review_completed: 'ConMed review completed',
  comments: 'Comments',
  review_completed: 'Review completed',
  findings_summary: 'Findings summary',
  missing_items: 'Missing items',
  normal_abnormal: 'Normal / abnormal',
  reviewed: 'Reviewed',
  counseling_completed: 'Counseling completed',
  topic: 'Topic',
  patient_understanding_confirmed: 'Patient understanding confirmed',
  shipment_required: 'Shipment required',
  consent_datetime: 'Consent date/time',
}

export function labelForFieldKey(key: string): string {
  return (
    FIELD_LABELS[key] ??
    key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
  )
}

export function inferDataType(key: string): import('./types').DraftFieldDataType {
  if (key.endsWith('_datetime')) return 'datetime'
  if (key.endsWith('_date')) return 'date'
  if (
    key.includes('flag') ||
    key.includes('completed') ||
    key.includes('provided') ||
    key.includes('met') ||
    key.includes('noted') ||
    key.includes('present') ||
    key.includes('updated') ||
    key.includes('reached') ||
    key.includes('required') ||
    key.includes('significant') ||
    key.includes('collected') ||
    key.includes('randomized') ||
    key.includes('obtained') ||
    key === 'reviewed' ||
    key === 'completed'
  ) {
    return 'boolean'
  }
  if (
    key.includes('bp') ||
    key.includes('rate') ||
    key.includes('value') ||
    key === 'dose' ||
    key === 'temperature'
  ) {
    return 'number'
  }
  return 'string'
}
