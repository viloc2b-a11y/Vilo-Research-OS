/**
 * Phase 12B — deterministic canonical library composition resolver.
 */

import { createHash } from 'node:crypto'
import { CANONICAL_CLINICAL_LIBRARY_VERSION } from '@/lib/source-engine/canonical-clinical-library'
import {
  canonicalFieldsToFieldDefinitions,
  getCanonicalLibraryBlock,
  getCanonicalLibraryFields,
} from '@/lib/source-engine/canonical-clinical-library'
import type { CanonicalClinicalField } from '@/lib/source-engine/canonical-clinical-library.types'
import type {
  ResolvedCompositionFieldMeta,
  ResolvedCompositionSection,
  ResolvedSourceComposition,
  SourceCompositionManifest,
  SourceCompositionSection,
} from '@/lib/source-engine/source-composition.types'
import type { FieldDefinition } from '@/lib/source-engine/types'

export class SourceCompositionResolveError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'SourceCompositionResolveError'
  }
}

function stableSerialize(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map(stableSerialize).join(',')}]`
  const obj = value as Record<string, unknown>
  const keys = Object.keys(obj).sort()
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableSerialize(obj[k])}`).join(',')}}`
}

function fingerprintResolved(fields: FieldDefinition[], meta: ResolvedCompositionFieldMeta[], manifest: SourceCompositionManifest) {
  const payload = {
    template_key: manifest.template_key,
    library_version: manifest.library_version,
    manifest_version: manifest.manifest_version,
    sections: manifest.sections.map((s) => ({
      section_key: s.section_key,
      library: s.library ?? null,
      overlay: s.overlay ?? null,
      include: s.include ?? null,
      exclude: s.exclude ?? null,
      required_overrides: s.required_overrides ?? null,
      hidden_fields: s.hidden_fields ?? null,
      omissions: s.omissions ?? null,
      aliases: s.aliases ?? null,
    })),
    fields: fields.map((f) => ({
      key: f.key,
      label: f.label,
      type: f.type,
      domain: f.domain,
      unit: f.unit ?? null,
      validation: f.validation ?? [],
    })),
    meta: meta
      .filter((m) => !m.omitted)
      .map((m) => ({
        runtime_key: m.runtime_key,
        logical_key: m.logical_key,
        section_key: m.section_key,
        library_code: m.library_code,
        required: m.required,
        hidden: m.hidden,
      })),
  }
  return createHash('sha256').update(stableSerialize(payload)).digest('hex')
}

function libraryCodeForSection(section: SourceCompositionSection): string {
  const code = section.library ?? section.overlay
  if (!code) {
    throw new SourceCompositionResolveError(
      `Section ${section.section_key} must specify library or overlay.`,
    )
  }
  if (section.library && section.overlay) {
    throw new SourceCompositionResolveError(
      `Section ${section.section_key} cannot specify both library and overlay.`,
    )
  }
  return code
}

function selectLogicalKeys(
  section: SourceCompositionSection,
  blockFields: CanonicalClinicalField[],
): string[] {
  const allKeys = blockFields.map((f) => f.field_key)
  const includeSet = section.include ? new Set(section.include) : null
  const excludeSet = new Set(section.exclude ?? [])
  const omissionSet = new Set((section.omissions ?? []).map((o) => o.field_key))

  let keys: string[]
  if (includeSet) {
    const unknown = section.include!.filter((k) => !allKeys.includes(k))
    if (unknown.length) {
      throw new SourceCompositionResolveError(
        `Section ${section.section_key} include references unknown field(s): ${unknown.join(', ')}`,
      )
    }
    keys = allKeys.filter((k) => includeSet.has(k))
  } else {
    keys = [...allKeys]
  }

  keys = keys.filter((k) => !excludeSet.has(k) && !omissionSet.has(k))

  for (const row of section.omissions ?? []) {
    if (!allKeys.includes(row.field_key)) {
      throw new SourceCompositionResolveError(
        `Section ${section.section_key} omission references unknown field: ${row.field_key}`,
      )
    }
  }

  for (const hidden of section.hidden_fields ?? []) {
    if (!allKeys.includes(hidden)) {
      throw new SourceCompositionResolveError(
        `Section ${section.section_key} hidden_fields references unknown field: ${hidden}`,
      )
    }
  }

  return keys
}

function assertRequiredFieldsNotDropped(
  section: SourceCompositionSection,
  blockFields: CanonicalClinicalField[],
  selectedKeys: string[],
) {
  const selected = new Set(selectedKeys)
  const overrides = section.required_overrides ?? {}
  for (const row of blockFields) {
    if (!row.required_default) continue
    if (overrides[row.field_key] === false) continue
    if (!selected.has(row.field_key)) {
      throw new SourceCompositionResolveError(
        `Section ${section.section_key} cannot drop required field ${row.field_key} without required_overrides.${row.field_key}=false and an explicit omission.`,
      )
    }
  }
}

function runtimeKeyFor(sectionKey: string, logicalKey: string, alias?: string) {
  const suffix = alias ?? logicalKey
  if (!/^[a-zA-Z0-9_]+$/.test(suffix)) {
    throw new SourceCompositionResolveError(`Invalid runtime key suffix: ${suffix}`)
  }
  return `${sectionKey}__${suffix}`
}

export function resolveSourceCompositionManifest(
  manifest: SourceCompositionManifest,
): ResolvedSourceComposition {
  if (manifest.library_version !== CANONICAL_CLINICAL_LIBRARY_VERSION) {
    throw new SourceCompositionResolveError(
      `Manifest library_version ${manifest.library_version} does not match loaded canonical library ${CANONICAL_CLINICAL_LIBRARY_VERSION}.`,
    )
  }

  const sectionKeys = new Set<string>()
  const runtimeKeys = new Set<string>()
  const fields: FieldDefinition[] = []
  const field_meta: ResolvedCompositionFieldMeta[] = []
  const sections: ResolvedCompositionSection[] = []

  for (const section of manifest.sections) {
    if (!section.section_key?.trim()) {
      throw new SourceCompositionResolveError('Every section requires a non-empty section_key.')
    }
    if (sectionKeys.has(section.section_key)) {
      throw new SourceCompositionResolveError(`Duplicate section_key: ${section.section_key}`)
    }
    sectionKeys.add(section.section_key)

    const libraryCode = libraryCodeForSection(section)
    const block = getCanonicalLibraryBlock(libraryCode)
    if (!block) {
      throw new SourceCompositionResolveError(`Unknown library/overlay: ${libraryCode}`)
    }

    const blockFields = getCanonicalLibraryFields(libraryCode)
    const logicalKeys = selectLogicalKeys(section, blockFields)
    assertRequiredFieldsNotDropped(section, blockFields, logicalKeys)
    for (const omission of section.omissions ?? []) {
      const row = blockFields.find((f) => f.field_key === omission.field_key)
      if (row?.required_default && section.required_overrides?.[omission.field_key] !== false) {
        throw new SourceCompositionResolveError(
          `Section ${section.section_key} cannot omit required field ${omission.field_key}.`,
        )
      }
    }

    const hiddenSet = new Set(section.hidden_fields ?? [])
    const omissionByKey = new Map((section.omissions ?? []).map((o) => [o.field_key, o.omission_reason]))
    const defs = canonicalFieldsToFieldDefinitions(libraryCode, logicalKeys)
    const defByKey = new Map(defs.map((d) => [d.key, d]))
    const rowByKey = new Map(blockFields.map((r) => [r.field_key, r]))

    let hiddenCount = 0
    let omittedCount = 0

    for (const logicalKey of logicalKeys) {
      const row = rowByKey.get(logicalKey)
      const base = defByKey.get(logicalKey)
      if (!row || !base) continue

      const alias = section.aliases?.[logicalKey]
      const runtime_key = runtimeKeyFor(section.section_key, logicalKey, alias)
      if (runtimeKeys.has(runtime_key)) {
        throw new SourceCompositionResolveError(
          `Collision: runtime key ${runtime_key} already composed (section ${section.section_key}, field ${logicalKey}). Provide aliases to disambiguate.`,
        )
      }
      runtimeKeys.add(runtime_key)

      const requiredOverride = section.required_overrides?.[logicalKey]
      const required =
        requiredOverride !== undefined ? requiredOverride : row.required_default
      const hidden = hiddenSet.has(logicalKey)
      if (hidden) hiddenCount++

      const validation = [...(base.validation ?? [])]
      if (required) {
        if (!validation.some((v) => v.kind === 'required')) {
          validation.unshift({
            kind: 'required',
            message: `${row.display_label} is required.`,
          })
        }
      } else {
        const idx = validation.findIndex((v) => v.kind === 'required')
        if (idx >= 0) validation.splice(idx, 1)
      }

      const resolved: FieldDefinition = {
        ...base,
        key: runtime_key,
        validation,
        instructions: [base.instructions, section.protocol_notes, row.protocol_notes]
          .filter(Boolean)
          .join(' ')
          .trim() || undefined,
      }

      fields.push(resolved)
      field_meta.push({
        runtime_key,
        logical_key: logicalKey,
        section_key: section.section_key,
        library_code: libraryCode,
        hidden,
        omitted: false,
        required,
        audit_relevance: row.audit_relevance,
        protocol_notes: row.protocol_notes || section.protocol_notes,
      })
    }

    for (const omission of section.omissions ?? []) {
      omittedCount++
      const row = rowByKey.get(omission.field_key)
      field_meta.push({
        runtime_key: runtimeKeyFor(section.section_key, omission.field_key, section.aliases?.[omission.field_key]),
        logical_key: omission.field_key,
        section_key: section.section_key,
        library_code: libraryCode,
        hidden: false,
        omitted: true,
        omission_reason: omission.omission_reason,
        required: false,
        audit_relevance: row?.audit_relevance,
        protocol_notes: row?.protocol_notes,
      })
    }

    sections.push({
      section_key: section.section_key,
      library_code: libraryCode,
      library_kind: block.library_kind,
      protocol_notes: section.protocol_notes,
      field_count: logicalKeys.length,
      hidden_count: hiddenCount,
      omitted_count: omittedCount,
    })
  }

  const fingerprint = fingerprintResolved(fields, field_meta, manifest)

  return {
    template_key: manifest.template_key,
    manifest_version: manifest.manifest_version,
    library_version: manifest.library_version,
    label: manifest.label,
    fingerprint,
    sections,
    fields,
    field_meta,
  }
}

export function buildCompositionPublishSnapshot(
  manifest: SourceCompositionManifest,
  frozenAt = new Date().toISOString(),
): import('@/lib/source-engine/source-composition.types').CompositionPublishSnapshot {
  const resolved = resolveSourceCompositionManifest(manifest)
  const composition_manifest = structuredClone(manifest)
  return {
    template_key: manifest.template_key,
    composition_fingerprint: resolved.fingerprint,
    library_version: manifest.library_version,
    manifest_version: manifest.manifest_version,
    composition_manifest,
    resolved_field_keys: resolved.fields.map((f) => f.key),
    provenance_json: {
      composition_manifest,
      composition_fingerprint: resolved.fingerprint,
      library_version: manifest.library_version,
      manifest_version: manifest.manifest_version,
      resolved_field_keys: resolved.fields.map((f) => f.key),
      frozen_at: frozenAt,
    },
  }
}
