import type { CampaignDetail } from '@/lib/crm/campaign-management'

type CampaignPerformanceSummaryProps = {
  detail: CampaignDetail
  canViewBudget: boolean
}

type MetricCardProps = {
  label: string
  value: string | number
}

function MetricCard({ label, value }: MetricCardProps) {
  return (
    <div className="rounded-md border border-slate-200 bg-white p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-slate-900 tabular-nums">{value}</p>
    </div>
  )
}

function formatCurrency(value: number | null): string {
  if (value === null) return '—'
  return value.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  })
}

function formatRate(value: number | null): string {
  if (value === null) return '—'
  return `${(value * 100).toFixed(1)}%`
}

export function CampaignPerformanceSummary({ detail, canViewBudget }: CampaignPerformanceSummaryProps) {
  return (
    <section>
      <h2 className="mb-3 text-sm font-semibold text-slate-900">Performance</h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <MetricCard label="Leads Generated" value={detail.leads_generated} />
        <MetricCard label="Qualified" value={detail.qualified_leads} />
        <MetricCard label="Screened" value={detail.screened_count} />
        <MetricCard label="Randomized" value={detail.randomized_subjects} />
      </div>

      {/* Cost intelligence row — budget-sensitive */}
      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <MetricCard
          label="Conversion Rate (Lead → Randomized)"
          value={formatRate(detail.lead_to_randomized_rate)}
        />
        {canViewBudget && (
          <>
            <MetricCard label="CPL (Cost Per Lead)" value={formatCurrency(detail.cost_per_lead)} />
            <MetricCard
              label="Cost Per Randomized"
              value={formatCurrency(detail.cost_per_randomized_subject)}
            />
          </>
        )}
      </div>
    </section>
  )
}
