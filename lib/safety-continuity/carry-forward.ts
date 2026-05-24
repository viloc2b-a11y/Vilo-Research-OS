import { SAFETY_CONTINUITY_PROJECTION_VERSION } from '@/lib/safety-continuity/constants'
import { computeSubjectSafetyContinuity } from '@/lib/safety-continuity/compute-subject'
import {
  loadCriticalSourceFindingsForSubject,
  loadUnresolvedAdverseEvents,
} from '@/lib/safety-continuity/load-unresolved'
import type { VisitSafetyCarryForward } from '@/lib/safety-continuity/types'
import { subjectAdverseEventsTabPath } from '@/lib/ops/paths'
import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Applies subject-level unresolved safety onto a specific visit (carry-forward).
 */
export async function computeVisitSafetyCarryForward(input: {
  supabase: SupabaseClient
  organizationId: string
  studyId: string
  studySubjectId: string
  visitId: string
  terminalVisit?: boolean
}): Promise<VisitSafetyCarryForward> {
  const subjectContinuity = await computeSubjectSafetyContinuity({
    supabase: input.supabase,
    organizationId: input.organizationId,
    studyId: input.studyId,
    studySubjectId: input.studySubjectId,
  })

  const [aeItems, visitFindings] = await Promise.all([
    loadUnresolvedAdverseEvents({
      supabase: input.supabase,
      studySubjectId: input.studySubjectId,
      organizationId: input.organizationId,
    }),
    loadCriticalSourceFindingsForSubject({
      supabase: input.supabase,
      studySubjectId: input.studySubjectId,
      organizationId: input.organizationId,
      visitId: input.visitId,
    }),
  ])

  const visitLinkedAe = aeItems.filter((i) => i.visitId === input.visitId)
  const carriedAe = aeItems.filter((i) => i.visitId !== input.visitId)
  const aeHref = subjectAdverseEventsTabPath(input.studyId, input.studySubjectId)

  const blockers: VisitSafetyCarryForward['blockers'] = []

  if (!input.terminalVisit && subjectContinuity.carryForwardActive) {
    for (const ae of carriedAe) {
      blockers.push({
        id: `safety-carryforward:${ae.sourceId}`,
        category: 'safety_continuity',
        severity: ae.severity,
        label: 'Unresolved AE (carried forward)',
        detail: `${ae.label} — open from prior context; applies to this visit.`,
      })
    }
  }

  if (!input.terminalVisit && visitLinkedAe.length > 0) {
    blockers.push({
      id: 'safety-visit-linked-ae',
      category: 'safety',
      severity: visitLinkedAe.some((a) => a.severity === 'blocker') ? 'blocker' : 'warning',
      label: 'Visit-linked adverse events',
      detail: `${visitLinkedAe.length} open AE(s) recorded on this visit.`,
    })
  }

  if (!input.terminalVisit && visitFindings.length > 0) {
    blockers.push({
      id: 'safety-visit-critical-findings',
      category: 'safety',
      severity: 'blocker',
      label: 'Critical safety findings',
      detail: `${visitFindings.length} unresolved critical source finding(s) on this visit.`,
    })
  }

  if (
    !input.terminalVisit
    && subjectContinuity.continuityState === 'critical'
    && carriedAe.length === 0
    && visitLinkedAe.length === 0
  ) {
    blockers.push({
      id: 'safety-subject-critical',
      category: 'safety_continuity',
      severity: 'blocker',
      label: 'Subject safety continuity critical',
      detail: 'Unresolved serious safety items on subject — review before signoff.',
    })
  }

  void aeHref

  return {
    visitId: input.visitId,
    organizationId: input.organizationId,
    studyId: input.studyId,
    studySubjectId: input.studySubjectId,
    computedAt: new Date().toISOString(),
    projectionVersion: SAFETY_CONTINUITY_PROJECTION_VERSION,
    subjectContinuityState: subjectContinuity.continuityState,
    carriedAeCount: carriedAe.length,
    visitLinkedAeCount: visitLinkedAe.length,
    carryForwardActive: subjectContinuity.carryForwardActive,
    blockers,
    snapshot: {
      subjectContinuity,
      aeHref,
    },
  }
}
