import Link from 'next/link'
import { Activity } from 'lucide-react'
import { subjectChartPath } from '@/lib/ops/paths'
import type { SubjectRuntimeUiModel } from '@/lib/runtime-ui/types'
import { RuntimeWhyBlockedDrawer } from '@/components/runtime-ui/RuntimeWhyBlockedDrawer'

export function SubjectRuntimeSummaryPanel({
  model,
  studyId,
}: {
  model: SubjectRuntimeUiModel
  studyId: string
}) {
  return (
    <section className="rounded-lg border border-border bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <Activity className="size-4 text-primary" />
          Subject runtime summary
        </h3>
        <span className="text-[10px] capitalize text-muted-foreground">
          Health: {model.operationalHealth}
          {model.escalationLevel && model.escalationLevel !== 'none'
            ? ` · Escalation: ${model.escalationLevel}`
            : ''}
        </span>
      </div>

      {model.nextAction ? (
        <p className="mt-2 text-sm">
          <span className="font-medium text-foreground">Next: </span>
          {model.nextAction.label}
        </p>
      ) : null}

      <div className="mt-3 flex flex-wrap gap-3 text-xs text-muted-foreground">
        <span>{model.openVisitCount} open visit(s)</span>
        <span>{model.workQueueSummary.actionNow} action now</span>
        <span>{model.workQueueSummary.piReview} PI review</span>
        <span>{model.workQueueSummary.escalation} escalation</span>
        {model.automationProposals.length > 0 ? (
          <span>{model.automationProposals.length} automation proposal(s)</span>
        ) : null}
      </div>

      <div className="mt-3">
        <RuntimeWhyBlockedDrawer whyBlocked={model.whyBlocked} />
      </div>

      <Link
        href={subjectChartPath(studyId, model.studySubjectId)}
        className="mt-3 inline-block text-xs font-medium text-primary hover:underline"
      >
        Open subject chart →
      </Link>
    </section>
  )
}
