import { buildCausalityChainFromTimeline } from '@/lib/runtime-replay/causality/build-chain'
import { loadOperationalChronologyForReplay } from '@/lib/runtime-replay/load-chronology'
import { buildGovernanceEmergenceSegment } from '@/lib/runtime-replay/segments/governance-emergence'
import { buildSafetyEscalationSegment } from '@/lib/runtime-replay/segments/safety-escalation'
import { buildWorkflowQuerySegment } from '@/lib/runtime-replay/segments/workflow-query'
import { rebuildVisitReplay } from '@/lib/runtime-replay/rebuild/visit-replay'
import { RUNTIME_REPLAY_VERSION, type RuntimeReplayArtifact } from '@/lib/runtime-replay/types'
import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Subject-level replay: longitudinal safety/workflow + per-visit replay summaries.
 */
export async function rebuildSubjectReplay(input: {
  supabase: SupabaseClient
  organizationId: string
  studyId: string
  studySubjectId: string
  visitLimit?: number
}): Promise<RuntimeReplayArtifact | null> {
  const { data: subject, error } = await input.supabase
    .from('study_subjects')
    .select('id, study_id, organization_id')
    .eq('id', input.studySubjectId)
    .eq('organization_id', input.organizationId)
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (!subject) return null

  const { data: visits } = await input.supabase
    .from('visits')
    .select('id')
    .eq('study_subject_id', input.studySubjectId)
    .eq('organization_id', input.organizationId)
    .order('scheduled_date', { ascending: false })
    .limit(input.visitLimit ?? 12)

  const visitIds = (visits ?? []).map((v) => v.id as string)

  const [safetyEscalation, workflowQuery, governanceEmergence, chronology] =
    await Promise.all([
      buildSafetyEscalationSegment({
        supabase: input.supabase,
        organizationId: input.organizationId,
        studyId: input.studyId,
        studySubjectId: input.studySubjectId,
      }),
      buildWorkflowQuerySegment({
        supabase: input.supabase,
        organizationId: input.organizationId,
        studyId: input.studyId,
        studySubjectId: input.studySubjectId,
      }),
      buildGovernanceEmergenceSegment({
        supabase: input.supabase,
        organizationId: input.organizationId,
        studySubjectId: input.studySubjectId,
      }),
      loadOperationalChronologyForReplay({
        supabase: input.supabase,
        organizationId: input.organizationId,
        studyId: input.studyId,
        visitIds: visitIds.length ? visitIds : undefined,
        limit: 1000,
      }),
    ])

  const visitReplaySummaries = []
  for (const visitId of visitIds.slice(0, 5)) {
    const visitReplay = await rebuildVisitReplay({
      supabase: input.supabase,
      organizationId: input.organizationId,
      studyId: input.studyId,
      visitId,
      includeReadinessExplanation: false,
    })
    if (visitReplay) {
      visitReplaySummaries.push({
        visitId,
        summary: visitReplay.explanations.summary,
        eventCount: visitReplay.sourceEventCount,
      })
    }
  }

  const timeline = [safetyEscalation, workflowQuery, governanceEmergence]
  const sourceEventCount = chronology.length

  const causalityChain = buildCausalityChainFromTimeline({ segments: timeline })

  return {
    scope: 'subject',
    scopeId: input.studySubjectId,
    organizationId: input.organizationId,
    studyId: input.studyId,
    studySubjectId: input.studySubjectId,
    replayVersion: RUNTIME_REPLAY_VERSION,
    computedAt: new Date().toISOString(),
    timeline,
    causalityChain,
    explanations: {
      summary: `Subject replay across ${visitIds.length} visit(s); ${sourceEventCount} spine event(s).`,
    },
    sourceEventCount,
    snapshot: {
      visitReplaySummaries,
      visitCount: visitIds.length,
    },
  }
}
