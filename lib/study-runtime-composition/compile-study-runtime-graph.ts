import type { SupabaseClient } from '@supabase/supabase-js'
import { computeStudyRuntimeGraphHash, normalizeStudyRuntimeGraph } from './graph-hash'
import { listRuntimeVisits } from './list-runtime-visits'
import type { StudyRuntimeGraphJson } from './runtime-composition-types'

export type CompileStudyRuntimeGraphArgs = {
  supabase: SupabaseClient
  organizationId: string
  studyId: string
}

export type CompileStudyRuntimeGraphResult = {
  graph: StudyRuntimeGraphJson
  graphHash: string
}

export async function compileStudyRuntimeGraph(
  args: CompileStudyRuntimeGraphArgs,
): Promise<CompileStudyRuntimeGraphResult> {
  const visits = await listRuntimeVisits(args.supabase, {
    organizationId: args.organizationId,
    studyId: args.studyId,
  })

  const graph: StudyRuntimeGraphJson = {
    study_id: args.studyId,
    organization_id: args.organizationId,
    visits: visits.map((visit) => ({
      visit_id: visit.id,
      visit_code: visit.visitCode,
      visit_name: visit.visitName,
      visit_type: visit.visitType,
      study_day: visit.studyDay,
      window: {
        before_days: visit.windowBeforeDays,
        after_days: visit.windowAfterDays,
      },
      sequence_order: visit.sequenceOrder,
      allowed_modes: visit.allowedModes,
      required: visit.required,
      procedures: visit.procedures.map((procedure) => ({
        procedure_id: procedure.procedureId,
        procedure_code: procedure.procedureCode ?? '',
        procedure_name: procedure.procedureName ?? '',
        blueprint_version_id: procedure.blueprintVersionId,
        study_procedure_blueprint_id: procedure.studyProcedureBlueprintId,
        procedure_order: procedure.procedureOrder,
        required: procedure.required,
        optionality_rule: procedure.optionalityRule,
        dependency_rule: procedure.dependencyRule,
        timing_rule: procedure.timingRule,
        operational_overrides: procedure.operationalOverrides,
      })),
    })),
  }

  const normalized = normalizeStudyRuntimeGraph(graph)
  const graphHash = computeStudyRuntimeGraphHash(normalized)

  return { graph: normalized, graphHash }
}
