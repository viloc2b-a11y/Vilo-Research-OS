import type { AmendmentDiff } from '@/lib/financial-runtime/types'

export type AmendmentActionType =
  | 'reconsent_required'
  | 'training_review_required'
  | 'protocol_update_notification'
  | 'visit_schedule_update'
  | 'procedure_add'
  | 'procedure_remove'

export type AmendmentAction = {
  actionType: AmendmentActionType
  description: string
  priority: 'high' | 'medium' | 'low'
  affectedCount: number
  dueWithinDays: number | null
}

export type AmendmentActionPlan = {
  protocolVersionId: string
  studyId: string
  actions: AmendmentAction[]
  totalHighPriority: number
  requiresImmediateAction: boolean
}

export function generateAmendmentActions(
  diff: AmendmentDiff,
  studyId: string,
  subjectCount: number,
): AmendmentActionPlan {
  const actions: AmendmentAction[] = []

  // Training review
  if (diff.requiresTrainingReview) {
    actions.push({
      actionType: 'training_review_required',
      description: 'Protocol changes require staff training review before enrollment continues.',
      priority: 'high',
      affectedCount: subjectCount,
      dueWithinDays: 14,
    })
  }

  // Visit schedule changes — collect both added and removed, then deduplicate/merge
  const visitScheduleActions: AmendmentAction[] = []

  if (diff.addedVisits.length > 0) {
    visitScheduleActions.push({
      actionType: 'visit_schedule_update',
      description: `${diff.addedVisits.length} new visit${diff.addedVisits.length > 1 ? 's' : ''} added to the protocol schedule.`,
      priority: 'medium',
      affectedCount: diff.addedVisits.length,
      dueWithinDays: 30,
    })
  }

  if (diff.removedVisits.length > 0) {
    visitScheduleActions.push({
      actionType: 'visit_schedule_update',
      description: `${diff.removedVisits.length} visit${diff.removedVisits.length > 1 ? 's' : ''} removed from the protocol schedule — reschedule or cancel affected appointments.`,
      priority: 'high',
      affectedCount: diff.removedVisits.length,
      dueWithinDays: 14,
    })
  }

  // Merge visit_schedule_update actions into one (highest priority wins)
  if (visitScheduleActions.length > 0) {
    const hasHighPriority = visitScheduleActions.some((a) => a.priority === 'high')
    const totalAffected = visitScheduleActions.reduce((sum, a) => sum + a.affectedCount, 0)
    const shortestDue = visitScheduleActions.reduce<number | null>((min, a) => {
      if (a.dueWithinDays === null) return min
      return min === null ? a.dueWithinDays : Math.min(min, a.dueWithinDays)
    }, null)

    const descriptions = visitScheduleActions.map((a) => a.description).join(' ')

    actions.push({
      actionType: 'visit_schedule_update',
      description: descriptions,
      priority: hasHighPriority ? 'high' : 'medium',
      affectedCount: totalAffected,
      dueWithinDays: shortestDue,
    })
  }

  // Procedure changes
  if (diff.addedProcedures.length > 0) {
    actions.push({
      actionType: 'procedure_add',
      description: `${diff.addedProcedures.length} new procedure${diff.addedProcedures.length > 1 ? 's' : ''} added — update data collection forms and training materials.`,
      priority: 'medium',
      affectedCount: diff.addedProcedures.length,
      dueWithinDays: 30,
    })
  }

  if (diff.removedProcedures.length > 0) {
    actions.push({
      actionType: 'procedure_remove',
      description: `${diff.removedProcedures.length} procedure${diff.removedProcedures.length > 1 ? 's' : ''} removed — discontinue collection and update source documents.`,
      priority: 'high',
      affectedCount: diff.removedProcedures.length,
      dueWithinDays: 14,
    })
  }

  // Reconsent (high operational impact)
  if (diff.operationalImpactScore > 50) {
    actions.push({
      actionType: 'reconsent_required',
      description: 'Amendment impact score exceeds threshold — enrolled subjects require reconsent before next visit.',
      priority: 'high',
      affectedCount: subjectCount,
      dueWithinDays: 21,
    })
  }

  // Protocol update notification — always present
  actions.push({
    actionType: 'protocol_update_notification',
    description: 'Notify all site staff of protocol amendment and distribute updated documents.',
    priority: 'low',
    affectedCount: subjectCount,
    dueWithinDays: 7,
  })

  const totalHighPriority = actions.filter((a) => a.priority === 'high').length

  return {
    protocolVersionId: diff.versionId,
    studyId,
    actions,
    totalHighPriority,
    requiresImmediateAction: totalHighPriority > 0,
  }
}
