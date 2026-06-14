import Link from 'next/link'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { OperationalStateBadge } from '@/app/(ops)/performance/_components/OperationalStateBadge'
import { cn } from '@/lib/utils'
import {
  hasCriticalRisks,
  performanceScopeDescription,
} from '@/app/(ops)/performance/_lib/performance-risk'
import type {
  PerformanceLoadStatus,
  SubjectRiskQueueItem,
} from '@/app/(ops)/performance/_lib/performance-types'

type SubjectRiskQueueProps = {
  items: SubjectRiskQueueItem[]
  status: PerformanceLoadStatus
  loadFailed: boolean
  selectedStudyName: string | null
}

const severityTone = {
  critical: 'border-rose-200 bg-rose-50 dark:border-rose-900 dark:bg-rose-950/40',
  attention: 'border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/40',
  warning: 'border-sky-200 bg-sky-50 dark:border-sky-900 dark:bg-sky-950/40',
} as const

const reasonTone: Record<SubjectRiskQueueItem['reasonKind'], string> = {
  missed_visit: 'bg-rose-100 text-rose-900 dark:bg-rose-950 dark:text-rose-200',
  out_of_window: 'bg-orange-100 text-orange-900 dark:bg-orange-950 dark:text-orange-200',
  overdue_action: 'bg-violet-100 text-violet-900 dark:bg-violet-950 dark:text-violet-200',
  open_query: 'bg-violet-100 text-violet-900 dark:bg-violet-950 dark:text-violet-200',
  blocked_procedure: 'bg-red-100 text-red-900 dark:bg-red-950 dark:text-red-200',
  needs_resign: 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200',
  window_warning: 'bg-sky-100 text-sky-900 dark:bg-sky-950 dark:text-sky-200',
  governance_blocker: 'bg-rose-100 text-rose-900 dark:bg-rose-950 dark:text-rose-200',
  governance_warning: 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200',
  revenue_leakage: 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200',
  earned_but_not_invoiced: 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200',
  invoiceable_missing: 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200',
  screen_failure_billable: 'bg-sky-100 text-sky-900 dark:bg-sky-950 dark:text-sky-200',
  pass_through_unreimbursed: 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200',
  stipend_unreconciled: 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200',
  overdue_financial: 'bg-rose-100 text-rose-900 dark:bg-rose-950 dark:text-rose-200',
  disputed_payment: 'bg-rose-100 text-rose-900 dark:bg-rose-950 dark:text-rose-200',
  reverted_payment: 'bg-rose-100 text-rose-900 dark:bg-rose-950 dark:text-rose-200',
  written_off_payment: 'bg-rose-100 text-rose-900 dark:bg-rose-950 dark:text-rose-200',
  lab_worsening: 'bg-slate-100 text-slate-900 dark:bg-slate-950 dark:text-slate-200',
  lab_consecutive_worsening: 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200',
  lab_consecutive_abnormal: 'bg-rose-100 text-rose-900 dark:bg-rose-950 dark:text-rose-200',
  lab_missing_repeat: 'bg-sky-100 text-sky-900 dark:bg-sky-950 dark:text-sky-200',
  lab_follow_up_overdue: 'bg-rose-100 text-rose-900 dark:bg-rose-950 dark:text-rose-200',
  lab_safety_review: 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200',
  sae_reporting_overdue: 'bg-rose-100 text-rose-900 dark:bg-rose-950 dark:text-rose-200',
  sae_reporting_due_soon: 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200',
  sae_sponsor_pending: 'bg-orange-100 text-orange-900 dark:bg-orange-950 dark:text-orange-200',
  consent_overdue: 'bg-rose-100 text-rose-900 dark:bg-rose-950 dark:text-rose-200',
  consent_pending: 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200',
  capa_overdue: 'bg-rose-100 text-rose-900 dark:bg-rose-950 dark:text-rose-200',
}

export function SubjectRiskQueue({
  items,
  status,
  loadFailed,
  selectedStudyName,
}: SubjectRiskQueueProps) {
  const showStudyOnRow = !selectedStudyName
  const noCritical = items.length > 0 && !hasCriticalRisks(items)

  return (
    <Card>
      <CardHeader>
        <CardTitle>Subject risk queue</CardTitle>
        <CardDescription>
          Prioritized subject actions with the signal, explanation, and runtime context.{' '}
          {performanceScopeDescription(selectedStudyName)}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {loadFailed ? (
          <p className="text-sm text-destructive">
            Risk queue data is unavailable due to a query error. See the banner above.
          </p>
        ) : items.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {status === 'empty'
              ? 'No subjects or visits are in scope.'
              : 'No elevated subject risks detected for the current study scope.'}
          </p>
        ) : (
          <>
            {noCritical ? (
              <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200">
                No critical risks in the current scope.
                {items.length > 0
                  ? ' Attention and window warnings are listed below.'
                  : null}
              </p>
            ) : null}
            <ul className="space-y-2">
              {items.map((item) => (
                <li
                  key={item.id}
                  className={cn(
                    'rounded-md border px-3 py-2.5 text-sm',
                    severityTone[item.severity],
                  )}
                >
                  <RiskRow item={item} showStudyOnRow={showStudyOnRow} />
                </li>
              ))}
            </ul>
          </>
        )}
      </CardContent>
    </Card>
  )
}

function RiskRow({
  item,
  showStudyOnRow,
}: {
  item: SubjectRiskQueueItem
  showStudyOnRow: boolean
}) {
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="font-semibold text-foreground">{item.title}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Priority {item.priority} · Owner {item.ownerRole}
          </p>
          <p className="mt-1 font-medium">
            <Link href={item.subjectHref} className="hover:underline">
              {item.subjectIdentifier}
            </Link>
            {showStudyOnRow ? (
              <span className="font-normal text-muted-foreground"> · {item.studyName}</span>
            ) : null}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {item.operationalState ? (
            <OperationalStateBadge state={item.operationalState} />
          ) : null}
          <span
            className={cn(
              'rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
              reasonTone[item.reasonKind],
            )}
          >
            {item.reasonLabel}
          </span>
        </div>
      </div>
      <p className="mt-1 text-muted-foreground">
        <span className="font-medium text-foreground">Reason: </span>
        {item.reason}
      </p>
      {item.recommendedNextStep ? (
        <p className="mt-1 text-xs font-medium text-foreground">
          Recommended next step: {item.recommendedNextStep}
        </p>
      ) : null}
      <p className="mt-1 text-xs text-muted-foreground">
        Linked object: {item.linkedObjectLabel}
      </p>
      {item.detailLines.length > 0 ? (
        <ul className="mt-1.5 space-y-0.5 text-xs text-muted-foreground">
          {item.detailLines.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      ) : null}
      <p className="mt-2 flex flex-wrap gap-3 text-xs">
        <Link href={item.subjectHref} className="font-medium text-primary hover:underline">
          Subject chart
        </Link>
        <Link href={item.contextHref} className="font-medium text-primary hover:underline">
          Open context: {item.contextLabel}
        </Link>
      </p>
    </>
  )
}


