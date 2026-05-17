import libraryJson from '@/fixtures/source-builder/procedure-profile-library.v1.json'
import { inferDataType, labelForFieldKey } from './field-labels'
import { resolveUiCategory, UI_CATEGORY_ORDER } from './ui-categories'
import type {
  DraftField,
  DraftProcedure,
  LibraryProfileRow,
  ProcedureLibraryBundle,
  ProcedureProfileSummary,
} from './types'

type RawLibrary = typeof libraryJson

function newId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID()
  }
  return `id-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

export function loadProcedureLibrary(): ProcedureLibraryBundle {
  const raw = libraryJson as RawLibrary
  const rawProfiles = raw.profiles as LibraryProfileRow[]
  const uiSet = new Set<string>()

  const profiles: ProcedureProfileSummary[] = rawProfiles.map((p) => {
    const uiCategory = resolveUiCategory(p)
    uiSet.add(uiCategory)
    return {
      procedure_profile_code: p.procedure_profile_code,
      display_name: p.display_name,
      category: p.category,
      uiCategory,
      documentation_style: p.documentation_style,
      operational_purpose: p.operational_purpose,
    }
  })

  const uiCategories = [
    ...UI_CATEGORY_ORDER.filter((c) => uiSet.has(c)),
    ...[...uiSet].filter((c) => !UI_CATEGORY_ORDER.includes(c as (typeof UI_CATEGORY_ORDER)[number])),
  ]

  return {
    libraryVersion: raw.library_version,
    categories: raw.categories,
    uiCategories,
    profiles,
    fieldTemplates: raw.field_templates,
    rawProfiles,
  }
}

export function buildFieldsFromProfile(
  profile: LibraryProfileRow,
  fieldTemplates: ProcedureLibraryBundle['fieldTemplates'],
): DraftField[] {
  const tmpl = fieldTemplates[profile.field_template]
  if (!tmpl) return []

  const overrides = profile.field_overrides ?? {}
  const keys: { key: string; required: boolean }[] = [
    ...tmpl.minimal.map((k) => ({ key: overrides[k] ?? k, required: true })),
    ...tmpl.optional.map((k) => ({ key: overrides[k] ?? k, required: false })),
  ]

  return keys.map((item, index) => ({
    id: newId(),
    fieldKey: item.key,
    displayLabel: labelForFieldKey(item.key),
    dataType: inferDataType(item.key),
    required: item.required,
    hidden: false,
    displayOrder: index,
  }))
}

export function createProcedureFromProfile(
  bundle: ProcedureLibraryBundle,
  profileCode: string,
): DraftProcedure | null {
  const raw = bundle.rawProfiles.find((p) => p.procedure_profile_code === profileCode)
  if (!raw) return null

  const summary = bundle.profiles.find((p) => p.procedure_profile_code === profileCode)
  return {
    id: newId(),
    profileCode,
    displayName: raw.display_name,
    category: raw.category,
    uiCategory: summary?.uiCategory ?? resolveUiCategory(raw),
    fields: buildFieldsFromProfile(raw, bundle.fieldTemplates),
    isCustom: false,
  }
}

export function createCustomProcedure(displayName: string, uiCategory: string): DraftProcedure {
  return {
    id: newId(),
    profileCode: null,
    displayName,
    category: 'CUSTOM',
    uiCategory,
    fields: [
      {
        id: newId(),
        fieldKey: 'comments',
        displayLabel: 'Comments',
        dataType: 'string',
        required: false,
        hidden: false,
        displayOrder: 0,
      },
    ],
    isCustom: true,
  }
}

export { newId }
