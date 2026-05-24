import { SAFETY_EVENT_TYPES } from '@/lib/runtime-replay/constants'
import {
  chronologyToReplayEntries,
  loadOperationalChronologyForReplay,
} from '@/lib/runtime-replay/load-chronology'
import type { ReplayTimelineEntry, ReplayTimelineSegment } from '@/lib/runtime-replay/types'
import type { SupabaseClient } from '@supabase/supabase-js'

export async function buildSafetyEscalationSegment(input: {
  supabase: SupabaseClient
  organizationId: string
  studyId: string
  studySubjectId: string
  visitId?: string | null
}): Promise<ReplayTimelineSegment> {
  const visitIds = input.visitId ? [input.visitId] : undefined

  const rows = await loadOperationalChronologyForReplay({
    supabase: input.supabase,
    organizationId: input.organizationId,
    studyId: input.studyId,
    visitIds,
    eventTypes: [...SAFETY_EVENT_TYPES],
    limit: 200,
  })

  const entries: ReplayTimelineEntry[] = chronologyToReplayEntries(
    rows,
    'safety_escalation',
  )

  let aeQuery = input.supabase
    .from('subject_adverse_events')
    .select(
      'ae_id, event_term, lifecycle_status, seriousness, visit_id, created_at, updated_at',
    )
    .eq('study_subject_id', input.studySubjectId)
    .eq('organization_id', input.organizationId)
    .order('created_at', { ascending: true })

  if (input.visitId) {
    aeQuery = aeQuery.or(`visit_id.is.null,visit_id.eq.${input.visitId}`)
  }

  const { data: aes } = await aeQuery

  for (const ae of aes ?? []) {
    entries.push({
      id: `safety:ae:${ae.ae_id as string}`,
      kind: 'safety_registry',
      segmentType: 'safety_escalation',
      occurredAt: (ae.updated_at as string) ?? (ae.created_at as string),
      label: (ae.event_term as string) || 'Adverse event',
      detail: `Registry status: ${ae.lifecycle_status as string}${ae.seriousness ? ' (serious)' : ''}.`,
      visitId: (ae.visit_id as string | null) ?? null,
    })
  }

  return {
    segmentType: 'safety_escalation',
    label: 'Safety escalation chain',
    entries: entries.sort((a, b) => a.occurredAt.localeCompare(b.occurredAt)),
  }
}
