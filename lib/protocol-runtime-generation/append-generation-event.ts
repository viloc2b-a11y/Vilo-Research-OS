import type { SupabaseClient } from '@supabase/supabase-js'
import { computeGenerationStateHash } from './generation-state-hash'
import {
  mapGenerationEventRow,
  type GenerationEventType,
  type ProtocolRuntimeGenerationEventRow,
} from './protocol-runtime-generation-types'

export async function appendGenerationEvent(args: {
  supabase: SupabaseClient
  organizationId: string
  generationRunId: string
  protocolVersionId: string
  eventType: GenerationEventType
  actorId?: string | null
  eventPayload?: Record<string, unknown>
  stateSnapshot: Record<string, unknown>
  metadata?: Record<string, unknown>
}): Promise<ProtocolRuntimeGenerationEventRow> {
  const stateHash = computeGenerationStateHash(args.stateSnapshot)

  const { data, error } = await args.supabase
    .from('protocol_runtime_generation_events')
    .insert({
      organization_id: args.organizationId,
      generation_run_id: args.generationRunId,
      protocol_version_id: args.protocolVersionId,
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
    throw new Error(`Failed to append generation event: ${error?.message ?? 'Unknown error'}`)
  }

  return mapGenerationEventRow(data as Record<string, unknown>)
}

