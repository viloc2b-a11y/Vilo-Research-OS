export const RECONCILIATION_SESSION_STATUS = {
  DRAFT_EXTRACTED: 'draft_extracted',
  IN_REVIEW: 'in_review',
  NEEDS_CLARIFICATION: 'needs_clarification',
  APPROVED: 'approved',
  REJECTED: 'rejected'
} as const

export type ReconciliationSessionStatus = (typeof RECONCILIATION_SESSION_STATUS)[keyof typeof RECONCILIATION_SESSION_STATUS]

export type ExtractedVisitCandidate = {
  id: string
  reconciliationSessionId: string
  parserResultId: string
  visitLabel: string
  studyDay: number | null
  window: string | null
  visitType: string | null
  confidence: number
  status: 'pending' | 'approved' | 'rejected' | 'merged'
  provenance: {
    documentId: string
    page: string
    tableId: string
    sourceText: string
  }
}

export type ExtractedProcedureCandidate = {
  id: string
  reconciliationSessionId: string
  parserResultId: string
  procedureName: string
  category: string | null
  canonicalProcedureId: string | null
  confidence: number
  status: 'pending' | 'approved' | 'rejected' | 'merged'
  provenance: {
    documentId: string
    page: string
    tableId: string
    sourceText: string
  }
}

export type ExtractedMatrixCellCandidate = {
  id: string
  reconciliationSessionId: string
  parserResultId: string
  visitCandidateId: string
  procedureCandidateId: string
  markerText: string
  isRequired: boolean
  isConditional: boolean
  conditionText: string | null
  confidence: number
  status: 'pending' | 'approved' | 'rejected'
  provenance: {
    documentId: string
    page: string
    tableId: string
    sourceText: string
  }
}

export type ReconciliationSession = {
  id: string
  studyId: string
  documentId: string
  status: ReconciliationSessionStatus
  reviewerId: string | null
  reviewNotes: string | null
  createdAt: string
  updatedAt: string
}

export type ApprovedReconciliationResult = {
  sessionId: string
  approvedVisits: ExtractedVisitCandidate[]
  approvedProcedures: ExtractedProcedureCandidate[]
  approvedMatrixCells: ExtractedMatrixCellCandidate[]
  unresolvedItemsCount: number
  approvedBy: string
  approvedAt: string
}
