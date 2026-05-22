/**
 * Phase 12B — deterministic source composition manifest (data only).
 */

export type SourceCompositionManifestVersion = '12B.1.0'

export type SourceCompositionOmission = {
  field_key: string
  omission_reason: string
}

export type SourceCompositionSection = {
  /** Unique within manifest; used for section-scoped runtime field keys. */
  section_key: string
  /** Core library code (mutually exclusive with overlay). */
  library?: string
  /** Overlay library code (mutually exclusive with library). */
  overlay?: string
  /** When set, only these logical field keys are composed (library order preserved). */
  include?: string[]
  /** Logical keys removed from the composed set (cannot drop required_default fields). */
  exclude?: string[]
  /** Force required flag on resolved fields. */
  required_overrides?: Record<string, boolean>
  /** Fields present but hidden in capture preview. */
  hidden_fields?: string[]
  /** Explicit omissions with audit reason (optional fields only unless override). */
  omissions?: SourceCompositionOmission[]
  protocol_notes?: string
  /**
   * Optional alias map: logical_key -> alternate runtime suffix (within section namespace).
   * Full runtime key becomes `{section_key}__{alias}`.
   */
  aliases?: Record<string, string>
}

export type SourceCompositionManifest = {
  manifest_version: SourceCompositionManifestVersion
  template_key: string
  /** Pins Phase 12A canonical clinical library version at compose/publish time. */
  library_version: string
  label: string
  protocol_notes?: string
  sections: SourceCompositionSection[]
}

export type ResolvedCompositionSection = {
  section_key: string
  library_code: string
  library_kind: 'core' | 'overlay'
  protocol_notes?: string
  field_count: number
  hidden_count: number
  omitted_count: number
}

export type ResolvedCompositionFieldMeta = {
  runtime_key: string
  logical_key: string
  section_key: string
  library_code: string
  hidden: boolean
  omitted: boolean
  omission_reason?: string
  required: boolean
  audit_relevance?: string
  protocol_notes?: string
}

export type ResolvedSourceComposition = {
  template_key: string
  manifest_version: SourceCompositionManifestVersion
  library_version: string
  label: string
  fingerprint: string
  sections: ResolvedCompositionSection[]
  /** Active capture fields (omitted fields excluded). */
  fields: import('@/lib/source-engine/types').FieldDefinition[]
  field_meta: ResolvedCompositionFieldMeta[]
}

export type CompositionPublishSnapshot = {
  template_key: string
  composition_fingerprint: string
  library_version: string
  manifest_version: SourceCompositionManifestVersion
  /** Frozen at publish — later library edits do not affect published SDVs. */
  composition_manifest: SourceCompositionManifest
  resolved_field_keys: string[]
  provenance_json: {
    composition_manifest: SourceCompositionManifest
    composition_fingerprint: string
    library_version: string
    manifest_version: SourceCompositionManifestVersion
    resolved_field_keys: string[]
    frozen_at: string
  }
}
