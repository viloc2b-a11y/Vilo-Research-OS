import type { VisitFinancialContext } from '@/lib/financial-runtime/load/visit-context'
import type { UnscheduledRuntimeBurden } from '@/lib/financial-runtime/types'

export function computeUnscheduledRuntimeBurden(ctx: VisitFinancialContext): UnscheduledRuntimeBurden {
  const missingScheduledDate = !ctx.scheduledDate
  const outOfWindow = ctx.windowStatus === 'outside_window' || ctx.windowStatus === 'warning'
  const isUnscheduled = missingScheduledDate || outOfWindow

  let burdenScore = 0
  const details: string[] = []

  if (missingScheduledDate) {
    burdenScore += 20
    details.push('no scheduled date')
  }
  if (ctx.windowStatus === 'outside_window') {
    burdenScore += 35
    details.push('outside protocol window')
  } else if (ctx.windowStatus === 'warning') {
    burdenScore += 15
    details.push('window warning')
  }
  if (ctx.rescheduleEventCount > 0) {
    burdenScore += Math.min(30, ctx.rescheduleEventCount * 10)
    details.push(`${ctx.rescheduleEventCount} reschedule event(s)`)
  }

  return {
    isUnscheduled,
    windowStatus: ctx.windowStatus,
    missingScheduledDate,
    outOfWindow,
    burdenScore: Math.min(100, burdenScore),
    detail: details.length ? details.join('; ') : null,
  }
}
