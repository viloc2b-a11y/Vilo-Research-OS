import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Read-only validation for evidence → blueprint association.
 * Confirms the procedure library entry and blueprint version exist and match.
 * Does not read or write blueprint content fields; does not publish or draft blueprints.
 */
export async function validateEvidenceBlueprintMappingTarget(
  supabase: SupabaseClient,
  mappedProcedureLibraryId: string,
  mappedBlueprintVersionId: string,
): Promise<void> {
  const { data: blueprint, error } = await supabase
    .from('procedure_blueprint_versions')
    .select('id, procedure_library_id')
    .eq('id', mappedBlueprintVersionId)
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (!blueprint) throw new Error('Blueprint version not found.')
  if (String(blueprint.procedure_library_id) !== mappedProcedureLibraryId) {
    throw new Error('Blueprint version does not belong to the selected procedure library entry.')
  }
}
