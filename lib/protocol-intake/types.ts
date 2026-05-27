/**
 * Phase 12C — Protocol Intake draft schemas (reviewable only; never auto-publish).
 */

export type ConfidenceLevel = 'high' | 'medium' | 'low'

export type EvidenceRef = {
  file_name: string
  page_or_sheet: string
  section_reference?: string
  source_snippet: string
}

export type ExtractedField<T> = {
  value: T
  confidence: ConfidenceLevel
  requires_human_review: boolean
  /** Coordinator-facing alias for requires_human_review. */
  reviewer_required: boolean
  evidence: EvidenceRef[]
}

export type ProtocolIntakeDocument = {
  document_id: string
  file_name: string
  mime_type: string
  /** Normalized adapter kind used for parsing. */
  adapter_kind: 'pdf_text' | 'docx_text' | 'spreadsheet' | 'plain_text'
  uploaded_at?: string
}

export type ExtractedStudyMetadata = {
  protocol_number: ExtractedField<string | null>
  protocol_title: ExtractedField<string | null>
  brief_title: ExtractedField<string | null>
  sponsor: ExtractedField<string | null>
  cro: ExtractedField<string | null>
  phase: ExtractedField<string | null>
  indication: ExtractedField<string | null>
  investigational_product: ExtractedField<string | null>
  study_design: ExtractedField<string | null>
  blinded_status: ExtractedField<string | null>
  enrollment_target: ExtractedField<number | null>
  study_duration: ExtractedField<string | null>
  source_document_evidence_refs: EvidenceRef[]
}

export type EligibilityCategory = 'inclusion' | 'exclusion' | 'other'

export type ExtractedEligibilityCriterion = {
  criterion_text: string
  category: EligibilityCategory
  source_page_or_section: string
  confidence: ConfidenceLevel
  requires_human_review: boolean
  reviewer_required?: boolean
  evidence: EvidenceRef[]
}

export type ExtractedVisitProcedure = {
  procedure_code: ExtractedField<string>
  procedure_name: ExtractedField<string>
  required: ExtractedField<boolean>
  conditional: ExtractedField<boolean>
  condition_text: ExtractedField<string | null>
}

export type ExtractedVisit = {
  visit_code: ExtractedField<string>
  visit_name: ExtractedField<string>
  study_day: ExtractedField<number | null>
  window: ExtractedField<string | null>
  modality: ExtractedField<string | null>
  eligible_arms: ExtractedField<string[] | null>
  eligible_subject_roles: ExtractedField<string[] | null>
  procedures: ExtractedVisitProcedure[]
  confidence: ConfidenceLevel
  requires_human_review: boolean
  reviewer_required?: boolean
  evidence: EvidenceRef[]
}

export type ExtractedProcedure = {
  procedure_code: ExtractedField<string>
  procedure_name: ExtractedField<string>
  procedure_category: ExtractedField<string>
  required: ExtractedField<boolean>
  conditional: ExtractedField<boolean>
  condition_text: ExtractedField<string | null>
  timing_notes: ExtractedField<string | null>
  source_evidence: EvidenceRef[]
  confidence: ConfidenceLevel
  requires_human_review: boolean
  reviewer_required?: boolean
}

export type SourceCompositionRecommendation = {
  procedure_code: string
  recommended_library_blocks: string[]
  recommended_overlays: string[]
  include_fields: string[]
  optional_fields: string[]
  excluded_fields: string[]
  omission_reasons: Array<{ field_key: string; reason: string }>
  evidence_refs: EvidenceRef[]
  confidence: ConfidenceLevel
  requires_human_review: boolean
  reviewer_required?: boolean
}

export type VpiDraftInputs = {
  visit_burden_score_inputs: ExtractedField<Record<string, unknown>>
  safety_complexity_inputs: ExtractedField<Record<string, unknown>>
  conditional_workflow_inputs: ExtractedField<Record<string, unknown>>
  recruitment_complexity_inputs: ExtractedField<Record<string, unknown>>
  staff_burden_inputs: ExtractedField<Record<string, unknown>>
  evidence_refs: EvidenceRef[]
}

export type CliniqDraftInputs = {
  billable_procedures: ExtractedField<Array<{ procedure_code: string; procedure_name: string }>>
  conditional_billables: ExtractedField<Array<{ procedure_code: string; condition_text: string | null }>>
  pass_through_candidates: ExtractedField<string[]>
  high_cost_assessments: ExtractedField<string[]>
  visit_frequency_inputs: ExtractedField<Record<string, unknown>>
  evidence_refs: EvidenceRef[]
}

export type IntakeConflict = {
  conflict_id: string
  field: string
  values: string[]
  message: string
  evidence: EvidenceRef[]
  requires_human_review: boolean
}

export type ProtocolIntakeReviewSummary = {
  found: string[]
  needs_review: string[]
  missing: string[]
  conflicts: string[]
  recommended_source_sections: string[]
}

export type ProtocolIntakeDraft = {
  draft_version: '12C.2.0'
  protocol_id: string
  intake_status: 'draft' | 'needs_review'
  created_at: string
  source_documents: ProtocolIntakeDocument[]
  study_metadata: ExtractedStudyMetadata
  eligibility: {
    inclusion_criteria: ExtractedEligibilityCriterion[]
    exclusion_criteria: ExtractedEligibilityCriterion[]
  }
  schedule: {
    visits: ExtractedVisit[]
  }
  procedures: ExtractedProcedure[]
  source_composition: SourceCompositionRecommendation[]
  vpi: VpiDraftInputs
  cliniq: CliniqDraftInputs
  review: ProtocolIntakeReviewSummary
  intake_conflicts: IntakeConflict[]
}

export type ScheduleMatrixIntersection = {
  study_id: string
  protocol_document_id: string
  extraction_run_id: string
  visit_name: string
  visit_number: number | null
  study_day: number | null
  visit_window: string | null
  visit_phase: 'screening' | 'treatment' | 'follow-up' | 'eos' | 'other'
  procedure_name: string
  procedure_category: string
  required_status: boolean
  conditionality: boolean
  source_note: string | null
  protocol_reference: string
  confidence_score: ConfidenceLevel
  needs_review: boolean
  suggested_downstream_consumer: string | null
}

export type RawExtractionOutput = {
  tables?: { table_html: string; table_markdown: string }[]
  error?: string
}

export type DocumentExtractionRun = {
  run_id: string
  study_id: string
  document_name: string
  raw_extraction_output: RawExtractionOutput
  schedule_matrix: ScheduleMatrixIntersection[]
  coordinator_selected_procedures: string[]
}
