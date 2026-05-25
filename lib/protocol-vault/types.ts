export const RAW_DOCUMENT_STATUSES = ['registered', 'archived', 'superseded'] as const
export type RawDocumentStatus = (typeof RAW_DOCUMENT_STATUSES)[number]

export const STUDY_ALIAS_TOKEN_TYPES = [
  'protocol_number',
  'sponsor',
  'compound',
  'study_code',
  'filename',
  'other',
] as const
export type StudyAliasTokenType = (typeof STUDY_ALIAS_TOKEN_TYPES)[number]

export const STUDY_ALIAS_SOURCES = ['manual', 'intake', 'migration', 'inferred'] as const
export type StudyAliasSource = (typeof STUDY_ALIAS_SOURCES)[number]

/** Registry row — vault-only fields must not cross into runtime payloads. */
export type ProtocolRawDocumentRecord = {
  id: string
  organization_id: string
  study_id: string | null
  original_filename: string
  storage_path: string
  checksum: string
  mime_type: string | null
  status: RawDocumentStatus
  created_by: string | null
  created_at: string
}

/** Safe summary for non-vault callers (no filename / storage path). */
export type RawDocumentRegistrySummary = {
  id: string
  organizationId: string
  studyId: string | null
  checksum: string
  mimeType: string | null
  status: RawDocumentStatus
  createdAt: string
}

export type StudyAliasMapRow = {
  id: string
  study_id: string
  raw_token: string
  token_type: StudyAliasTokenType
  safe_alias: string
  source: StudyAliasSource
  confidence: number | null
  approved_by: string | null
  approved_at: string | null
  created_at: string
}

export const STUDY_DISPLAY_MODES = ['operational', 'sanitized'] as const
export type StudyDisplayMode = (typeof STUDY_DISPLAY_MODES)[number]

/** Study labels for UI / exports — mode selects real tenant metadata vs aliases. */
export type StudyDisplay = {
  internalStudyId: string
  displayMode: StudyDisplayMode
  studyTitle: string
  protocolLabel: string
  sponsorLabel: string
  compoundLabel: string
  coordinatorDisplayName: string
}

/** Sanitized-only shape (legacy); use StudyDisplay with displayMode instead. */
export type StudySafeDisplay = {
  internalStudyId: string
  protocolAlias: string
  sponsorAlias: string
  compoundAlias: string
  coordinatorDisplayName: string
}
