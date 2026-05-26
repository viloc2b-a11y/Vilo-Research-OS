import type { SupabaseClient } from '@supabase/supabase-js'
import {
  mapStudyBlueprintRow,
  type AssignBlueprintToStudyInput,
  type StudyProcedureBlueprintRow,
} from './procedure-types'

export type AssignBlueprintToStudyArgs = {
  supabase: SupabaseClient
  input: AssignBlueprintToStudyInput
  createdBy: string
}

export async function assignBlueprintToStudy(
  args: AssignBlueprintToStudyArgs,
): Promise<StudyProcedureBlueprintRow> {
  const { data: study, error: studyError } = await args.supabase
    .from('studies')
    .select('id, organization_id')
    .eq('id', args.input.study_id)
    .eq('organization_id', args.input.organization_id)
    .maybeSingle()

  if (studyError) throw new Error(studyError.message)
  if (!study) throw new Error('Study not found in this organization.')

  const { data: version, error: versionError } = await args.supabase
    .from('procedure_blueprint_versions')
    .select('id, procedure_id, blueprint_status')
    .eq('id', args.input.blueprint_version_id)
    .maybeSingle()

  if (versionError) throw new Error(versionError.message)
  if (!version) throw new Error('Blueprint version not found.')
  if (version.procedure_id !== args.input.procedure_id) {
    throw new Error('Blueprint version does not belong to the specified procedure.')
  }
  if (version.blueprint_status !== 'published') {
    throw new Error('Only published blueprint versions can be assigned to studies.')
  }

  const { data, error } = await args.supabase
    .from('study_procedure_blueprints')
    .insert({
      organization_id: args.input.organization_id,
      study_id: args.input.study_id,
      procedure_id: args.input.procedure_id,
      blueprint_version_id: args.input.blueprint_version_id,
      visit_type: args.input.visit_type?.trim() || null,
      visit_code: args.input.visit_code?.trim() || null,
      required: args.input.required ?? true,
      optionality_rule: args.input.optionality_rule ?? {},
      scheduling_rules: args.input.scheduling_rules ?? {},
      operational_overrides: args.input.operational_overrides ?? {},
      created_by: args.createdBy,
    })
    .select('*')
    .single()

  if (error || !data) {
    throw new Error(`Failed to assign blueprint to study: ${error?.message ?? 'Unknown error'}`)
  }

  return mapStudyBlueprintRow(data as Record<string, unknown>)
}
