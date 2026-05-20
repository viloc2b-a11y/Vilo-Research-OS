import type {
  PendingActionItem,
  PendingSignatureItem,
  SubjectOperationalHealth,
  UpcomingVisitItem,
  ValidationIssueItem,
} from '@/lib/subject/operations/types'
import type { SubjectVisitGridRow } from '@/lib/subject/visits/types'

export function getSubjectOperationalHealth(input: {
  visits: SubjectVisitGridRow[]
  upcomingVisits: UpcomingVisitItem[]
  pendingActions: PendingActionItem[]
  pendingSignatures: PendingSignatureItem[]
  validationIssues: ValidationIssueItem[]
}): { health: SubjectOperationalHealth; healthReasons: string[] } {
  const reasons: string[] = []

  const missedVisits = input.visits.filter((v) => v.visitStatus === 'missed').length
  if (missedVisits > 0) {
    reasons.push(`${missedVisits} missed visit(s)`)
  }

  const criticalOverdue = input.pendingActions.filter(
    (a) => a.isOverdue && (a.priority === 'urgent' || a.priority === 'high'),
  )
  if (criticalOverdue.length > 0) {
    reasons.push(`${criticalOverdue.length} overdue high-priority action(s)`)
  }

  const blocked = input.validationIssues.filter((i) => i.kind === 'blocked')
  if (blocked.length > 0) {
    reasons.push(`${blocked.length} blocking validation issue(s)`)
  }

  const overdueScheduling = input.upcomingVisits.filter((v) => v.isOverdueScheduling)
  if (overdueScheduling.length > 0) {
    reasons.push(`${overdueScheduling.length} visit(s) need scheduling before window closes`)
  }

  if (reasons.length > 0) {
    return { health: 'critical', healthReasons: reasons }
  }

  const attentionReasons: string[] = []

  if (input.pendingActions.length > 0) {
    attentionReasons.push(`${input.pendingActions.length} open workflow item(s)`)
  }
  if (input.pendingSignatures.length > 0) {
    attentionReasons.push(`${input.pendingSignatures.length} pending signature(s)`)
  }
  if (input.validationIssues.length > 0) {
    attentionReasons.push(`${input.validationIssues.length} validation issue(s)`)
  }

  const approaching = input.upcomingVisits.filter((v) => v.reminderStatus === 'pending')
  if (approaching.length > 0) {
    attentionReasons.push(`${approaching.length} visit(s) approaching in 2 days`)
  }

  const windowWarnings = input.visits.filter(
    (v) => v.windowStatus === 'warning' || v.windowStatus === 'outside_window',
  )
  if (windowWarnings.length > 0) {
    attentionReasons.push(`${windowWarnings.length} visit(s) with window alerts`)
  }

  if (attentionReasons.length > 0) {
    return { health: 'attention', healthReasons: attentionReasons }
  }

  return { health: 'healthy', healthReasons: ['No critical operational blockers.'] }
}
