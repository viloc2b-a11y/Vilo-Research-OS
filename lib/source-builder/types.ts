/**
 * Phase 6A.4/6A.5 — Source Builder draft types (workspace + draft_payload JSON).
 */

export type DraftFieldDataType = 'string' | 'number' | 'boolean' | 'datetime' | 'date'

export type DraftField = {
  id: string
  fieldKey: string
  displayLabel: string
  dataType: DraftFieldDataType
  required: boolean
  hidden: boolean
  displayOrder: number
  helperText?: string
}

export type DraftProcedure = {
  id: string
  profileCode: string | null
  displayName: string
  category: string
  uiCategory: string
  fields: DraftField[]
  isCustom: boolean
}

export type DraftVisit = {
  id: string
  name: string
  visitType: string
  studyDay: string
  window: string
  notes: string
}

export type MatrixMarker = 'required' | 'optional' | 'not_done'

export type MatrixRow = {
  id: string
  visitId: string
  procedureId: string
  marker: MatrixMarker
  conditional: boolean
  timingNote: string
  operationalNote: string
  windowNote: string
}

export type SourceBuilderDraft = {
  id: string
  name: string
  protocolNickname: string
  description: string
  status: 'draft'
  lastSavedAt: string | null
  visits: DraftVisit[]
  procedures: DraftProcedure[]
  matrix: MatrixRow[]
  version: number
}

export type ProcedureProfileSummary = {
  procedure_profile_code: string
  display_name: string
  category: string
  uiCategory: string
  documentation_style: string
  operational_purpose: string
}

export type ProcedureLibraryBundle = {
  libraryVersion: string
  categories: { code: string; label: string }[]
  uiCategories: string[]
  profiles: ProcedureProfileSummary[]
  fieldTemplates: Record<
    string,
    { minimal: string[]; optional: string[]; evidence_strategy?: string }
  >
  rawProfiles: LibraryProfileRow[]
}

export type LibraryProfileRow = {
  procedure_profile_code: string
  display_name: string
  category: string
  documentation_style: string
  operational_purpose: string
  field_template: string
  field_overrides?: Record<string, string>
}
