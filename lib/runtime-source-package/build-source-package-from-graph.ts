import type { FieldSchema } from '@/lib/procedure-library/procedure-types'
import type { StudyRuntimeGraphJson } from '@/lib/study-runtime-composition/runtime-composition-types'
import type {
  BlueprintVersionSnapshot,
  BuildSourcePackageResult,
  SourceFieldShell,
  SourceProcedureSection,
  VisitProcedureLookup,
} from './source-package-types'

function buildFieldShells(fieldSchema: FieldSchema): SourceFieldShell[] {
  return fieldSchema.fields.map((field) => ({
    field_id: field.field_id,
    label: field.label ?? field.field_id,
    type: field.type,
    required: Boolean(field.required),
    source_state: 'draft' as const,
    ...(field.options?.length ? { options: field.options } : {}),
  }))
}

export function buildSourcePackageFromGraph(args: {
  graph: StudyRuntimeGraphJson
  compositionSnapshotId: string
  blueprintVersions: Map<string, BlueprintVersionSnapshot>
  visitProcedureLookups: VisitProcedureLookup[]
}): BuildSourcePackageResult {
  const lookupByVisitAndBlueprint = new Map<string, VisitProcedureLookup>()
  for (const lookup of args.visitProcedureLookups) {
    lookupByVisitAndBlueprint.set(`${lookup.visitId}:${lookup.studyProcedureBlueprintId}`, lookup)
  }

  const visitShells: BuildSourcePackageResult['visitShells'] = []
  const packageVisits = [...args.graph.visits].sort(
    (a, b) => a.sequence_order - b.sequence_order || a.visit_code.localeCompare(b.visit_code),
  )

  for (const visit of packageVisits) {
    const sourceSections: SourceProcedureSection[] = []
    const procedureShells: BuildSourcePackageResult['visitShells'][number]['procedures'] = []

    const procedures = [...visit.procedures].sort(
      (a, b) => a.procedure_order - b.procedure_order || a.procedure_id.localeCompare(b.procedure_id),
    )

    for (const procedure of procedures) {
      const blueprint = args.blueprintVersions.get(procedure.blueprint_version_id)
      if (!blueprint) {
        throw new Error(`Blueprint version ${procedure.blueprint_version_id} not found for package build.`)
      }

      const fields = buildFieldShells(blueprint.fieldSchema)
      const procedureCode = procedure.procedure_code.toLowerCase()

      sourceSections.push({
        procedure_code: procedureCode,
        procedure_name: procedure.procedure_name,
        blueprint_version_id: procedure.blueprint_version_id,
        procedure_id: procedure.procedure_id,
        required: procedure.required,
        fields,
      })

      const lookup = lookupByVisitAndBlueprint.get(
        `${visit.visit_id}:${procedure.study_procedure_blueprint_id}`,
      )
      if (!lookup) {
        throw new Error(
          `Runtime visit procedure not found for visit ${visit.visit_id} and blueprint assignment ${procedure.study_procedure_blueprint_id}.`,
        )
      }

      procedureShells.push({
        runtimeVisitProcedureId: lookup.runtimeVisitProcedureId,
        procedureId: procedure.procedure_id,
        blueprintVersionId: procedure.blueprint_version_id,
        procedureCode: procedure.procedure_code,
        procedureName: procedure.procedure_name,
        procedureOrder: procedure.procedure_order,
        required: procedure.required,
        sourceShellJson: {
          blueprint_version_id: procedure.blueprint_version_id,
          sections: blueprint.blueprintJson,
          field_schema: blueprint.fieldSchema,
          dependency_rule: procedure.dependency_rule,
          timing_rule: procedure.timing_rule,
          operational_overrides: procedure.operational_overrides,
          fields,
        },
      })
    }

    visitShells.push({
      runtimeVisitId: visit.visit_id,
      visitCode: visit.visit_code,
      visitName: visit.visit_name,
      visitType: visit.visit_type,
      sequenceOrder: visit.sequence_order,
      sourceShellJson: {
        visit_code: visit.visit_code,
        visit_name: visit.visit_name,
        visit_type: visit.visit_type,
        study_day: visit.study_day,
        window: visit.window,
        allowed_modes: visit.allowed_modes,
        required: visit.required,
        source_sections: sourceSections,
      },
      procedures: procedureShells,
    })
  }

  return {
    packageJson: {
      study_id: args.graph.study_id,
      composition_snapshot_id: args.compositionSnapshotId,
      visits: visitShells.map((visitShell) => ({
        visit_code: visitShell.visitCode,
        visit_name: visitShell.visitName,
        visit_type: visitShell.visitType,
        sequence_order: visitShell.sequenceOrder,
        source_sections: visitShell.sourceShellJson.source_sections as SourceProcedureSection[],
      })),
    },
    visitShells,
  }
}
