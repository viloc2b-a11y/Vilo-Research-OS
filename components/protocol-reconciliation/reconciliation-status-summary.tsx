'use client'

import type { ReconciliationWorkspaceSummary } from '@/lib/protocol-reconciliation/protocol-reconciliation-types'

export function ReconciliationStatusSummary(props: {
  summary: ReconciliationWorkspaceSummary
  versionLabel: string | null
}) {
  const { summary } = props
  return (
    <div className="rounded-md border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
      <div className="flex flex-wrap items-center gap-2">
        <p className="font-medium text-slate-900">
          Reconciliation completeness · {props.versionLabel ?? 'Protocol version'}
        </p>
        <span className="rounded bg-white px-2 py-0.5 text-xs text-slate-600">
          {summary.completenessPercent}%
        </span>
        {summary.readyForRuntimeGeneration ? (
          <span className="rounded bg-teal-50 px-2 py-0.5 text-xs text-teal-800">Runtime-ready</span>
        ) : null}
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <span>{summary.visitCount} visits · {summary.visitsApproved} approved · {summary.visitsPending} pending</span>
        <span>{summary.procedureCount} procedures · {summary.proceduresApproved} approved</span>
        <span>{summary.proceduresMatched} matched · {summary.proceduresNeedsReview} needs review</span>
        <span>{summary.eventCount} reconciliation events</span>
      </div>
    </div>
  )
}
