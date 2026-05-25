import type { StudyOperationsSurface } from '@/lib/coordinator-operations/types'
import { OperationalWorkQueuePanel } from '@/components/coordinator-operations/OperationalWorkQueuePanel'
import { AlertTriangle, BarChart3, FileText, Shield } from 'lucide-react'

export function StudyOperationsPanel({
  surface,
}: {
  surface: StudyOperationsSurface
}) {
  const visitStatusEntries = Object.entries(surface.visitStatusCounts).sort((a, b) => b[1] - a[1])

  return (
    <div className="space-y-4">
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border bg-card p-4">
          <p className="text-xs text-muted-foreground">Study readiness</p>
          <p className="mt-1 text-lg font-semibold capitalize">
            {surface.projectionDataAvailable
              ? surface.operationalRiskLevel ?? 'not computed'
              : 'pending projection'}
          </p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <p className="text-xs text-muted-foreground">Source draft / in progress</p>
          <p className="mt-1 text-lg font-semibold">
            {surface.sourcePackageSummary.draft + surface.sourcePackageSummary.inProgress}
          </p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <p className="text-xs text-muted-foreground">Source submitted</p>
          <p className="mt-1 text-lg font-semibold">{surface.sourcePackageSummary.submitted}</p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <p className="text-xs text-muted-foreground">Active blockers</p>
          <p className="mt-1 text-lg font-semibold">{surface.activeBlockers.length}</p>
        </div>
      </section>

      <section className="rounded-lg border bg-card p-4">
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          <BarChart3 className="size-4 text-primary" />
          Visit status distribution
        </h3>
        {visitStatusEntries.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">No visits on record for this study yet.</p>
        ) : (
          <ul className="mt-3 flex flex-wrap gap-2">
            {visitStatusEntries.map(([status, count]) => (
              <li
                key={status}
                className="rounded-full border px-3 py-1 text-xs capitalize"
              >
                {status.replace(/_/g, ' ')} · {count}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-lg border border-dashed bg-muted/10 p-4">
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          <Shield className="size-4 text-primary" />
          Regulatory readiness
        </h3>
        <p className="mt-2 text-sm text-muted-foreground">{surface.regulatoryReadinessNote}</p>
      </section>

      <section className="rounded-lg border bg-card p-4">
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          <FileText className="size-4 text-primary" />
          Source package status
        </h3>
        <p className="mt-2 text-sm text-muted-foreground">
          Counts from live source response sets — coordinator operational view only.
        </p>
        <div className="mt-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
          <div className="rounded border px-2 py-1.5">Draft: {surface.sourcePackageSummary.draft}</div>
          <div className="rounded border px-2 py-1.5">In progress: {surface.sourcePackageSummary.inProgress}</div>
          <div className="rounded border px-2 py-1.5">Submitted: {surface.sourcePackageSummary.submitted}</div>
          <div className="rounded border px-2 py-1.5">Other: {surface.sourcePackageSummary.other}</div>
        </div>
      </section>

      {surface.activeBlockers.length > 0 ? (
        <section className="rounded-lg border bg-card p-4">
          <h3 className="flex items-center gap-2 text-sm font-semibold">
            <AlertTriangle className="size-4 text-destructive" />
            Active blockers
          </h3>
          <ul className="mt-2 space-y-2">
            {surface.activeBlockers.map((b) => (
              <li key={b.id} className="rounded border px-3 py-2 text-sm">
                <span className="font-medium">{b.label}</span>
                <span className="block text-xs text-muted-foreground">{b.detail}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <OperationalWorkQueuePanel buckets={surface.workQueueBuckets} />
    </div>
  )
}
