import type { SupabaseClient } from '@supabase/supabase-js'

export type ConsentDocumentVersionRow = {
  id: string
  organizationId: string
  studyId: string
  consentType: 'main_icf' | 'hipaa_authorization' | 'assent' | 'optional_future_use' | 'genetic_testing' | 'biospecimen_storage' | 'contact_future_research'
  versionNumber: number
  versionLabel: string | null
  irbApprovalDate: string | null
  effectiveDate: string
  expirationDate: string | null
  reconsentRequired: boolean
  requiredByDate: string | null
  amendmentIdentifier: string | null
  status: 'draft' | 'review_needed' | 'irb_approved' | 'active' | 'superseded' | 'retired'
  language: string
  createdAt: string
}

export type SubjectConsentVersionRow = {
  id: string
  organizationId: string
  studyId: string
  studySubjectId: string
  consentType: string
  consentVersionLabel: string
  status: 'pending' | 'completed' | 'active' | 'superseded' | 'withdrawn' | 'expired' | 'invalidated'
  effectiveAt: string | null
  completedAt: string | null
  activeAt: string | null
  consentDocumentVersionId: string | null
  reason: string | null
  createdAt: string
}

export type SubjectReconsentRequirementRow = {
  id: string
  studySubjectId: string
  consentDocumentVersionId: string
  reconsentRequired: boolean
  reconsentStatus: 'not_required' | 'pending' | 'overdue' | 'completed' | 'waived'
  reconsentDueDate: string | null
  reason: string
  detectedAt: string
  completedAt: string | null
}

export function mapConsentDocumentVersionRow(r: Record<string, unknown>): ConsentDocumentVersionRow {
  return {
    id: String(r.id),
    organizationId: String(r.organization_id),
    studyId: String(r.study_id),
    consentType: r.consent_type as ConsentDocumentVersionRow['consentType'],
    versionNumber: Number(r.version_number),
    versionLabel: r.version_label != null ? String(r.version_label) : null,
    irbApprovalDate: r.irb_approval_date != null ? String(r.irb_approval_date) : null,
    effectiveDate: String(r.effective_date),
    expirationDate: r.expiration_date != null ? String(r.expiration_date) : null,
    reconsentRequired: Boolean(r.reconsent_required),
    requiredByDate: r.required_by_date != null ? String(r.required_by_date) : null,
    amendmentIdentifier: r.amendment_identifier != null ? String(r.amendment_identifier) : null,
    status: r.status as ConsentDocumentVersionRow['status'],
    language: String(r.language ?? 'en'),
    createdAt: String(r.created_at),
  }
}

export function mapSubjectConsentVersionRow(r: Record<string, unknown>): SubjectConsentVersionRow {
  return {
    id: String(r.id),
    organizationId: String(r.organization_id),
    studyId: String(r.study_id),
    studySubjectId: String(r.study_subject_id),
    consentType: String(r.consent_type),
    consentVersionLabel: String(r.consent_version_label ?? ''),
    status: r.status as SubjectConsentVersionRow['status'],
    effectiveAt: r.effective_at != null ? String(r.effective_at) : null,
    completedAt: r.completed_at != null ? String(r.completed_at) : null,
    activeAt: r.active_at != null ? String(r.active_at) : null,
    consentDocumentVersionId: r.consent_document_version_id != null ? String(r.consent_document_version_id) : null,
    reason: r.reason != null ? String(r.reason) : null,
    createdAt: String(r.created_at),
  }
}

export function mapSubjectReconsentRequirementRow(r: Record<string, unknown>): SubjectReconsentRequirementRow {
  return {
    id: String(r.id),
    studySubjectId: String(r.study_subject_id),
    consentDocumentVersionId: String(r.consent_document_version_id),
    reconsentRequired: Boolean(r.reconsent_required),
    reconsentStatus: r.reconsent_status as SubjectReconsentRequirementRow['reconsentStatus'],
    reconsentDueDate: r.reconsent_due_date != null ? String(r.reconsent_due_date) : null,
    reason: String(r.reason ?? ''),
    detectedAt: String(r.detected_at),
    completedAt: r.completed_at != null ? String(r.completed_at) : null,
  }
}
