import virOperationalLibraryJson from '@/fixtures/source-builder/vir-operational-source-library.v1.json'

export type VirOperationalLibrary = typeof virOperationalLibraryJson

export type OperationalProfile = VirOperationalLibrary['operational_profiles'][number]
export type EssentialDocumentRequirement =
  VirOperationalLibrary['essential_document_requirements'][number]
export type FacilityRequirement = VirOperationalLibrary['facility_requirements'][number]
export type EquipmentRequirement = VirOperationalLibrary['equipment_requirements'][number]
export type SourceCaptureRule = VirOperationalLibrary['source_capture_rules'][number]

export type SourceEngineLibrarySeed = {
  libraryVersion: string
  operationalProfiles: OperationalProfile[]
  essentialDocuments: EssentialDocumentRequirement[]
  facilityRequirements: FacilityRequirement[]
  equipmentRequirements: EquipmentRequirement[]
  sourceCaptureRules: SourceCaptureRule[]
}

export type SourceBuilderFieldSeed = {
  fieldKey: string
  displayLabel: string
  dataType: 'string' | 'number' | 'boolean' | 'date' | 'datetime'
  required: boolean
  helperText?: string
}

type OperationalFieldTemplate = {
  minimal: string[]
  optional: string[]
  evidence_strategy?: string
}

const DATE_FIELD_PATTERN = /(date|completed_at|reviewed_at|signed_at|effective_date|expiration_date)$/i
const BOOLEAN_FIELD_PATTERN =
  /^(.*_required|.*_present|.*_available|.*_completed|.*_required|.*_notified.*|signature_present|system_access_required|record_present|discrepancy_present|maintenance_required|return_to_vendor_required)$/i

function toTitle(key: string): string {
  return key
    .split('_')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

function inferOperationalDataType(fieldKey: string): SourceBuilderFieldSeed['dataType'] {
  if (fieldKey.endsWith('_datetime')) return 'datetime'
  if (DATE_FIELD_PATTERN.test(fieldKey)) return 'date'
  if (BOOLEAN_FIELD_PATTERN.test(fieldKey)) return 'boolean'
  return 'string'
}

export function loadVirOperationalSourceLibrary(): SourceEngineLibrarySeed {
  return {
    libraryVersion: virOperationalLibraryJson.library_version,
    operationalProfiles: virOperationalLibraryJson.operational_profiles,
    essentialDocuments: virOperationalLibraryJson.essential_document_requirements,
    facilityRequirements: virOperationalLibraryJson.facility_requirements,
    equipmentRequirements: virOperationalLibraryJson.equipment_requirements,
    sourceCaptureRules: virOperationalLibraryJson.source_capture_rules,
  }
}

export function buildFieldsFromOperationalProfile(
  profileCode: string,
): SourceBuilderFieldSeed[] {
  const profile = virOperationalLibraryJson.operational_profiles.find(
    (item) => item.profile_code === profileCode,
  )
  if (!profile) return []

  const templates = virOperationalLibraryJson.field_templates as Record<string, OperationalFieldTemplate>
  const template = templates[profile.field_template]
  if (!template) return []

  return [
    ...template.minimal.map((fieldKey: string) => ({ fieldKey, required: true })),
    ...template.optional.map((fieldKey: string) => ({ fieldKey, required: false })),
  ].map((field) => ({
    fieldKey: field.fieldKey,
    displayLabel: toTitle(field.fieldKey),
    dataType: inferOperationalDataType(field.fieldKey),
    required: field.required,
    helperText: field.required ? 'Required for startup/readiness tracking.' : undefined,
  }))
}

export function buildEssentialDocumentChecklist() {
  return virOperationalLibraryJson.essential_document_requirements.map((item) => ({
    documentCode: item.document_code,
    displayName: item.display_name,
    requiredForRoles: 'required_for_roles' in item ? item.required_for_roles : [],
    requiredForFacilities: 'required_for_facilities' in item ? item.required_for_facilities : [],
    defaultStatus: 'not_received' as const,
  }))
}

export function buildReadinessChecklist() {
  return {
    facilities: virOperationalLibraryJson.facility_requirements.map((item) => ({
      code: item.facility_code,
      displayName: item.display_name,
      category: item.category,
      defaultStatus: 'not_available' as const,
    })),
    equipment: virOperationalLibraryJson.equipment_requirements.map((item) => ({
      code: item.equipment_code,
      displayName: item.display_name,
      category: item.category,
      defaultStatus: 'not_applicable' as const,
    })),
  }
}

export function buildSourceCaptureRuleCatalog() {
  return virOperationalLibraryJson.source_capture_rules.map((rule) => ({
    ruleCode: rule.rule_code,
    ruleName: rule.rule_name,
    ruleType: rule.rule_type,
    appliesTo: rule.applies_to,
    implementationHint: rule.implementation_hint,
  }))
}
