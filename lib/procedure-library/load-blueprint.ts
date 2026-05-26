import type { SupabaseClient } from '@supabase/supabase-js'
import {
  mapBlueprintVersionRow,
  mapProcedureRow,
  type ProcedureBlueprintVersionRow,
  type ProcedureLibraryRow,
} from './procedure-types'

export type LoadedProcedureBlueprint = {
  procedure: ProcedureLibraryRow
  versions: ProcedureBlueprintVersionRow[]
  activeVersion: ProcedureBlueprintVersionRow | null
}

export async function loadProcedureBlueprint(
  supabase: SupabaseClient,
  procedureId: string,
): Promise<LoadedProcedureBlueprint | null> {
  const { data: procedure, error: procedureError } = await supabase
    .from('procedure_library')
    .select('*')
    .eq('id', procedureId)
    .maybeSingle()

  if (procedureError) throw new Error(procedureError.message)
  if (!procedure) return null

  const { data: versions, error: versionsError } = await supabase
    .from('procedure_blueprint_versions')
    .select('*')
    .eq('procedure_id', procedureId)
    .order('version_number', { ascending: false })

  if (versionsError) throw new Error(versionsError.message)

  const mappedProcedure = mapProcedureRow(procedure as Record<string, unknown>)
  const mappedVersions = (versions ?? []).map((row) =>
    mapBlueprintVersionRow(row as Record<string, unknown>),
  )
  const activeVersion =
    mappedVersions.find((version) => version.id === mappedProcedure.activeVersionId) ?? null

  return {
    procedure: mappedProcedure,
    versions: mappedVersions,
    activeVersion,
  }
}
