export type StudyWorkspaceSummaryCounts = {
  subjectCount: number | null
  documentCount: number | null
  publishedSourceCount: number | null
  runtimeVisitCount: number | null
  lockedSnapshotCount: number | null
  openObligationsCount: number | null
  expirationAlertsCount: number | null
}

export type StudyWorkspaceSummary = {
  study: {
    id: string
    name: string
    status: string | null
    organizationId: string
  }
  counts: StudyWorkspaceSummaryCounts
  unavailable: string[]
}

export type StudyWorkspaceSubjectPreview = {
  id: string
  subjectIdentifier: string
  enrollmentStatus: string | null
}

export type StudyWorkspaceSectionId =
  | 'overview'
  | 'study-setup'
  | 'subjects'
  | 'source-runtime'
  | 'published-source'
  | 'visit-runtime'
  | 'regulatory-binder'
  | 'governance'
  | 'training'
  | 'delegation'
  | 'documents'
  | 'site-intelligence'
  | 'monitoring'
  | 'activity'
