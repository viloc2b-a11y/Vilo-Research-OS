import { visitOperationalDisplayDate } from '@/lib/calendar/get-active-visit-reschedule'
import {
  sourceCapturePath,
  sourceResponseSetPath,
  visitDetailPath,
} from '@/lib/ops/paths'
import type { VisitHealthTimelineItem } from '@/lib/subject/operations/types'
import type { ValidationIssueItem } from '@/lib/subject/operations/types'
import type { SubjectVisitGridRow } from '@/lib/subject/visits/types'

export function buildVisitHealthTimeline(
  visits: SubjectVisitGridRow[],
  validationIssues: ValidationIssueItem[],
): VisitHealthTimelineItem[] {
  const issuesByVisit = new Map<string, { total: number; blocked: number }>()
  for (const issue of validationIssues) {
    if (!issue.visitId) continue
    const prev = issuesByVisit.get(issue.visitId) ?? { total: 0, blocked: 0 }
    prev.total += 1
    if (issue.kind === 'blocked') prev.blocked += 1
    issuesByVisit.set(issue.visitId, prev)
  }

  return visits.map((v) => {
    const visitDetailHref = visitDetailPath(v.id)
    const captureHref = v.primaryProcedureId
      ? sourceCapturePath(v.primaryProcedureId, v.organizationId)
      : null
    const reviewHref = v.primaryResponseSetId
      ? sourceResponseSetPath(v.primaryResponseSetId, {
          organization_id: v.organizationId,
        })
      : null

    const href =
      captureHref &&
      (v.sourceStatus === 'not_started' ||
        v.sourceStatus === 'draft' ||
        v.visitStatus === 'in_progress')
        ? captureHref
        : visitDetailHref

    const signaturesPending: string[] = []
    if (v.visitReviewStatus === 'draft' || v.visitReviewStatus === 'reopened') {
      signaturesPending.push('Coordinator')
    }
    if (v.visitReviewStatus === 'coordinator_signed') {
      signaturesPending.push('Investigator')
    }
    if (v.workflow.pendingSignatures > 0) {
      signaturesPending.push(`${v.workflow.pendingSignatures} workflow request(s)`)
    }

    const issueCounts = issuesByVisit.get(v.id) ?? { total: 0, blocked: 0 }

    return {
      visitId: v.id,
      visitName: v.visitName,
      visitDay: v.visitDay,
      targetDate: v.targetDate,
      scheduledDate: v.scheduledDate,
      displayDate: visitOperationalDisplayDate({
        targetDate: v.targetDate,
        scheduledDate: v.scheduledDate,
        calendarReschedule: v.calendarReschedule,
      }),
      calendarReschedule: v.calendarReschedule,
      actualDate: v.completedDate,
      windowStatus: v.windowStatus,
      visitStatus: v.visitStatus,
      visitReviewStatus: v.visitReviewStatus,
      sourceStatus: v.sourceStatus,
      signaturesPending,
      unresolvedIssues: issueCounts.total,
      blockedProcedureCount: issueCounts.blocked,
      href,
      visitDetailHref,
      captureHref,
      reviewHref,
    }
  })
}
