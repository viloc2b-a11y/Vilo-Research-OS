import type { PartnerDetail } from '@/lib/crm/partner-management'

type PartnerPerformanceSummaryProps = {
  detail: PartnerDetail
}

type MetricCardProps = {
  label: string
  value: number
}

function MetricCard({ label, value }: MetricCardProps) {
  return (
    <div className="rounded-md border border-slate-200 bg-white p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-slate-900">{value}</p>
    </div>
  )
}

export function PartnerPerformanceSummary({ detail }: PartnerPerformanceSummaryProps) {
  return (
    <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <MetricCard label="Linked Campaigns" value={detail.linked_campaign_count} />
      <MetricCard label="Total Leads" value={detail.total_leads} />
      <MetricCard label="Qualified" value={detail.qualified_leads} />
      <MetricCard label="Randomized" value={detail.randomized_subjects} />
    </section>
  )
}
