import type { SupabaseClient } from '@supabase/supabase-js'
import type { SourceBlueprintEvidenceReviewEventRow } from './source-blueprint-evidence-types'
import type { EvidenceReviewEventType } from './source-blueprint-evidence-types'

export async function loadEvidenceReviewEvents(
  supabase: SupabaseClient,
  organizationId: string,
  studyId: string,
  evidenceId: string,
): Promise<SourceBlueprintEvidenceReviewEventRow[]> {
  const { data, error } = await supabase
    .from('source_blueprint_evidence_review_events')
    .select('*')
    .eq('organization_id', organizationId)
    .eq('study_id', studyId)
    .eq('evidence_id', evidenceId)
    .order('event_timestamp', { ascending: true })

  if (error) throw new Error(error.message)

  return (data ?? []).map((row) => ({
    id: String(row.id),
    organizationId: String(row.organization_id),
    studyId: String(row.study_id),
    evidenceId: String(row.evidence_id),
    eventType: row.event_type as EvidenceReviewEventType,
    actorId: row.actor_id ? String(row.actor_id) : null,
    eventTimestamp: String(row.event_timestamp),
    eventPayload: (row.event_payload as Record<string, unknown>) ?? {},
    metadata: (row.metadata as Record<string, unknown>) ?? {},
  }))
}
