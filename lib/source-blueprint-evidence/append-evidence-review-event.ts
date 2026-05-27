import type { SupabaseClient } from '@supabase/supabase-js'
import {
  type EvidenceReviewEventType,
  type SourceBlueprintEvidenceReviewEventRow,
} from './source-blueprint-evidence-types'

export async function appendEvidenceReviewEvent(args: {
  supabase: SupabaseClient
  organizationId: string
  studyId: string
  evidenceId: string
  eventType: EvidenceReviewEventType
  actorId?: string | null
  eventPayload?: Record<string, unknown>
  metadata?: Record<string, unknown>
}): Promise<SourceBlueprintEvidenceReviewEventRow> {
  const { data, error } = await args.supabase
    .from('source_blueprint_evidence_review_events')
    .insert({
      organization_id: args.organizationId,
      study_id: args.studyId,
      evidence_id: args.evidenceId,
      event_type: args.eventType,
      actor_id: args.actorId ?? null,
      event_timestamp: new Date().toISOString(),
      event_payload: args.eventPayload ?? {},
      metadata: args.metadata ?? {},
    })
    .select('*')
    .single()

  if (error || !data) {
    throw new Error(`Failed to append evidence review event: ${error?.message ?? 'Unknown'}`)
  }

  return {
    id: String(data.id),
    organizationId: String(data.organization_id),
    studyId: String(data.study_id),
    evidenceId: String(data.evidence_id),
    eventType: data.event_type as EvidenceReviewEventType,
    actorId: data.actor_id ? String(data.actor_id) : null,
    eventTimestamp: String(data.event_timestamp),
    eventPayload: (data.event_payload as Record<string, unknown>) ?? {},
    metadata: (data.metadata as Record<string, unknown>) ?? {},
  }
}
