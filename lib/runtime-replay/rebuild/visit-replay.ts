import { buildCausalityChainFromTimeline } from '@/lib/runtime-replay/causality/build-chain'
import { explainGraphTriggersForVisit } from '@/lib/runtime-replay/explain/graph-triggers'
import { explainVisitReadinessBlocked } from '@/lib/runtime-replay/explain/readiness-blocked'
import { buildGovernanceEmergenceSegment } from '@/lib/runtime-replay/segments/governance-emergence'
import { buildSafetyEscalationSegment } from '@/lib/runtime-replay/segments/safety-escalation'
import { buildSourceSignatureSegment } from '@/lib/runtime-replay/segments/source-signature'
import { buildVisitExecutionSegment } from '@/lib/runtime-replay/segments/visit-execution'
import { buildWorkflowQuerySegment } from '@/lib/runtime-replay/segments/workflow-query'
import { RUNTIME_REPLAY_VERSION, type RuntimeReplayArtifact } from '@/lib/runtime-replay/types'
import { computeVisitReadinessProjection } from '@/lib/projections/compute/visit-readiness'
import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Inspection-grade visit replay: reconstructs timeline + causality + explanations.
 */
export async function rebuildVisitReplay(input: {
  supabase: SupabaseClient
  organizationId: string
  studyId: string
  visitId: string
  includeReadinessExplanation?: boolean
}): Promise<RuntimeReplayArtifact | null> {
  const { data: visit, error } = await input.supabase
    .from('visits')
    .select('id, study_id, study_subject_id, organization_id')
    .eq('id', input.visitId)
    .eq('organization_id', input.organizationId)
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (!visit) return null

  const studySubjectId = visit.study_subject_id as string

  const [
    visitExecution,
    sourceSignature,
    safetyEscalation,
    workflowQuery,
    governanceEmergence,
  ] = await Promise.all([
    buildVisitExecutionSegment({
      supabase: input.supabase,
      organizationId: input.organizationId,
      studyId: input.studyId,
      visitId: input.visitId,
    }),
    buildSourceSignatureSegment({
      supabase: input.supabase,
      organizationId: input.organizationId,
      studyId: input.studyId,
      visitId: input.visitId,
    }),
    buildSafetyEscalationSegment({
      supabase: input.supabase,
      organizationId: input.organizationId,
      studyId: input.studyId,
      studySubjectId,
      visitId: input.visitId,
    }),
    buildWorkflowQuerySegment({
      supabase: input.supabase,
      organizationId: input.organizationId,
      studyId: input.studyId,
      studySubjectId,
      visitId: input.visitId,
    }),
    buildGovernanceEmergenceSegment({
      supabase: input.supabase,
      organizationId: input.organizationId,
      visitId: input.visitId,
      studySubjectId,
    }),
  ])

  const timeline = [
    visitExecution,
    sourceSignature,
    safetyEscalation,
    workflowQuery,
    governanceEmergence,
  ]

  const sourceEventCount = timeline
    .flatMap((s) => s.entries)
    .filter((e) => e.kind === 'operational_event').length

  let readinessExplanation
  let graphTriggers

  if (input.includeReadinessExplanation !== false) {
    const projection = await computeVisitReadinessProjection(
      input.supabase,
      input.visitId,
      input.organizationId,
    )
    if (projection) {
      graphTriggers = await explainGraphTriggersForVisit({
        supabase: input.supabase,
        organizationId: input.organizationId,
        studyId: input.studyId,
        visitId: input.visitId,
      })
      readinessExplanation = explainVisitReadinessBlocked({ projection, graphTriggers })
    }
  }

  const causalityChain = buildCausalityChainFromTimeline({
    segments: timeline,
    readinessExplanation,
  })

  const summaryParts = [
    `${sourceEventCount} operational event(s)`,
    `${timeline.flatMap((s) => s.entries).length} total timeline entries`,
  ]
  if (readinessExplanation?.blocked) {
    summaryParts.push(`readiness blocked: ${readinessExplanation.primaryCauses.slice(0, 2).join('; ')}`)
  }

  return {
    scope: 'visit',
    scopeId: input.visitId,
    organizationId: input.organizationId,
    studyId: input.studyId,
    studySubjectId,
    replayVersion: RUNTIME_REPLAY_VERSION,
    computedAt: new Date().toISOString(),
    timeline,
    causalityChain,
    explanations: {
      readinessBlocked: readinessExplanation,
      graphTriggers,
      summary: summaryParts.join(' · '),
    },
    sourceEventCount,
    snapshot: {
      segmentCounts: timeline.map((s) => ({
        type: s.segmentType,
        count: s.entries.length,
      })),
    },
  }
}
