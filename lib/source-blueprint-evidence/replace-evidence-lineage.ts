import type { SupabaseClient } from '@supabase/supabase-js'
import type { LineageMappingInput } from './source-lineage-types'

/**
 * Replaces lineage rows for evidence. Does not mutate blueprint content.
 */
export async function replaceEvidenceLineage(args: {
  supabase: SupabaseClient
  organizationId: string
  studyId: string
  evidenceId: string
  blueprintVersionId: string
  mappings: LineageMappingInput[]
  createdBy: string
}): Promise<void> {
  const { error: deleteError } = await args.supabase
    .from('source_blueprint_evidence_lineage')
    .delete()
    .eq('organization_id', args.organizationId)
    .eq('study_id', args.studyId)
    .eq('evidence_id', args.evidenceId)

  if (deleteError) throw new Error(deleteError.message)
  if (args.mappings.length === 0) return

  const rows = args.mappings.map((mapping) => ({
    organization_id: args.organizationId,
    study_id: args.studyId,
    evidence_id: args.evidenceId,
    blueprint_version_id: args.blueprintVersionId,
    element_type: mapping.elementType,
    element_key: mapping.elementKey,
    element_label: mapping.elementLabel ?? null,
    trace_origin: mapping.traceOrigin,
    coordinator_notes: mapping.coordinatorNotes ?? null,
    created_by: args.createdBy,
  }))

  const { error: insertError } = await args.supabase
    .from('source_blueprint_evidence_lineage')
    .insert(rows)

  if (insertError) throw new Error(insertError.message)
}
