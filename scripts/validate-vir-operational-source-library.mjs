import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(__dirname, '..')
const libraryPath = path.join(
  repoRoot,
  'fixtures',
  'source-builder',
  'vir-operational-source-library.v1.json',
)

const library = JSON.parse(fs.readFileSync(libraryPath, 'utf8'))

function assert(condition, message) {
  if (!condition) {
    throw new Error(message)
  }
}

function toTitle(key) {
  return key
    .split('_')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

function inferDataType(fieldKey) {
  if (fieldKey.endsWith('_datetime')) return 'datetime'
  if (/(date|completed_at|reviewed_at|signed_at|effective_date|expiration_date)$/i.test(fieldKey)) {
    return 'date'
  }
  if (
    /^(.*_required|.*_present|.*_available|.*_completed|.*_notified.*|signature_present|system_access_required|record_present|discrepancy_present|maintenance_required|return_to_vendor_required)$/i.test(
      fieldKey,
    )
  ) {
    return 'boolean'
  }
  return 'string'
}

function buildFieldsFromOperationalProfile(profileCode) {
  const profile = library.operational_profiles.find((item) => item.profile_code === profileCode)
  assert(profile, `Missing operational profile: ${profileCode}`)
  const template = library.field_templates[profile.field_template]
  assert(template, `Missing field template: ${profile.field_template}`)

  return [
    ...template.minimal.map((fieldKey) => ({ fieldKey, required: true })),
    ...template.optional.map((fieldKey) => ({ fieldKey, required: false })),
  ].map((field) => ({
    fieldKey: field.fieldKey,
    displayLabel: toTitle(field.fieldKey),
    dataType: inferDataType(field.fieldKey),
    required: field.required,
  }))
}

function buildEssentialDocumentChecklist() {
  return library.essential_document_requirements.map((item) => ({
    documentCode: item.document_code,
    displayName: item.display_name,
    requiredForRoles: item.required_for_roles ?? [],
    requiredForFacilities: item.required_for_facilities ?? [],
    defaultStatus: 'not_received',
  }))
}

function buildReadinessChecklist() {
  return {
    facilities: library.facility_requirements.map((item) => ({
      code: item.facility_code,
      displayName: item.display_name,
      category: item.category,
      defaultStatus: 'not_available',
    })),
    equipment: library.equipment_requirements.map((item) => ({
      code: item.equipment_code,
      displayName: item.display_name,
      category: item.category,
      defaultStatus: 'not_applicable',
    })),
  }
}

function buildSourceCaptureRuleCatalog() {
  return library.source_capture_rules.map((rule) => ({
    ruleCode: rule.rule_code,
    ruleName: rule.rule_name,
    ruleType: rule.rule_type,
    appliesTo: rule.applies_to,
  }))
}

assert(library.library_id === 'vir-operational-source-engine-library', 'Unexpected library id')
assert(library.operational_profiles.length >= 7, 'Operational profiles are incomplete')
assert(library.essential_document_requirements.length >= 10, 'Essential document checklist is incomplete')
assert(library.facility_requirements.length >= 8, 'Facility readiness checklist is incomplete')
assert(library.equipment_requirements.length >= 8, 'Equipment readiness checklist is incomplete')
assert(library.source_capture_rules.length >= 8, 'Source capture rules are incomplete')

for (const profile of library.operational_profiles) {
  assert(library.field_templates[profile.field_template], `Profile has invalid template: ${profile.profile_code}`)
  const fields = buildFieldsFromOperationalProfile(profile.profile_code)
  assert(fields.some((field) => field.required), `Profile has no required fields: ${profile.profile_code}`)
}

const readiness = buildReadinessChecklist()
const output = {
  libraryId: library.library_id,
  libraryVersion: library.library_version,
  operationalProfiles: library.operational_profiles.length,
  essentialDocuments: buildEssentialDocumentChecklist().length,
  facilityReadinessItems: readiness.facilities.length,
  equipmentReadinessItems: readiness.equipment.length,
  sourceCaptureRules: buildSourceCaptureRuleCatalog().length,
  sampleTrainingFields: buildFieldsFromOperationalProfile('OPS_STAFF_TRAINING_LOG'),
  sampleExternalSourceFields: buildFieldsFromOperationalProfile('OPS_EXTERNAL_SOURCE_RECONCILIATION'),
  firstFiveRules: buildSourceCaptureRuleCatalog().slice(0, 5),
}

console.log(JSON.stringify(output, null, 2))
