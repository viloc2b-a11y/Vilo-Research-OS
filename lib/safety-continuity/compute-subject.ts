import { SAFETY_CONTINUITY_PROJECTION_VERSION } from '@/lib/safety-continuity/constants'
import {
  loadCriticalSourceFindingsForSubject,
  loadOpenSafetyWorkflowItems,
  loadUnresolvedAdverseEvents,
  toSourceRefs,
} from '@/lib/safety-continuity/load-unresolved'
import type {
  SafetyContinuityState,
  SubjectSafetyContinuity,
  UnresolvedSafetyItem,
} from '@/lib/safety-continuity/types'
import type { SupabaseClient } from '@supabase/supabase-js'

function deriveContinuityState(items: UnresolvedSafetyItem[]): SafetyContinuityState {
  if (items.some((i) => i.severity === 'blocker' && (i.seriousness || i.source === 'source_finding'))) {
    return 'critical'
  }
  if (items.some((i) => i.severity === 'blocker' || i.source === 'ae_registry')) {
    return 'elevated'
  }
  if (items.length > 0) return 'attention'
  return 'clear'
}

export async function computeSubjectSafetyContinuity(input: {
  supabase: SupabaseClient
  organizationId: string
  studyId: string
  studySubjectId: string
}): Promise<SubjectSafetyContinuity> {
  const [aeItems, workflowItems, findingItems] = await Promise.all([
    loadUnresolvedAdverseEvents({
      supabase: input.supabase,
      studySubjectId: input.studySubjectId,
      organizationId: input.organizationId,
    }),
    loadOpenSafetyWorkflowItems({
      supabase: input.supabase,
      studySubjectId: input.studySubjectId,
      organizationId: input.organizationId,
    }),
    loadCriticalSourceFindingsForSubject({
      supabase: input.supabase,
      studySubjectId: input.studySubjectId,
      organizationId: input.organizationId,
    }),
  ])

  const unresolvedItems = [...aeItems, ...workflowItems, ...findingItems]
  const continuityState = deriveContinuityState(unresolvedItems)
  const carryForwardActive = aeItems.length > 0

  return {
    studySubjectId: input.studySubjectId,
    organizationId: input.organizationId,
    studyId: input.studyId,
    computedAt: new Date().toISOString(),
    projectionVersion: SAFETY_CONTINUITY_PROJECTION_VERSION,
    continuityState,
    carryForwardActive,
    unresolvedAeCount: aeItems.length,
    openSafetyWorkflowCount: workflowItems.length,
    criticalFindingCount: findingItems.length,
    unresolvedItems,
    sourceRefs: toSourceRefs(unresolvedItems),
    snapshot: {
      aeIds: aeItems.map((i) => i.sourceId),
      workflowIds: workflowItems.map((i) => i.sourceId),
      findingIds: findingItems.map((i) => i.sourceId),
    },
  }
}
