export const VISIT_TYPES = [
  'screening',
  'baseline',
  'treatment',
  'follow_up',
  'early_termination',
  'unscheduled',
  'phone',
  'remote',
  'other',
] as const

export type VisitType = (typeof VISIT_TYPES)[number]

export const VISIT_STATUS = {
  DRAFT: 'draft',
  ACTIVE: 'active',
  ARCHIVED: 'archived',
} as const

export type VisitStatus = (typeof VISIT_STATUS)[keyof typeof VISIT_STATUS]

export const VISIT_MODES = ['onsite', 'offsite', 'phone', 'remote'] as const

export type VisitMode = (typeof VISIT_MODES)[number]

export const SNAPSHOT_STATUS = {
  DRAFT: 'draft',
  COMPILED: 'compiled',
  ARCHIVED: 'archived',
} as const

export type SnapshotStatus = (typeof SNAPSHOT_STATUS)[keyof typeof SNAPSHOT_STATUS]

export type StudyRuntimeVisitRow = {
  id: string
  organizationId: string
  studyId: string
  visitCode: string
  visitName: string
  visitType: VisitType
  studyDay: number | null
  windowBeforeDays: number | null
  windowAfterDays: number | null
  sequenceOrder: number
  allowedModes: string[]
  required: boolean
  status: VisitStatus
  operationalNotes: string | null
  metadata: Record<string, unknown>
  createdBy: string
  createdAt: string
  updatedAt: string
}

export type StudyRuntimeVisitProcedureRow = {
  id: string
  organizationId: string
  studyId: string
  visitId: string
  studyProcedureBlueprintId: string
  procedureId: string
  blueprintVersionId: string
  procedureOrder: number
  required: boolean
  optionalityRule: Record<string, unknown>
  dependencyRule: Record<string, unknown>
  timingRule: Record<string, unknown>
  operationalOverrides: Record<string, unknown>
  createdBy: string
  createdAt: string
  updatedAt: string
  procedureCode?: string
  procedureName?: string
}

export type RuntimeVisitView = StudyRuntimeVisitRow & {
  procedures: StudyRuntimeVisitProcedureRow[]
}

export type CompiledGraphProcedure = {
  procedure_id: string
  procedure_code: string
  procedure_name: string
  blueprint_version_id: string
  study_procedure_blueprint_id: string
  procedure_order: number
  required: boolean
  optionality_rule: Record<string, unknown>
  dependency_rule: Record<string, unknown>
  timing_rule: Record<string, unknown>
  operational_overrides: Record<string, unknown>
}

export type CompiledGraphVisit = {
  visit_id: string
  visit_code: string
  visit_name: string
  visit_type: VisitType
  study_day: number | null
  window: {
    before_days: number | null
    after_days: number | null
  }
  sequence_order: number
  allowed_modes: string[]
  required: boolean
  procedures: CompiledGraphProcedure[]
}

export type StudyRuntimeGraphJson = {
  study_id: string
  organization_id: string
  visits: CompiledGraphVisit[]
}

export type CreateRuntimeVisitInput = {
  organization_id: string
  study_id: string
  visit_code: string
  visit_name: string
  visit_type: VisitType
  study_day?: number | null
  window_before_days?: number | null
  window_after_days?: number | null
  sequence_order: number
  allowed_modes?: string[]
  required?: boolean
  operational_notes?: string | null
  metadata?: Record<string, unknown>
}

export type UpdateRuntimeVisitInput = Partial<
  Omit<CreateRuntimeVisitInput, 'organization_id' | 'study_id' | 'visit_code'>
> & {
  visit_code?: string
  status?: VisitStatus
}

export type AddProcedureToVisitInput = {
  organization_id: string
  study_id: string
  visit_id: string
  study_procedure_blueprint_id: string
  procedure_order: number
  required?: boolean
  optionality_rule?: Record<string, unknown>
  dependency_rule?: Record<string, unknown>
  timing_rule?: Record<string, unknown>
  operational_overrides?: Record<string, unknown>
}

export function mapRuntimeVisitRow(row: Record<string, unknown>): StudyRuntimeVisitRow {
  return {
    id: String(row.id),
    organizationId: String(row.organization_id),
    studyId: String(row.study_id),
    visitCode: String(row.visit_code),
    visitName: String(row.visit_name),
    visitType: row.visit_type as VisitType,
    studyDay: row.study_day === null || row.study_day === undefined ? null : Number(row.study_day),
    windowBeforeDays:
      row.window_before_days === null || row.window_before_days === undefined
        ? null
        : Number(row.window_before_days),
    windowAfterDays:
      row.window_after_days === null || row.window_after_days === undefined
        ? null
        : Number(row.window_after_days),
    sequenceOrder: Number(row.sequence_order),
    allowedModes: Array.isArray(row.allowed_modes) ? row.allowed_modes.map(String) : ['onsite'],
    required: Boolean(row.required),
    status: row.status as VisitStatus,
    operationalNotes: row.operational_notes ? String(row.operational_notes) : null,
    metadata: (row.metadata ?? {}) as Record<string, unknown>,
    createdBy: String(row.created_by),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  }
}

export function mapVisitProcedureRow(row: Record<string, unknown>): StudyRuntimeVisitProcedureRow {
  return {
    id: String(row.id),
    organizationId: String(row.organization_id),
    studyId: String(row.study_id),
    visitId: String(row.visit_id),
    studyProcedureBlueprintId: String(row.study_procedure_blueprint_id),
    procedureId: String(row.procedure_id),
    blueprintVersionId: String(row.blueprint_version_id),
    procedureOrder: Number(row.procedure_order),
    required: Boolean(row.required),
    optionalityRule: (row.optionality_rule ?? {}) as Record<string, unknown>,
    dependencyRule: (row.dependency_rule ?? {}) as Record<string, unknown>,
    timingRule: (row.timing_rule ?? {}) as Record<string, unknown>,
    operationalOverrides: (row.operational_overrides ?? {}) as Record<string, unknown>,
    createdBy: String(row.created_by),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    procedureCode: row.procedure_code ? String(row.procedure_code) : undefined,
    procedureName: row.procedure_name ? String(row.procedure_name) : undefined,
  }
}
