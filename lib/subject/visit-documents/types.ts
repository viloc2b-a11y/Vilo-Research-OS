export const VISIT_DOCUMENT_TYPES = [
  'ICF',
  'Labs',
  'Imaging',
  'ECG',
  'Source Document',
  'External Record',
  'Procedure Report',
  'Eligibility Document',
  'Progress Note Attachment',
  'Other',
] as const

export type VisitDocumentType = (typeof VISIT_DOCUMENT_TYPES)[number]

export type VisitDocumentRow = {
  id: string
  orgId: string
  studyId: string
  studySubjectId: string
  visitId: string
  documentType: VisitDocumentType
  fileName: string
  filePath: string
  mimeType: string
  fileSize: number
  uploadedBy: string | null
  uploadedAt: string
  notes: string | null
  previewUrl: string | null
  downloadUrl: string | null
}

export type VisitDocumentActionState = {
  ok: boolean
  message: string | null
}

export const INITIAL_VISIT_DOCUMENT_STATE: VisitDocumentActionState = {
  ok: false,
  message: null,
}

