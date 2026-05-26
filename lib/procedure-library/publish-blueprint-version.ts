import type { SupabaseClient } from '@supabase/supabase-js'
import { mapBlueprintVersionRow, mapProcedureRow, type ProcedureBlueprintVersionRow } from './procedure-types'

export type PublishBlueprintVersionArgs = {
  supabase: SupabaseClient
  procedureId: string
  versionId: string
}

export type PublishBlueprintVersionResult = {
  procedure: ReturnType<typeof mapProcedureRow>
  version: ProcedureBlueprintVersionRow
  previousActiveVersionId: string | null
}

export async function publishBlueprintVersion(
  args: PublishBlueprintVersionArgs,
): Promise<PublishBlueprintVersionResult> {
  const { data: versionRow, error: versionError } = await args.supabase
    .from('procedure_blueprint_versions')
    .select('*')
    .eq('id', args.versionId)
    .eq('procedure_id', args.procedureId)
    .maybeSingle()

  if (versionError) throw new Error(versionError.message)
  if (!versionRow) throw new Error('Blueprint version not found for this procedure.')
  if (versionRow.blueprint_status === 'published') {
    throw new Error('Blueprint version is already published.')
  }
  if (versionRow.blueprint_status === 'archived') {
    throw new Error('Archived blueprint versions cannot be published.')
  }

  const { data: procedureRow, error: procedureError } = await args.supabase
    .from('procedure_library')
    .select('*')
    .eq('id', args.procedureId)
    .maybeSingle()

  if (procedureError) throw new Error(procedureError.message)
  if (!procedureRow) throw new Error('Procedure not found.')

  const previousActiveVersionId = procedureRow.active_version_id
    ? String(procedureRow.active_version_id)
    : null

  if (previousActiveVersionId) {
    const { error: archiveError } = await args.supabase
      .from('procedure_blueprint_versions')
      .update({ blueprint_status: 'archived' })
      .eq('id', previousActiveVersionId)
      .eq('procedure_id', args.procedureId)
      .eq('blueprint_status', 'published')

    if (archiveError) throw new Error(`Failed to archive previous version: ${archiveError.message}`)
  }

  const { data: publishedVersion, error: publishError } = await args.supabase
    .from('procedure_blueprint_versions')
    .update({ blueprint_status: 'published' })
    .eq('id', args.versionId)
    .eq('procedure_id', args.procedureId)
    .select('*')
    .single()

  if (publishError || !publishedVersion) {
    throw new Error(`Failed to publish blueprint version: ${publishError?.message ?? 'Unknown error'}`)
  }

  const updatedAt = new Date().toISOString()
  const { data: updatedProcedure, error: updateProcedureError } = await args.supabase
    .from('procedure_library')
    .update({
      active_version_id: args.versionId,
      updated_at: updatedAt,
    })
    .eq('id', args.procedureId)
    .select('*')
    .single()

  if (updateProcedureError || !updatedProcedure) {
    throw new Error(
      `Failed to update active version: ${updateProcedureError?.message ?? 'Unknown error'}`,
    )
  }

  return {
    procedure: mapProcedureRow(updatedProcedure as Record<string, unknown>),
    version: mapBlueprintVersionRow(publishedVersion as Record<string, unknown>),
    previousActiveVersionId,
  }
}
