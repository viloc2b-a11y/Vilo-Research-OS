import type { CampaignDetail } from '@/lib/crm/campaign-management'

type CampaignPerformanceSummaryProps = {
  detail: CampaignDetail
}

type MetricCardProps = {
  label: string
  value: number
}

function MetricCard({ label, value }: MetricCardProps) {
  return (
    <div className="rounded-md border border-slate-200 bg-white p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-slate-900 tabular-nums">{value}</p>
    </div>
  )
}

export function CampaignPerformanceSummary({ detail }: CampaignPerformanceSummaryProps) {
  return (
    <section>
      <h2 className="mb-3 text-sm font-semibold text-slate-900">Performance</h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <MetricCard label="Leads Generated" value={detail.leads_generated} />
        <MetricCard label="Qualified" value={detail.qualified_leads} />
        <MetricCard label="Screened" value={detail.screened_count} />
        <MetricCard label="Randomized" value={detail.randomized_subjects} />
      </div>
    </section>
  )
}
