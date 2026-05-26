import type { FieldSchema } from '@/lib/procedure-library/procedure-types'
import type { StudyRuntimeGraphJson } from '@/lib/study-runtime-composition/runtime-composition-types'

export const PACKAGE_STATUS = {
  DRAFT: 'draft',
  REVIEWED: 'reviewed',
  APPROVED: 'approved',
  ARCHIVED: 'archived',
} as const

export type PackageStatus = (typeof PACKAGE_STATUS)[keyof typeof PACKAGE_STATUS]

export const SHELL_STATUS = {
  DRAFT: 'draft',
  REVIEWED: 'reviewed',
  APPROVED: 'approved',
  ARCHIVED: 'archived',
} as const

export type ShellStatus = (typeof SHELL_STATUS)[keyof typeof SHELL_STATUS]

export type SourceFieldShell = {
  field_id: string
  label: string
  type: string
  required: boolean
  source_state: 'draft'
  options?: string[]
}

export type SourceProcedureSection = {
  procedure_code: string
  procedure_name: string
  blueprint_version_id: string
  procedure_id: string
  required: boolean
  fields: SourceFieldShell[]
}

export type SourcePackageVisit = {
  visit_code: string
  visit_name: string
  visit_type: string
  sequence_order: number
  source_sections: SourceProcedureSection[]
}

export type RuntimeSourcePackageJson = {
  study_id: string
  composition_snapshot_id: string
  visits: SourcePackageVisit[]
}

export type BlueprintVersionSnapshot = {
  id: string
  blueprintJson: Record<string, unknown>
  fieldSchema: FieldSchema
}

export type VisitProcedureLookup = {
  runtimeVisitProcedureId: string
  visitId: string
  studyProcedureBlueprintId: string
}

export type RuntimeSourcePackageRow = {
  id: string
  organizationId: string
  studyId: string
  compositionSnapshotId: string
  packageStatus: PackageStatus
  packageName: string
  packageVersion: number
  packageJson: RuntimeSourcePackageJson
  packageHash: string
  generatedBy: string
  generatedAt: string
  reviewedBy: string | null
  reviewedAt: string | null
  approvedBy: string | null
  approvedAt: string | null
  metadata: Record<string, unknown>
  createdAt: string
  updatedAt: string
}

export type RuntimeSourceVisitShellRow = {
  id: string
  organizationId: string
  studyId: string
  sourcePackageId: string
  runtimeVisitId: string
  visitCode: string
  visitName: string
  visitType: string
  sequenceOrder: number
  sourceShellJson: Record<string, unknown>
  status: ShellStatus
  metadata: Record<string, unknown>
  createdAt: string
  updatedAt: string
}

export type RuntimeSourceProcedureShellRow = {
  id: string
  organizationId: string
  studyId: string
  sourcePackageId: string
  visitShellId: string
  runtimeVisitProcedureId: string
  procedureId: string
  blueprintVersionId: string
  procedureCode: string
  procedureName: string
  procedureOrder: number
  required: boolean
  sourceShellJson: Record<string, unknown>
  status: ShellStatus
  metadata: Record<string, unknown>
  createdAt: string
  updatedAt: string
}

export type LoadedRuntimeSourcePackage = {
  package: RuntimeSourcePackageRow
  visitShells: RuntimeSourceVisitShellRow[]
  procedureShells: RuntimeSourceProcedureShellRow[]
}

export type CreateRuntimeSourcePackageInput = {
  organization_id: string
  study_id: string
  composition_snapshot_id: string
  package_name: string
}

export function mapRuntimeSourcePackageRow(row: Record<string, unknown>): RuntimeSourcePackageRow {
  return {
    id: String(row.id),
    organizationId: String(row.organization_id),
    studyId: String(row.study_id),
    compositionSnapshotId: String(row.composition_snapshot_id),
    packageStatus: row.package_status as PackageStatus,
    packageName: String(row.package_name),
    packageVersion: Number(row.package_version),
    packageJson: row.package_json as RuntimeSourcePackageJson,
    packageHash: String(row.package_hash),
    generatedBy: String(row.generated_by),
    generatedAt: String(row.generated_at),
    reviewedBy: row.reviewed_by ? String(row.reviewed_by) : null,
    reviewedAt: row.reviewed_at ? String(row.reviewed_at) : null,
    approvedBy: row.approved_by ? String(row.approved_by) : null,
    approvedAt: row.approved_at ? String(row.approved_at) : null,
    metadata: (row.metadata ?? {}) as Record<string, unknown>,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  }
}

export function mapVisitShellRow(row: Record<string, unknown>): RuntimeSourceVisitShellRow {
  return {
    id: String(row.id),
    organizationId: String(row.organization_id),
    studyId: String(row.study_id),
    sourcePackageId: String(row.source_package_id),
    runtimeVisitId: String(row.runtime_visit_id),
    visitCode: String(row.visit_code),
    visitName: String(row.visit_name),
    visitType: String(row.visit_type),
    sequenceOrder: Number(row.sequence_order),
    sourceShellJson: (row.source_shell_json ?? {}) as Record<string, unknown>,
    status: row.status as ShellStatus,
    metadata: (row.metadata ?? {}) as Record<string, unknown>,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  }
}

export function mapProcedureShellRow(row: Record<string, unknown>): RuntimeSourceProcedureShellRow {
  return {
    id: String(row.id),
    organizationId: String(row.organization_id),
    studyId: String(row.study_id),
    sourcePackageId: String(row.source_package_id),
    visitShellId: String(row.visit_shell_id),
    runtimeVisitProcedureId: String(row.runtime_visit_procedure_id),
    procedureId: String(row.procedure_id),
    blueprintVersionId: String(row.blueprint_version_id),
    procedureCode: String(row.procedure_code),
    procedureName: String(row.procedure_name),
    procedureOrder: Number(row.procedure_order),
    required: Boolean(row.required),
    sourceShellJson: (row.source_shell_json ?? {}) as Record<string, unknown>,
    status: row.status as ShellStatus,
    metadata: (row.metadata ?? {}) as Record<string, unknown>,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  }
}

export type BuildSourcePackageResult = {
  packageJson: RuntimeSourcePackageJson
  visitShells: Array<{
    runtimeVisitId: string
    visitCode: string
    visitName: string
    visitType: string
    sequenceOrder: number
    sourceShellJson: Record<string, unknown>
    procedures: Array<{
      runtimeVisitProcedureId: string
      procedureId: string
      blueprintVersionId: string
      procedureCode: string
      procedureName: string
      procedureOrder: number
      required: boolean
      sourceShellJson: Record<string, unknown>
    }>
  }>
}

export type CompositionSnapshotForPackage = {
  id: string
  organizationId: string
  studyId: string
  graphJson: StudyRuntimeGraphJson
  graphHash: string
}
