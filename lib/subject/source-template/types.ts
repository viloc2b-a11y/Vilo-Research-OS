export const SUBJECT_DOCUMENT_CATEGORIES = [
  'Lab Report',
  'External Medical Record',
  'Hospital Record',
  'Imaging Report',
  'ECG',
  'Questionnaire',
  'Consent Related',
  'Referral / Consult',
  'Miscellaneous',
] as const

export type SubjectDocumentCategory = (typeof SUBJECT_DOCUMENT_CATEGORIES)[number]

export type SubjectUserOption = {
  id: string
  label: string
  role: string | null
}

export type SubjectVisitOption = {
  id: string
  label: string
}

export type SubjectProgressNote = {
  note_id: string
  note_date: string
  note_type: string | null
  category: string
  chief_complaint: string | null
  note: string
  assessment: string | null
  plan: string | null
  follow_up_needed: boolean
  follow_up_date: string | null
  follow_up_owner: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export type SubjectStatusHistory = {
  status_id: string
  status: string
  start_date: string
  stop_date: string | null
  ongoing: boolean
  reason: string | null
  notes: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export type SubjectDocument = {
  document_id: string
  visit_id: string | null
  compliance_document_id: string | null
  document_category: string
  file_name: string
  file_path: string | null
  mime_type: string | null
  file_size: number | null
  status: string
  notes: string | null
  uploaded_by: string | null
  created_at: string
  updated_at: string
  previewUrl: string | null
  downloadUrl: string | null
}

export type SubjectDocumentReviewRequest = {
  request_id: string
  document_id: string
  request_type: 'Review' | 'Signature'
  requested_by: string | null
  requested_to: string | null
  message: string | null
  due_date: string | null
  status: string
  completed_by: string | null
  completed_at: string | null
  rejection_reason: string | null
  rejected_by: string | null
  rejected_at: string | null
  rescind_reason: string | null
  rescinded_by: string | null
  rescinded_at: string | null
  created_at: string
}

export type SubjectSignature = {
  signature_id: string
  request_id: string
  signature_type: string
  requested_by: string | null
  requested_to: string | null
  related_section: string
  related_document_id: string | null
  related_record_id: string | null
  status: string
  signed_by: string | null
  signed_at: string | null
  attestation_text: string
  due_date: string | null
  completed_at: string | null
  created_at: string
}

export type SubjectProtocolDeviation = {
  deviation_id: string
  description: string
  deviation_date: string
  start_date: string | null
  stop_date: string | null
  resolution_date: string | null
  ongoing: boolean
  category: string | null
  severity: string | null
  root_cause: string | null
  root_cause_category: string | null
  capa: string | null
  corrective_action: string | null
  preventive_action: string | null
  capa_due_date: string | null
  capa_completion_date: string | null
  capa_effectiveness_check_date: string | null
  status: string
  closed_at: string | null
  closed_by: string | null
  closure_date: string | null
  closure_note: string | null
  created_at: string
}

export type SubjectDeviationHistoryEvent = {
  event_id: string
  record_id: string
  event_type: string
  actor_id: string | null
  occurred_at: string
  change_reason: string | null
}

export type SubjectEmergencyContact = {
  contact_id: string
  name: string
  relationship: string | null
  phone: string | null
  email: string | null
  address: string | null
  primary_contact: boolean
  preferred_method: string | null
  availability: string | null
  language: string | null
  privacy_consent: boolean
  notes: string | null
  archived_at: string | null
  created_at: string
}

export type SubjectSourceTemplateModel = {
  statusHistory: SubjectStatusHistory[]
  notes: SubjectProgressNote[]
  documents: SubjectDocument[]
  reviewRequests: SubjectDocumentReviewRequest[]
  signatures: SubjectSignature[]
  deviations: SubjectProtocolDeviation[]
  deviationHistory: SubjectDeviationHistoryEvent[]
  emergencyContacts: SubjectEmergencyContact[]
  visitOptions: SubjectVisitOption[]
  userOptions: SubjectUserOption[]
}
