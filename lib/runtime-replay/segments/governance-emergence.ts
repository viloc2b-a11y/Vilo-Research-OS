import type { ReplayTimelineEntry, ReplayTimelineSegment } from '@/lib/runtime-replay/types'
import type { SupabaseClient } from '@supabase/supabase-js'

export async function buildGovernanceEmergenceSegment(input: {
  supabase: SupabaseClient
  organizationId: string
  visitId?: string | null
  studySubjectId: string
}): Promise<ReplayTimelineSegment> {
  const entries: ReplayTimelineEntry[] = []

  if (input.visitId) {
    const { data: signals } = await input.supabase
      .from('governance_signals')
      .select(
        'id, signal_type, severity, status, label, detail, detected_at, derivation, workflow_action_id',
      )
      .eq('organization_id', input.organizationId)
      .eq('visit_id', input.visitId)
      .in('status', ['open', 'acknowledged'])
      .order('detected_at', { ascending: true })

    for (const s of signals ?? []) {
      entries.push({
        id: `governance:${s.id as string}`,
        kind: 'governance_signal',
        segmentType: 'governance_emergence',
        occurredAt: s.detected_at as string,
        label: s.label as string,
        detail: `${s.signal_type as string} (${s.severity as string}): ${s.detail as string}`,
        visitId: input.visitId,
        workflowActionId: (s.workflow_action_id as string | null) ?? null,
        payload: (s.derivation as Record<string, unknown>) ?? {},
      })
    }
  }

  const { data: subjectSignals } = await input.supabase
    .from('governance_signals')
    .select('id, signal_type, severity, label, detail, detected_at, visit_id')
    .eq('organization_id', input.organizationId)
    .eq('study_subject_id', input.studySubjectId)
    .eq('signal_type', 'safety_continuity_elevated')
    .eq('status', 'open')
    .limit(5)

  for (const s of subjectSignals ?? []) {
    if (input.visitId && s.visit_id !== input.visitId) continue
    entries.push({
      id: `governance:subject:${s.id as string}`,
      kind: 'governance_signal',
      segmentType: 'governance_emergence',
      occurredAt: s.detected_at as string,
      label: s.label as string,
      detail: s.detail as string,
      visitId: (s.visit_id as string | null) ?? null,
    })
  }

  return {
    segmentType: 'governance_emergence',
    label: 'Governance signal emergence',
    entries,
  }
}
