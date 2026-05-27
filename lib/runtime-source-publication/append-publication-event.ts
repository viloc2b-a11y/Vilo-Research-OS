import type { SupabaseClient } from '@supabase/supabase-js'
import { computePublicationStateHash } from './publication-state-hash'
import {
  mapPublicationEventRow,
  type PublicationEventType,
  type RuntimeSourcePublicationEventRow,
} from './runtime-source-publication-types'

export async function appendPublicationEvent(args: {
  supabase: SupabaseClient
  organizationId: string
  studyId: string
  sourcePackageId: string
  publicationId?: string | null
  eventType: PublicationEventType
  actorId?: string | null
  eventPayload?: Record<string, unknown>
  stateSnapshot: Record<string, unknown>
  metadata?: Record<string, unknown>
}): Promise<RuntimeSourcePublicationEventRow> {
  const stateHash = computePublicationStateHash(args.stateSnapshot)

  const { data, error } = await args.supabase
    .from('runtime_source_publication_events')
    .insert({
      organization_id: args.organizationId,
      study_id: args.studyId,
      source_package_id: args.sourcePackageId,
      publication_id: args.publicationId ?? null,
      event_type: args.eventType,
      actor_id: args.actorId ?? null,
      event_timestamp: new Date().toISOString(),
      event_payload: args.eventPayload ?? {},
      state_hash: stateHash,
      metadata: args.metadata ?? {},
    })
    .select('*')
    .single()

  if (error || !data) {
    throw new Error(`Failed to append publication event: ${error?.message ?? 'Unknown error'}`)
  }

  return mapPublicationEventRow(data as Record<string, unknown>)
}

