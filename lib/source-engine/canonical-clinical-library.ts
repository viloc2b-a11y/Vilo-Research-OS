/**
 * Phase 12A — canonical clinical library loader and helpers.
 * Data: fixtures/source-builder/canonical-clinical-library.v1.json
 */

import libraryDocument from '@/fixtures/source-builder/canonical-clinical-library.v1.json'
import { defaultSourcePath } from '@/lib/source-engine/adapters'
import type {
  CanonicalClinicalField,
  CanonicalClinicalLibraryBlock,
  CanonicalClinicalLibraryDocument,
  CanonicalValidationRule,
} from '@/lib/source-engine/canonical-clinical-library.types'
import type {
  ClinicalDomain,
  FieldDefinition,
  FieldValidationRule,
  SelectOption,
  SourceWidgetType,
} from '@/lib/source-engine/types'

export type {
  CanonicalClinicalField,
  CanonicalClinicalLibraryBlock,
  CanonicalClinicalLibraryDocument,
  CanonicalDataType,
  CanonicalLibraryKind,
  CanonicalValidationRule,
} from '@/lib/source-engine/canonical-clinical-library.types'

const DOCUMENT = libraryDocument as CanonicalClinicalLibraryDocument

export const CANONICAL_CLINICAL_LIBRARY_VERSION = DOCUMENT.library_version
export const CANONICAL_CLINICAL_LIBRARY_ID = DOCUMENT.library_id
export const CANONICAL_CONTROLLED_LISTS = DOCUMENT.controlled_lists

export const CANONICAL_CORE_LIBRARY_CODES = Object.keys(DOCUMENT.libraries)
export const CANONICAL_OVERLAY_LIBRARY_CODES = Object.keys(DOCUMENT.overlays)

const DOMAIN_BY_LIBRARY: Record<string, ClinicalDomain> = {
  VITALS_CORE_V1: 'vital_signs',
  AE_CORE_V1: 'adverse_events',
  CONMED_CORE_V1: 'concomitant_medications',
  IP_ADMIN_CORE_V1: 'investigational_product',
  LAB_CORE_V1: 'labs',
  ECG_CORE_V1: 'ecg',
  PHYSICAL_EXAM_CORE_V1: 'physical_exam',
  PARA_ADRENAL_OVERLAY_V1: 'adrenal_testing',
  PARA_HIT_OVERLAY_V1: 'hit_monitoring',
  MV_HOUSEHOLD_SYMPTOM_OVERLAY_V1: 'respiratory_samples',
}

function listOptions(listCode: string | null | undefined): SelectOption[] | undefined {
  if (!listCode) return undefined
  const rows = CANONICAL_CONTROLLED_LISTS[listCode]
  if (!rows?.length) return undefined
  return rows.map((row) => ({ value: row.code, label: row.label }))
}

function mapDataType(dataType: CanonicalClinicalField['data_type']): SourceWidgetType {
  switch (dataType) {
    case 'integer':
      return 'integer'
    case 'number':
      return 'decimal'
    case 'boolean':
      return 'boolean'
    case 'date':
      return 'date'
    case 'datetime':
      return 'datetime'
    case 'select':
      return 'select'
    case 'textarea':
      return 'textarea'
    case 'file':
      return 'file_upload'
    default:
      return 'text'
  }
}

function mapValidationRules(rules: CanonicalValidationRule[] | undefined): FieldValidationRule[] {
  if (!rules?.length) return []
  const mapped: FieldValidationRule[] = []
  for (const rule of rules) {
    if (rule.kind === 'min') mapped.push({ kind: 'min', value: rule.value, message: rule.message })
    else if (rule.kind === 'max') mapped.push({ kind: 'max', value: rule.value, message: rule.message })
    else if (rule.kind === 'regex') mapped.push({ kind: 'regex', pattern: rule.pattern, message: rule.message })
    else if (rule.kind === 'enum') mapped.push({ kind: 'enum', values: rule.values, message: rule.message })
    else if (rule.kind === 'required_when') {
      for (const fieldKey of rule.fields) {
        mapped.push({
          kind: 'custom',
          ruleId: `required_when:${rule.when_field}:${String(rule.when_value)}:${fieldKey}`,
          message: rule.message,
          params: {
            when_field: rule.when_field,
            when_value: rule.when_value,
            target_field: fieldKey,
          },
        })
      }
    }
  }
  return mapped
}

export function loadCanonicalClinicalLibraryDocument(): CanonicalClinicalLibraryDocument {
  return DOCUMENT
}

export function getCanonicalLibraryBlock(code: string): CanonicalClinicalLibraryBlock | undefined {
  return DOCUMENT.libraries[code] ?? DOCUMENT.overlays[code]
}

export function getCanonicalLibraryFields(code: string): CanonicalClinicalField[] {
  return getCanonicalLibraryBlock(code)?.fields ?? []
}

export function getAllCanonicalLibraryBlocks(): CanonicalClinicalLibraryBlock[] {
  return [
    ...Object.values(DOCUMENT.libraries),
    ...Object.values(DOCUMENT.overlays),
  ]
}

export function resolveCanonicalClinicalDomain(libraryCode: string): ClinicalDomain {
  return DOMAIN_BY_LIBRARY[libraryCode] ?? 'vital_signs'
}

/** Map canonical library fields to legacy capture FieldDefinition (for template composition). */
export function canonicalFieldsToFieldDefinitions(
  libraryCode: string,
  fieldKeys?: string[],
): FieldDefinition[] {
  const block = getCanonicalLibraryBlock(libraryCode)
  if (!block) return []
  const domain = resolveCanonicalClinicalDomain(libraryCode)
  const keySet = fieldKeys ? new Set(fieldKeys) : null
  return block.fields
    .filter((row) => !keySet || keySet.has(row.field_key))
    .map((row) => {
      const validation = mapValidationRules(row.validation)
      if (row.required_default) {
        validation.unshift({ kind: 'required', message: `${row.display_label} is required.` })
      }
      return {
        key: row.field_key,
        label: row.display_label,
        type: mapDataType(row.data_type),
        domain,
        sourcePath: defaultSourcePath(domain, row.field_key),
        unit: row.unit ?? undefined,
        options: listOptions(row.list_code),
        instructions: row.protocol_notes || undefined,
        validation,
      } satisfies FieldDefinition
    })
}

export function composeCanonicalLibraryFieldKeys(
  coreCodes: string[],
  overlayCodes: string[] = [],
): string[] {
  const keys: string[] = []
  for (const code of [...coreCodes, ...overlayCodes]) {
    for (const field of getCanonicalLibraryFields(code)) {
      keys.push(field.field_key)
    }
  }
  return keys
}

export type CanonicalLibraryCollision = {
  field_key: string
  libraries: string[]
  scopes: string[]
}

/** Report duplicate field_key across libraries (overlays should use namespaces). */
export function reportCanonicalFieldKeyCollisions(): CanonicalLibraryCollision[] {
  const index = new Map<string, { libraries: string[]; scopes: string[] }>()
  for (const block of getAllCanonicalLibraryBlocks()) {
    for (const field of block.fields) {
      const entry = index.get(field.field_key) ?? { libraries: [], scopes: [] }
      entry.libraries.push(block.library_code)
      entry.scopes.push(field.scope)
      index.set(field.field_key, entry)
    }
  }
  return [...index.entries()]
    .filter(([, meta]) => meta.libraries.length > 1)
    .map(([field_key, meta]) => ({
      field_key,
      libraries: meta.libraries,
      scopes: meta.scopes,
    }))
}

export type CanonicalLibrarySmokeResult = {
  name: string
  pass: boolean
  detail?: string
}

export function runCanonicalClinicalLibrarySmokeTests(): CanonicalLibrarySmokeResult[] {
  const results: CanonicalLibrarySmokeResult[] = []
  const doc = loadCanonicalClinicalLibraryDocument()

  results.push({
    name: 'document loads',
    pass: Boolean(doc.library_version && doc.library_id),
    detail: `${doc.library_id} v${doc.library_version}`,
  })

  const requiredLists = [
    'YES_NO',
    'BODY_POSITION',
    'PRE_POST_IP_TIMING',
    'AE_SEVERITY',
    'AE_OUTCOME',
    'AE_CAUSALITY',
    'ROUTE',
    'LAB_SOURCE_TYPE',
    'PROCESSING_STATUS',
    'ECG_INTERPRETATION',
  ]
  for (const code of requiredLists) {
    results.push({
      name: `controlled list ${code}`,
      pass: Array.isArray(doc.controlled_lists[code]) && doc.controlled_lists[code].length > 0,
    })
  }

  for (const code of CANONICAL_CORE_LIBRARY_CODES) {
    const block = doc.libraries[code]
    const keys = block.fields.map((f) => f.field_key)
    const unique = new Set(keys)
    const hasConditional = block.fields.some((f) =>
      (f.validation ?? []).some((v) => v.kind === 'required_when'),
    )
    results.push({
      name: `core library ${code} loads`,
      pass: block.fields.length > 0,
      detail: `${block.fields.length} fields`,
    })
    results.push({
      name: `core library ${code} unique keys`,
      pass: unique.size === keys.length,
      detail: unique.size === keys.length ? undefined : `duplicate keys in ${code}`,
    })
    results.push({
      name: `core library ${code} conditional validation metadata`,
      pass: hasConditional,
    })
    const mapped = canonicalFieldsToFieldDefinitions(code)
    results.push({
      name: `core library ${code} maps to FieldDefinition`,
      pass: mapped.length === block.fields.length,
    })
  }

  for (const code of CANONICAL_OVERLAY_LIBRARY_CODES) {
    const block = doc.overlays[code]
    const overlayPrefix =
      code.startsWith('PARA_ADRENAL') ? 'adrenal_'
      : code.startsWith('PARA_HIT') ? 'hit_'
      : code.startsWith('MV_') ? 'mv_'
      : ''
    const namespaced = block.fields.every((f) => !overlayPrefix || f.field_key.startsWith(overlayPrefix))
    results.push({
      name: `overlay ${code} namespaced keys`,
      pass: namespaced,
    })
    results.push({
      name: `overlay ${code} loads`,
      pass: block.fields.length > 0,
      detail: `${block.fields.length} fields`,
    })
  }

  const collisions = reportCanonicalFieldKeyCollisions()
  const coreCrossLibrary = collisions.filter((c) =>
    c.libraries.some((lib) => CANONICAL_CORE_LIBRARY_CODES.includes(lib))
    && c.libraries.filter((lib) => CANONICAL_CORE_LIBRARY_CODES.includes(lib)).length > 1,
  )
  results.push({
    name: 'cross-library collision report',
    pass: true,
    detail:
      coreCrossLibrary.length === 0
        ? 'no cross-library duplicate field_key values'
        : `${coreCrossLibrary.length} shared key(s) across core blocks — compose one library per source section or namespace at template publish`,
  })

  return results
}
