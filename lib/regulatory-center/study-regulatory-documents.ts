import type { SupabaseClient } from '@supabase/supabase-js'

// ── Types ────────────────────────────────────────────────────────────────────

export const STUDY_REG_DOC_TYPES = [
  '1572', 'Delegation Log', 'IRB Approval', 'IRB Submission',
  'Protocol Training', 'ICF Approval', 'Recruitment Material Approval',
  'SIV Documentation', 'Amendment Acknowledgment', 'Protocol Signature Page',
  'Site Activation Letter', 'Other',
] as const

export type StudyRegDocType = (typeof STUDY_REG_DOC_TYPES)[number]

export const STUDY_REG_DOC_STATUSES = [
  'missing', 'requested', 'received', 'under_review',
  'submitted', 'approved', 'rejected', 'expired', 'not_applicable',
] as const

export type StudyRegDocStatus = (typeof STUDY_REG_DOC_STATUSES)[number]

export type StudyRegulatoryDocumentEntry = {
  id: string
  organization_id: string
  study_id: string
  document_type: string
  document_title: string
  document_reference: string | null
  version: string | null
  effective_date: string | null
  expiration_date: string | null
  status: string
  owner_role: string | null
  required: boolean
  notes: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export type CreateStudyRegDocInput = {
  studyId: string
  documentType: StudyRegDocType
  documentTitle: string
  documentReference?: string | null
  version?: string | null
  effectiveDate?: string | null
  expirationDate?: string | null
  status?: StudyRegDocStatus
  ownerRole?: string | null
  required?: boolean
  notes?: string | null
}

export type UpdateStudyRegDocInput = {
  id: string
  documentType?: string
  documentTitle?: string
  documentReference?: string | null
  version?: string | null
  effectiveDate?: string | null
  expirationDate?: string | null
  status?: StudyRegDocStatus
  ownerRole?: string | null
  required?: boolean
  notes?: string | null
}

// ── Loader ───────────────────────────────────────────────────────────────────

export async function loadStudyRegulatoryDocuments(
  supabase: SupabaseClient,
  studyId: string,
  options?: { documentType?: string; status?: string },
): Promise<StudyRegulatoryDocumentEntry[]> {
  try {
    let query = supabase
      .from('study_regulatory_documents')
      .select('*')
      .eq('study_id', studyId)
      .order('created_at', { ascending: false })

    if (options?.documentType) query = query.eq('document_type', options.documentType)
    if (options?.status) query = query.eq('status', options.status)

    const { data, error } = await query
    if (error) { console.error('Error loading study reg docs:', error.message); return [] }
    return (data ?? []) as StudyRegulatoryDocumentEntry[]
  } catch (err) {
    console.error('Error loading study reg docs:', err)
    return []
  }
}
