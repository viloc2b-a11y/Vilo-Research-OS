import type { StudyWorkspaceSummaryCounts } from '@/lib/study-workspace/study-workspace-types'

type StudyMonitoringViewPanelProps = {
  counts: StudyWorkspaceSummaryCounts
}

function displayMetric(value: number | null, label: string) {
  return (
    <div className="rounded-md border border-slate-200 bg-white p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-slate-900">{value ?? '—'}</p>
    </div>
  )
}

/** Read-only operational snapshot for external oversight (counts only). */
export function StudyMonitoringViewPanel({ counts }: StudyMonitoringViewPanelProps) {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-sm font-semibold text-slate-800">Monitoring View</h2>
        <p className="mt-1 text-sm text-slate-500">
          Read-only summary of operational progress on this study. Counts reflect workspace activity
          only — not predictive analytics or internal site assessments.
        </p>
      </div>

      <div className="rounded-md border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-600">
        Informational only. External monitors see operational counts only — not sponsor dashboards,
        financial data, or internal site assessment models.
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {displayMetric(counts.subjectCount, 'Enrolled subjects')}
        {displayMetric(counts.runtimeVisitCount, 'Runtime visits defined')}
        {displayMetric(counts.lockedSnapshotCount, 'Locked visit snapshots')}
        {displayMetric(counts.publishedSourceCount, 'Published source versions')}
        {displayMetric(counts.documentCount, 'Binder documents')}
        {displayMetric(counts.openObligationsCount, 'Open compliance obligations')}
      </div>

      <p className="text-xs text-slate-400">
        For detailed review of locked visits, use Visit Runtime and Operational Review modules from
        the Source Runtime and Visit Runtime sections.
      </p>
    </div>
  )
}
