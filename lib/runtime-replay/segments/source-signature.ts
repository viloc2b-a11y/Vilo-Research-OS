import { SOURCE_SIGNATURE_EVENT_TYPES } from '@/lib/runtime-replay/constants'
import {
  chronologyToReplayEntries,
  loadOperationalChronologyForReplay,
} from '@/lib/runtime-replay/load-chronology'
import type { ReplayTimelineEntry, ReplayTimelineSegment } from '@/lib/runtime-replay/types'
import type { SupabaseClient } from '@supabase/supabase-js'

export async function buildSourceSignatureSegment(input: {
  supabase: SupabaseClient
  organizationId: string
  studyId: string
  visitId: string
}): Promise<ReplayTimelineSegment> {
  const rows = await loadOperationalChronologyForReplay({
    supabase: input.supabase,
    organizationId: input.organizationId,
    studyId: input.studyId,
    visitIds: [input.visitId],
    eventTypes: [...SOURCE_SIGNATURE_EVENT_TYPES],
    limit: 300,
  })

  const entries: ReplayTimelineEntry[] = chronologyToReplayEntries(
    rows,
    'source_signature',
  )

  const { data: sets } = await input.supabase
    .from('source_response_sets')
    .select('id, procedure_execution_id, status, opened_at, submitted_at')
    .eq('visit_id', input.visitId)
    .eq('organization_id', input.organizationId)
    .neq('status', 'archived')
    .order('opened_at', { ascending: true })

  for (const set of sets ?? []) {
    entries.push({
      id: `execution:source-set:${set.id as string}`,
      kind: 'execution_fact',
      segmentType: 'source_signature',
      occurredAt: (set.submitted_at as string) ?? (set.opened_at as string) ?? new Date().toISOString(),
      label: 'Source response set',
      detail: `Capture status: ${set.status as string}.`,
      visitId: input.visitId,
      procedureExecutionId: (set.procedure_execution_id as string | null) ?? null,
      sourceResponseSetId: set.id as string,
    })
  }

  return {
    segmentType: 'source_signature',
    label: 'Source & signature chronology',
    entries: entries.sort((a, b) => a.occurredAt.localeCompare(b.occurredAt)),
  }
}
