import type { SupabaseClient } from '@supabase/supabase-js'
import {
  mapVisitProcedureRow,
  type AddProcedureToVisitInput,
  type StudyRuntimeVisitProcedureRow,
} from './runtime-composition-types'

export type AddProcedureToVisitArgs = {
  supabase: SupabaseClient
  input: AddProcedureToVisitInput
  createdBy: string
}

export async function addProcedureToVisit(
  args: AddProcedureToVisitArgs,
): Promise<StudyRuntimeVisitProcedureRow> {
  const { data: visit, error: visitError } = await args.supabase
    .from('study_runtime_visits')
    .select('id, study_id, organization_id')
    .eq('id', args.input.visit_id)
    .eq('study_id', args.input.study_id)
    .eq('organization_id', args.input.organization_id)
    .maybeSingle()

  if (visitError) throw new Error(visitError.message)
  if (!visit) throw new Error('Runtime visit not found.')

  const { data: assignment, error: assignmentError } = await args.supabase
    .from('study_procedure_blueprints')
    .select('id, procedure_id, blueprint_version_id, study_id, organization_id')
    .eq('id', args.input.study_procedure_blueprint_id)
    .eq('study_id', args.input.study_id)
    .eq('organization_id', args.input.organization_id)
    .maybeSingle()

  if (assignmentError) throw new Error(assignmentError.message)
  if (!assignment) throw new Error('Study procedure blueprint assignment not found.')

  const { data, error } = await args.supabase
    .from('study_runtime_visit_procedures')
    .insert({
      organization_id: args.input.organization_id,
      study_id: args.input.study_id,
      visit_id: args.input.visit_id,
      study_procedure_blueprint_id: assignment.id,
      procedure_id: assignment.procedure_id,
      blueprint_version_id: assignment.blueprint_version_id,
      procedure_order: args.input.procedure_order,
      required: args.input.required ?? true,
      optionality_rule: args.input.optionality_rule ?? {},
      dependency_rule: args.input.dependency_rule ?? {},
      timing_rule: args.input.timing_rule ?? {},
      operational_overrides: args.input.operational_overrides ?? {},
      created_by: args.createdBy,
    })
    .select('*')
    .single()

  if (error || !data) {
    throw new Error(`Failed to add procedure to visit: ${error?.message ?? 'Unknown error'}`)
  }

  return mapVisitProcedureRow(data as Record<string, unknown>)
}
