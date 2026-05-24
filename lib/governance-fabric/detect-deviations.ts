import { evaluateVisitGraphOrchestration } from '@/lib/protocol-graph/orchestrate/visit-orchestration'
import { ruleById } from '@/lib/governance-fabric/deviation-rules'
import {
  findingsSignalsFromProjection,
  loadOpenQueriesForVisit,
} from '@/lib/governance-fabric/query-finding-bridge'
import type { GovernanceSignal } from '@/lib/governance-fabric/types'
import { computeSubjectSafetyContinuity } from '@/lib/safety-continuity/compute-subject'
import type { VisitReadinessProjection } from '@/lib/projections/types'
import type { SupabaseClient } from '@supabase/supabase-js'

export type VisitGovernanceContext = {
  visitId: string
  organizationId: string
  studyId: string
  studySubjectId: string
  windowStatus: string | null
  targetDate: string | null
  scheduledDate: string | null
  windowStart: string | null
  windowEnd: string | null
  outOfWindowReason: string | null
}

export async function loadVisitGovernanceContext(
  supabase: SupabaseClient,
  visitId: string,
  organizationId: string,
): Promise<VisitGovernanceContext | null> {
  const { data, error } = await supabase
    .from('visits')
    .select(
      'id, organization_id, study_id, study_subject_id, window_status, target_date, scheduled_date, window_start, window_end, out_of_window_reason',
    )
    .eq('id', visitId)
    .eq('organization_id', organizationId)
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (!data) return null

  return {
    visitId: data.id as string,
    organizationId: data.organization_id as string,
    studyId: data.study_id as string,
    studySubjectId: data.study_subject_id as string,
    windowStatus: (data.window_status as string | null) ?? null,
    targetDate: (data.target_date as string | null) ?? null,
    scheduledDate: (data.scheduled_date as string | null) ?? null,
    windowStart: (data.window_start as string | null) ?? null,
    windowEnd: (data.window_end as string | null) ?? null,
    outOfWindowReason: (data.out_of_window_reason as string | null) ?? null,
  }
}

/**
 * Runtime-derived deviation detection v1 from visit state + readiness projection.
 */
export async function detectVisitGovernanceSignals(input: {
  supabase: SupabaseClient
  projection: VisitReadinessProjection
}): Promise<GovernanceSignal[]> {
  const ctx = await loadVisitGovernanceContext(
    input.supabase,
    input.projection.visitId,
    input.projection.organizationId,
  )
  if (!ctx) return []

  const signals: GovernanceSignal[] = []
  const detectedAt = new Date().toISOString()
  const base = {
    organizationId: ctx.organizationId,
    studyId: ctx.studyId,
    studySubjectId: ctx.studySubjectId,
    visitId: ctx.visitId,
    detectedAt,
  }

  if (
    ctx.windowStatus === 'outside_window'
    || ctx.windowStatus === 'warning'
    || ctx.outOfWindowReason
  ) {
    const rule = ruleById('visit_window_deviation')!
    signals.push({
      signalKey: `governance:visit:${ctx.visitId}:window`,
      signalType: rule.signalType,
      severity: ctx.windowStatus === 'outside_window' ? 'blocker' : rule.defaultSeverity,
      status: 'open',
      label: rule.label,
      detail:
        ctx.outOfWindowReason
        || `Visit window status: ${ctx.windowStatus ?? 'unknown'} (target ${ctx.targetDate ?? 'n/a'}).`,
      ...base,
      derivation: {
        rule_id: rule.id,
        window_status: ctx.windowStatus,
        target_date: ctx.targetDate,
        scheduled_date: ctx.scheduledDate,
        window_start: ctx.windowStart,
        window_end: ctx.windowEnd,
      },
    })
  }

  if (input.projection.missingSourceCount > 0) {
    const rule = ruleById('missing_source_at_signoff')!
    signals.push({
      signalKey: `governance:visit:${ctx.visitId}:missing_source`,
      signalType: rule.signalType,
      severity: rule.defaultSeverity,
      status: 'open',
      label: rule.label,
      detail: `${input.projection.missingSourceCount} procedure(s) lack submitted source.`,
      ...base,
      derivation: { rule_id: rule.id, missing_source_count: input.projection.missingSourceCount },
    })
  }

  signals.push(
    ...findingsSignalsFromProjection({
      organizationId: ctx.organizationId,
      studyId: ctx.studyId,
      studySubjectId: ctx.studySubjectId,
      visitId: ctx.visitId,
      unresolvedFindingCount: input.projection.unresolvedFindingCount,
    }),
  )

  if (input.projection.safetyBlockerCount > 0 || input.projection.blockers.some((b) => b.id.includes('signoff-ae'))) {
    const rule = ruleById('unresolved_ae_at_signoff')!
    signals.push({
      signalKey: `governance:visit:${ctx.visitId}:ae_signoff`,
      signalType: rule.signalType,
      severity: rule.defaultSeverity,
      status: 'open',
      label: rule.label,
      detail: 'Unresolved adverse event continuity blocks signoff.',
      ...base,
      derivation: {
        rule_id: rule.id,
        safety_blocker_count: input.projection.safetyBlockerCount,
      },
    })
  }

  const graph = await evaluateVisitGraphOrchestration({
    supabase: input.supabase,
    organizationId: ctx.organizationId,
    studyId: ctx.studyId,
    visitId: ctx.visitId,
  })

  const graphBlockers = graph.blockers.filter((b) => b.severity === 'blocker')
  if (graphBlockers.length > 0) {
    const rule = ruleById('protocol_graph_blocker_unresolved')!
    for (const blocker of graphBlockers) {
      signals.push({
        signalKey: `governance:visit:${ctx.visitId}:graph:${blocker.id}`,
        signalType: rule.signalType,
        severity: rule.defaultSeverity,
        status: 'open',
        label: rule.label,
        detail: blocker.detail,
        ...base,
        derivation: {
          rule_id: rule.id,
          graph_blocker_id: blocker.id,
          graph_publication_id: graph.publicationId,
          graph_revision: graph.graphRevision,
        },
      })
    }
  }

  const queries = await loadOpenQueriesForVisit({
    supabase: input.supabase,
    organizationId: ctx.organizationId,
    studySubjectId: ctx.studySubjectId,
    visitId: ctx.visitId,
  })
  signals.push(...queries)

  const continuity = await computeSubjectSafetyContinuity({
    supabase: input.supabase,
    organizationId: ctx.organizationId,
    studyId: ctx.studyId,
    studySubjectId: ctx.studySubjectId,
  })

  if (continuity.continuityState === 'elevated' || continuity.continuityState === 'critical') {
    const rule = ruleById('safety_continuity_elevated')!
    signals.push({
      signalKey: `governance:subject:${ctx.studySubjectId}:safety_continuity`,
      signalType: rule.signalType,
      severity: continuity.continuityState === 'critical' ? 'blocker' : rule.defaultSeverity,
      status: 'open',
      label: rule.label,
      detail: `Subject safety continuity: ${continuity.continuityState} (${continuity.unresolvedAeCount} open AE).`,
      ...base,
      derivation: {
        rule_id: rule.id,
        continuity_state: continuity.continuityState,
        unresolved_ae_count: continuity.unresolvedAeCount,
        source_refs: continuity.sourceRefs,
      },
    })
  }

  return signals
}
