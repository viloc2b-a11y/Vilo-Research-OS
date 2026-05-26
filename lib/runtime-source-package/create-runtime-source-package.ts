import type { SupabaseClient } from '@supabase/supabase-js'
import type { FieldSchema } from '@/lib/procedure-library/procedure-types'
import { buildSourcePackageFromGraph } from './build-source-package-from-graph'
import { computeSourcePackageHash } from './source-package-hash'
import { loadCompositionSnapshot } from './load-composition-snapshot'
import {
  mapRuntimeSourcePackageRow,
  type BlueprintVersionSnapshot,
  type CreateRuntimeSourcePackageInput,
  type RuntimeSourcePackageRow,
  type VisitProcedureLookup,
} from './source-package-types'

export type CreateRuntimeSourcePackageArgs = {
  supabase: SupabaseClient
  input: CreateRuntimeSourcePackageInput
  generatedBy: string
}

export type CreateRuntimeSourcePackageResult = {
  package: RuntimeSourcePackageRow
  packageHash: string
  visitShellCount: number
  procedureShellCount: number
}

async function loadBlueprintVersions(
  supabase: SupabaseClient,
  versionIds: string[],
): Promise<Map<string, BlueprintVersionSnapshot>> {
  if (versionIds.length === 0) return new Map()

  const { data, error } = await supabase
    .from('procedure_blueprint_versions')
    .select('id, blueprint_json, field_schema')
    .in('id', versionIds)

  if (error) throw new Error(error.message)

  const map = new Map<string, BlueprintVersionSnapshot>()
  for (const row of data ?? []) {
    map.set(String(row.id), {
      id: String(row.id),
      blueprintJson: row.blueprint_json as Record<string, unknown>,
      fieldSchema: row.field_schema as FieldSchema,
    })
  }
  return map
}

async function loadVisitProcedureLookups(
  supabase: SupabaseClient,
  organizationId: string,
  studyId: string,
): Promise<VisitProcedureLookup[]> {
  const { data, error } = await supabase
    .from('study_runtime_visit_procedures')
    .select('id, visit_id, study_procedure_blueprint_id')
    .eq('organization_id', organizationId)
    .eq('study_id', studyId)

  if (error) throw new Error(error.message)

  return (data ?? []).map((row) => ({
    runtimeVisitProcedureId: String(row.id),
    visitId: String(row.visit_id),
    studyProcedureBlueprintId: String(row.study_procedure_blueprint_id),
  }))
}

async function nextPackageVersion(
  supabase: SupabaseClient,
  studyId: string,
): Promise<number> {
  const { data, error } = await supabase
    .from('runtime_source_packages')
    .select('package_version')
    .eq('study_id', studyId)
    .order('package_version', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) throw new Error(error.message)
  return data ? Number(data.package_version) + 1 : 1
}

export async function createRuntimeSourcePackage(
  args: CreateRuntimeSourcePackageArgs,
): Promise<CreateRuntimeSourcePackageResult> {
  const packageName = args.input.package_name.trim()
  if (!packageName) throw new Error('package_name is required.')

  const snapshot = await loadCompositionSnapshot(
    args.supabase,
    args.input.organization_id,
    args.input.study_id,
    args.input.composition_snapshot_id,
  )

  const versionIds = [
    ...new Set(
      snapshot.graphJson.visits.flatMap((visit) =>
        visit.procedures.map((procedure) => procedure.blueprint_version_id),
      ),
    ),
  ]

  const [blueprintVersions, visitProcedureLookups, packageVersion] = await Promise.all([
    loadBlueprintVersions(args.supabase, versionIds),
    loadVisitProcedureLookups(args.supabase, args.input.organization_id, args.input.study_id),
    nextPackageVersion(args.supabase, args.input.study_id),
  ])

  const built = buildSourcePackageFromGraph({
    graph: snapshot.graphJson,
    compositionSnapshotId: snapshot.id,
    blueprintVersions,
    visitProcedureLookups,
  })

  const packageHash = computeSourcePackageHash(built.packageJson)
  const generatedAt = new Date().toISOString()

  const { data: packageRow, error: packageError } = await args.supabase
    .from('runtime_source_packages')
    .insert({
      organization_id: args.input.organization_id,
      study_id: args.input.study_id,
      composition_snapshot_id: args.input.composition_snapshot_id,
      package_status: 'draft',
      package_name: packageName,
      package_version: packageVersion,
      package_json: built.packageJson,
      package_hash: packageHash,
      generated_by: args.generatedBy,
      generated_at: generatedAt,
      metadata: {},
    })
    .select('*')
    .single()

  if (packageError || !packageRow) {
    throw new Error(`Failed to create source package: ${packageError?.message ?? 'Unknown error'}`)
  }

  const sourcePackageId = String(packageRow.id)
  let procedureShellCount = 0

  for (const visitShell of built.visitShells) {
    const { data: visitRow, error: visitError } = await args.supabase
      .from('runtime_source_visit_shells')
      .insert({
        organization_id: args.input.organization_id,
        study_id: args.input.study_id,
        source_package_id: sourcePackageId,
        runtime_visit_id: visitShell.runtimeVisitId,
        visit_code: visitShell.visitCode,
        visit_name: visitShell.visitName,
        visit_type: visitShell.visitType,
        sequence_order: visitShell.sequenceOrder,
        source_shell_json: visitShell.sourceShellJson,
        status: 'draft',
        metadata: {},
      })
      .select('*')
      .single()

    if (visitError || !visitRow) {
      throw new Error(`Failed to create visit shell: ${visitError?.message ?? 'Unknown error'}`)
    }

    const visitShellId = String(visitRow.id)

    for (const procedureShell of visitShell.procedures) {
      const { error: procedureError } = await args.supabase
        .from('runtime_source_procedure_shells')
        .insert({
          organization_id: args.input.organization_id,
          study_id: args.input.study_id,
          source_package_id: sourcePackageId,
          visit_shell_id: visitShellId,
          runtime_visit_procedure_id: procedureShell.runtimeVisitProcedureId,
          procedure_id: procedureShell.procedureId,
          blueprint_version_id: procedureShell.blueprintVersionId,
          procedure_code: procedureShell.procedureCode,
          procedure_name: procedureShell.procedureName,
          procedure_order: procedureShell.procedureOrder,
          required: procedureShell.required,
          source_shell_json: procedureShell.sourceShellJson,
          status: 'draft',
          metadata: {},
        })

      if (procedureError) {
        throw new Error(`Failed to create procedure shell: ${procedureError.message}`)
      }
      procedureShellCount += 1
    }
  }

  return {
    package: mapRuntimeSourcePackageRow(packageRow as Record<string, unknown>),
    packageHash,
    visitShellCount: built.visitShells.length,
    procedureShellCount,
  }
}
