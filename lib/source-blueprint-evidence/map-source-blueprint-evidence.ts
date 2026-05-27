import type { SupabaseClient } from '@supabase/supabase-js'
import { appendEvidenceReviewEvent } from './append-evidence-review-event'
import { EvidenceReviewStateError } from './accept-source-blueprint-evidence'
import { loadSourceBlueprintEvidenceById } from './list-source-blueprint-evidence'
import { replaceEvidenceLineage } from './replace-evidence-lineage'
import { validateLineageElementsInBlueprint } from './validate-lineage-element-in-blueprint'
import { validateEvidenceBlueprintMappingTarget } from './validate-evidence-blueprint-mapping-target'
import type { LineageMappingInput } from './source-lineage-types'
import {
  EVIDENCE_REVIEW_EVENT_TYPE,
  EVIDENCE_STATUS,
  mapSourceBlueprintEvidenceRow,
  type SourceBlueprintEvidenceRow,
} from './source-blueprint-evidence-types'

/**
 * Coordinator evidence mapping only.
 *
 * Writes: `source_blueprint_evidence`, `source_blueprint_evidence_lineage`, review event.
 * Does NOT mutate `procedure_blueprint_versions` content, runtime graph, or published source.
 */
export async function mapSourceBlueprintEvidence(args: {
  supabase: SupabaseClient
  organizationId: string
  studyId: string
  evidenceId: string
  actorId: string
  mappedProcedureLibraryId: string
  mappedBlueprintVersionId: string
  mappingNotes?: string | null
  lineage?: LineageMappingInput[]
}): Promise<SourceBlueprintEvidenceRow> {
  const current = await loadSourceBlueprintEvidenceById(
    args.supabase,
    args.organizationId,
    args.studyId,
    args.evidenceId,
  )
  if (!current) throw new Error('Evidence not found.')

  if (current.evidenceStatus === EVIDENCE_STATUS.REJECTED) {
    throw new EvidenceReviewStateError('Rejected evidence cannot be mapped.')
  }
  if (
    current.evidenceStatus === EVIDENCE_STATUS.ARCHIVED ||
    current.evidenceStatus === EVIDENCE_STATUS.SUPERSEDED_CANDIDATE ||
    current.evidenceStatus === EVIDENCE_STATUS.SUPERSEDED
  ) {
    throw new EvidenceReviewStateError('Archived or superseded evidence cannot be mapped.')
  }
  if (current.evidenceStatus !== EVIDENCE_STATUS.ACCEPTED && current.evidenceStatus !== EVIDENCE_STATUS.MAPPED) {
    throw new EvidenceReviewStateError(
      'Evidence must be accepted by a coordinator before blueprint mapping.',
    )
  }

  await validateEvidenceBlueprintMappingTarget(
    args.supabase,
    args.mappedProcedureLibraryId,
    args.mappedBlueprintVersionId,
  )

  const lineage = args.lineage ?? []
  await validateLineageElementsInBlueprint(
    args.supabase,
    args.mappedBlueprintVersionId,
    lineage,
  )

  const reviewedAt = new Date().toISOString()
  const { data, error } = await args.supabase
    .from('source_blueprint_evidence')
    .update({
      evidence_status: EVIDENCE_STATUS.MAPPED,
      mapped_procedure_library_id: args.mappedProcedureLibraryId,
      mapped_blueprint_version_id: args.mappedBlueprintVersionId,
      mapping_notes: args.mappingNotes ?? current.mappingNotes,
      reviewed_by: args.actorId,
      reviewed_at: reviewedAt,
      updated_at: reviewedAt,
    })
    .eq('id', current.id)
    .eq('organization_id', args.organizationId)
    .eq('study_id', args.studyId)
    .select('*')
    .single()

  if (error || !data) throw new Error(error?.message ?? 'Failed to map evidence')

  await replaceEvidenceLineage({
    supabase: args.supabase,
    organizationId: args.organizationId,
    studyId: args.studyId,
    evidenceId: current.id,
    blueprintVersionId: args.mappedBlueprintVersionId,
    mappings: lineage,
    createdBy: args.actorId,
  })

  const mapped = mapSourceBlueprintEvidenceRow(data as Record<string, unknown>)
  await appendEvidenceReviewEvent({
    supabase: args.supabase,
    organizationId: args.organizationId,
    studyId: args.studyId,
    evidenceId: mapped.id,
    eventType: EVIDENCE_REVIEW_EVENT_TYPE.MAPPED,
    actorId: args.actorId,
    eventPayload: {
      mapped_procedure_library_id: args.mappedProcedureLibraryId,
      mapped_blueprint_version_id: args.mappedBlueprintVersionId,
      mapping_notes: args.mappingNotes ?? null,
      lineage_count: lineage.length,
      mapping_only: true,
      blueprint_content_mutated: false,
      runtime_mutated: false,
    },
  })

  return mapped
}
