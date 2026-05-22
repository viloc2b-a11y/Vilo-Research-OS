/**
 * Phase 12A — canonical clinical library contract (data only; no runtime engine changes).
 */

export type CanonicalDataType =
  | 'string'
  | 'number'
  | 'integer'
  | 'boolean'
  | 'date'
  | 'datetime'
  | 'select'
  | 'textarea'
  | 'file'

export type CanonicalLibraryKind = 'core' | 'overlay'

export type CanonicalAuditRelevance = 'high' | 'medium' | 'low'

export type CanonicalValidationRule =
  | { kind: 'min'; value: number; message: string }
  | { kind: 'max'; value: number; message: string }
  | { kind: 'regex'; pattern: string; message: string }
  | { kind: 'enum'; values: string[]; message: string }
  | {
      kind: 'required_when'
      when_field: string
      when_value: string | boolean | number
      fields: string[]
      message: string
    }

export type CanonicalClinicalField = {
  field_key: string
  display_label: string
  data_type: CanonicalDataType
  required_default: boolean
  list_code?: string | null
  unit?: string | null
  validation?: CanonicalValidationRule[]
  audit_relevance: CanonicalAuditRelevance
  protocol_notes?: string
  /** core = reusable across studies; overlay = protocol-specific extension */
  scope: 'core' | 'overlay'
}

export type CanonicalClinicalLibraryBlock = {
  library_code: string
  library_kind: CanonicalLibraryKind
  clinical_domain: string
  description: string
  fields: CanonicalClinicalField[]
}

export type CanonicalClinicalLibraryDocument = {
  library_version: string
  library_id: string
  description: string
  controlled_lists: Record<string, { code: string; label: string }[]>
  libraries: Record<string, CanonicalClinicalLibraryBlock>
  overlays: Record<string, CanonicalClinicalLibraryBlock>
}
