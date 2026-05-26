import type { SupabaseClient } from '@supabase/supabase-js'
import { computeVisitRuntimeStateHash } from './visit-runtime-state-hash'
import {
  mapVisitRuntimeEventRow,
  type VisitRuntimeEventRow,
  type VisitRuntimeEventType,
  type VisitRuntimeStateSnapshot,
} from './visit-runtime-types'

export type AppendVisitRuntimeEventArgs = {
  supabase: SupabaseClient
  organizationId: string
  studyId: string
  subjectId: string
  visitInstanceId: string
  procedureInstanceId?: string | null
  eventType: VisitRuntimeEventType
  actorId?: string | null
  eventPayload?: Record<string, unknown>
  stateSnapshot: VisitRuntimeStateSnapshot
  metadata?: Record<string, unknown>
}

export async function appendVisitRuntimeEvent(
  args: AppendVisitRuntimeEventArgs,
): Promise<VisitRuntimeEventRow> {
  const stateHash = computeVisitRuntimeStateHash(args.stateSnapshot)
  const eventTimestamp = new Date().toISOString()

  const { data, error } = await args.supabase
    .from('visit_runtime_events')
    .insert({
      organization_id: args.organizationId,
      study_id: args.studyId,
      subject_id: args.subjectId,
      visit_instance_id: args.visitInstanceId,
      procedure_instance_id: args.procedureInstanceId ?? null,
      event_type: args.eventType,
      actor_id: args.actorId ?? null,
      event_timestamp: eventTimestamp,
      event_payload: args.eventPayload ?? {},
      state_hash: stateHash,
      metadata: args.metadata ?? {},
    })
    .select('*')
    .single()

  if (error || !data) {
    throw new Error(`Failed to append visit runtime event: ${error?.message ?? 'Unknown error'}`)
  }

  return mapVisitRuntimeEventRow(data as Record<string, unknown>)
}

export function buildStateSnapshot(args: {
  visitInstanceId: string
  visitStatus: VisitRuntimeStateSnapshot['visit_status']
  progressPercent: number
  procedures: Array<{
    id: string
    procedureStatus: VisitRuntimeStateSnapshot['procedures'][number]['procedure_status']
    fieldValues: Record<string, unknown>
  }>
}): VisitRuntimeStateSnapshot {
  return {
    visit_instance_id: args.visitInstanceId,
    visit_status: args.visitStatus,
    progress_percent: args.progressPercent,
    procedures: args.procedures.map((procedure) => ({
      procedure_instance_id: procedure.id,
      procedure_status: procedure.procedureStatus,
      field_values: procedure.fieldValues,
    })),
  }
}
