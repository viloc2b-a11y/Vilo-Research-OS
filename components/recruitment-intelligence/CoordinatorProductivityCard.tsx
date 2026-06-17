import type { CoordinatorRecruitmentStats } from '@/lib/crm/coordinator-recruitment-stats'

type CoordinatorProductivityCardProps = {
  stats: CoordinatorRecruitmentStats
}

export function CoordinatorProductivityCard({ stats }: CoordinatorProductivityCardProps) {
  if (stats.leads_assigned === 0) {
    return (
      <section className="rounded-md border border-slate-200 bg-white p-5">
        <h2 className="text-sm font-semibold text-slate-900">
          Your Recruitment Activity{' '}
          <span className="text-xs font-normal text-slate-500">(last 30 days)</span>
        </h2>
        <div className="mt-4 rounded-md border border-dashed border-slate-300 p-6 text-sm text-slate-500">
          No leads assigned yet
        </div>
      </section>
    )
  }

  const metrics: { label: string; value: number }[] = [
    { label: 'Leads assigned', value: stats.leads_assigned },
    { label: 'Leads advanced', value: stats.leads_advanced_in_period },
    { label: 'Pre-screens', value: stats.pre_screens_completed },
    { label: 'Qualified', value: stats.qualified_in_period },
  ]

  return (
    <section className="rounded-md border border-slate-200 bg-white p-5">
      <h2 className="text-sm font-semibold text-slate-900">
        Your Recruitment Activity{' '}
        <span className="text-xs font-normal text-slate-500">(last 30 days)</span>
      </h2>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {metrics.map(({ label, value }) => (
          <div key={label} className="rounded-md border border-slate-100 bg-slate-50 p-3 text-center">
            <p className="text-xs font-medium text-slate-500">{label}</p>
            <p className="mt-1 text-2xl font-semibold text-slate-900">{value}</p>
          </div>
        ))}
      </div>

      <p className="mt-3 text-xs text-slate-600">
        Conversion rate:{' '}
        <span className="font-semibold text-slate-900">
          {(stats.conversion_rate * 100).toFixed(1)}%
        </span>
      </p>
    </section>
  )
}
