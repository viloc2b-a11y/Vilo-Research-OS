import type { SupabaseClient } from '@supabase/supabase-js'
import {
  mapBlueprintVersionRow,
  type CreateBlueprintVersionInput,
  type ProcedureBlueprintVersionRow,
} from './procedure-types'

export type CreateBlueprintVersionArgs = {
  supabase: SupabaseClient
  procedureId: string
  input: CreateBlueprintVersionInput
  createdBy: string
}

export async function createBlueprintVersion(
  args: CreateBlueprintVersionArgs,
): Promise<ProcedureBlueprintVersionRow> {
  if (!args.input.blueprint_json?.sections?.length) {
    throw new Error('blueprint_json must include at least one section.')
  }
  if (!args.input.field_schema?.fields?.length) {
    throw new Error('field_schema must include at least one field.')
  }

  const { data: latest, error: latestError } = await args.supabase
    .from('procedure_blueprint_versions')
    .select('version_number')
    .eq('procedure_id', args.procedureId)
    .order('version_number', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (latestError) throw new Error(latestError.message)

  const versionNumber = latest ? Number(latest.version_number) + 1 : 1

  const { data, error } = await args.supabase
    .from('procedure_blueprint_versions')
    .insert({
      procedure_id: args.procedureId,
      version_number: versionNumber,
      blueprint_status: 'draft',
      blueprint_json: args.input.blueprint_json,
      field_schema: args.input.field_schema,
      dependency_schema: args.input.dependency_schema ?? {},
      operational_rules: args.input.operational_rules ?? {},
      source_render_schema: args.input.source_render_schema ?? {},
      created_by: args.createdBy,
    })
    .select('*')
    .single()

  if (error || !data) {
    throw new Error(`Failed to create blueprint version: ${error?.message ?? 'Unknown error'}`)
  }

  return mapBlueprintVersionRow(data as Record<string, unknown>)
}
