export const LIBRARY_SCOPE = {
  GLOBAL: 'global',
  ORGANIZATION: 'organization',
} as const

export type LibraryScope = (typeof LIBRARY_SCOPE)[keyof typeof LIBRARY_SCOPE]

export const PROCEDURE_COMPLEXITY = {
  SIMPLE: 'simple',
  STANDARD: 'standard',
  COMPLEX: 'complex',
  CRITICAL: 'critical',
} as const

export type ProcedureComplexity = (typeof PROCEDURE_COMPLEXITY)[keyof typeof PROCEDURE_COMPLEXITY]

export const PROCEDURE_STATUS = {
  ACTIVE: 'active',
  INACTIVE: 'inactive',
  DRAFT: 'draft',
  ARCHIVED: 'archived',
} as const

export type ProcedureStatus = (typeof PROCEDURE_STATUS)[keyof typeof PROCEDURE_STATUS]

export const BLUEPRINT_STATUS = {
  DRAFT: 'draft',
  PUBLISHED: 'published',
  ARCHIVED: 'archived',
} as const

export type BlueprintStatus = (typeof BLUEPRINT_STATUS)[keyof typeof BLUEPRINT_STATUS]

export const FIELD_TYPES = [
  'text',
  'textarea',
  'number',
  'date',
  'datetime',
  'select',
  'multiselect',
  'checkbox',
  'radio',
  'yes_no',
  'table',
  'signature',
  'file_upload',
  'calculated',
  'vital_sign',
  'lab_result',
] as const

export type FieldType = (typeof FIELD_TYPES)[number]

export type BlueprintField = {
  field_id: string
  type: FieldType | string
  required?: boolean
  label?: string
  options?: string[]
}

export type BlueprintSection = {
  section_id: string
  title: string
  fields: BlueprintField[]
  instructions?: string
  coordinator_guidance?: string
}

export type BlueprintJson = {
  sections: BlueprintSection[]
  instructions?: string
  coordinator_guidance?: string
  source_requirements?: Record<string, unknown>
  signature_requirements?: Record<string, unknown>
  operational_warnings?: string[]
}

export type FieldSchema = {
  fields: Array<{
    field_id: string
    type: FieldType | string
    label?: string
    options?: string[]
    required?: boolean
  }>
}

export type DependencyRule = {
  if: Record<string, unknown>
  then: Record<string, unknown>
}

export type DependencySchema = {
  rules?: DependencyRule[]
}

export type ProcedureLibraryRow = {
  id: string
  organizationId: string | null
  libraryScope: LibraryScope
  procedureCode: string
  procedureName: string
  procedureCategory: string
  procedureSubcategory: string | null
  description: string | null
  operationalDescription: string | null
  sourceTemplateEnabled: boolean
  requiresSignature: boolean
  requiresCertifiedCopy: boolean
  supportsOffsite: boolean
  procedureComplexity: ProcedureComplexity
  estimatedDurationMinutes: number | null
  activeVersionId: string | null
  status: ProcedureStatus
  tags: string[]
  metadata: Record<string, unknown>
  createdBy: string
  createdAt: string
  updatedAt: string
}

export type ProcedureBlueprintVersionRow = {
  id: string
  procedureId: string
  versionNumber: number
  blueprintStatus: BlueprintStatus
  blueprintJson: BlueprintJson
  fieldSchema: FieldSchema
  dependencySchema: DependencySchema
  operationalRules: Record<string, unknown>
  sourceRenderSchema: Record<string, unknown>
  createdBy: string
  createdAt: string
}

export type StudyProcedureBlueprintRow = {
  id: string
  organizationId: string
  studyId: string
  procedureId: string
  blueprintVersionId: string
  visitType: string | null
  visitCode: string | null
  required: boolean
  optionalityRule: Record<string, unknown>
  schedulingRules: Record<string, unknown>
  operationalOverrides: Record<string, unknown>
  createdBy: string
  createdAt: string
}

export type CreateProcedureInput = {
  library_scope?: LibraryScope
  organization_id?: string | null
  procedure_code: string
  procedure_name: string
  procedure_category: string
  procedure_subcategory?: string | null
  description?: string | null
  operational_description?: string | null
  source_template_enabled?: boolean
  requires_signature?: boolean
  requires_certified_copy?: boolean
  supports_offsite?: boolean
  procedure_complexity?: ProcedureComplexity
  estimated_duration_minutes?: number | null
  tags?: string[]
  metadata?: Record<string, unknown>
}

export type CreateBlueprintVersionInput = {
  blueprint_json: BlueprintJson
  field_schema: FieldSchema
  dependency_schema?: DependencySchema
  operational_rules?: Record<string, unknown>
  source_render_schema?: Record<string, unknown>
}

export type AssignBlueprintToStudyInput = {
  organization_id: string
  study_id: string
  procedure_id: string
  blueprint_version_id: string
  visit_type?: string | null
  visit_code?: string | null
  required?: boolean
  optionality_rule?: Record<string, unknown>
  scheduling_rules?: Record<string, unknown>
  operational_overrides?: Record<string, unknown>
}

export function mapProcedureRow(row: Record<string, unknown>): ProcedureLibraryRow {
  return {
    id: String(row.id),
    organizationId: row.organization_id ? String(row.organization_id) : null,
    libraryScope: row.library_scope as LibraryScope,
    procedureCode: String(row.procedure_code),
    procedureName: String(row.procedure_name),
    procedureCategory: String(row.procedure_category),
    procedureSubcategory: row.procedure_subcategory ? String(row.procedure_subcategory) : null,
    description: row.description ? String(row.description) : null,
    operationalDescription: row.operational_description ? String(row.operational_description) : null,
    sourceTemplateEnabled: Boolean(row.source_template_enabled),
    requiresSignature: Boolean(row.requires_signature),
    requiresCertifiedCopy: Boolean(row.requires_certified_copy),
    supportsOffsite: Boolean(row.supports_offsite),
    procedureComplexity: row.procedure_complexity as ProcedureComplexity,
    estimatedDurationMinutes:
      row.estimated_duration_minutes === null || row.estimated_duration_minutes === undefined
        ? null
        : Number(row.estimated_duration_minutes),
    activeVersionId: row.active_version_id ? String(row.active_version_id) : null,
    status: row.status as ProcedureStatus,
    tags: Array.isArray(row.tags) ? row.tags.map(String) : [],
    metadata: (row.metadata ?? {}) as Record<string, unknown>,
    createdBy: String(row.created_by),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  }
}

export function mapBlueprintVersionRow(row: Record<string, unknown>): ProcedureBlueprintVersionRow {
  return {
    id: String(row.id),
    procedureId: String(row.procedure_id),
    versionNumber: Number(row.version_number),
    blueprintStatus: row.blueprint_status as BlueprintStatus,
    blueprintJson: row.blueprint_json as BlueprintJson,
    fieldSchema: row.field_schema as FieldSchema,
    dependencySchema: (row.dependency_schema ?? {}) as DependencySchema,
    operationalRules: (row.operational_rules ?? {}) as Record<string, unknown>,
    sourceRenderSchema: (row.source_render_schema ?? {}) as Record<string, unknown>,
    createdBy: String(row.created_by),
    createdAt: String(row.created_at),
  }
}

export function mapStudyBlueprintRow(row: Record<string, unknown>): StudyProcedureBlueprintRow {
  return {
    id: String(row.id),
    organizationId: String(row.organization_id),
    studyId: String(row.study_id),
    procedureId: String(row.procedure_id),
    blueprintVersionId: String(row.blueprint_version_id),
    visitType: row.visit_type ? String(row.visit_type) : null,
    visitCode: row.visit_code ? String(row.visit_code) : null,
    required: Boolean(row.required),
    optionalityRule: (row.optionality_rule ?? {}) as Record<string, unknown>,
    schedulingRules: (row.scheduling_rules ?? {}) as Record<string, unknown>,
    operationalOverrides: (row.operational_overrides ?? {}) as Record<string, unknown>,
    createdBy: String(row.created_by),
    createdAt: String(row.created_at),
  }
}

export function buildMinimalBlueprint(
  sectionId: string,
  title: string,
  fields: BlueprintField[],
): BlueprintJson {
  return {
    sections: [{ section_id: sectionId, title, fields }],
  }
}

export function buildFieldSchemaFromBlueprint(blueprint: BlueprintJson): FieldSchema {
  const fields = blueprint.sections.flatMap((section) =>
    section.fields.map((field) => ({
      field_id: field.field_id,
      type: field.type,
      label: field.label ?? field.field_id,
      options: field.options,
      required: field.required,
    })),
  )
  return { fields }
}
