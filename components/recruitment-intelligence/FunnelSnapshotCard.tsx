import type { RecruitmentFunnelSummary } from '@/lib/crm/recruitment-intelligence'

const DISPLAY_STAGES = ['lead', 'qualified', 'screened', 'randomized'] as const

type FunnelSnapshotCardProps = RecruitmentFunnelSummary

export function FunnelSnapshotCard({
  stages,
  overall_conversion_rate,
}: FunnelSnapshotCardProps) {
  const displayedStages = DISPLAY_STAGES.map((key) => {
    const match = stages.find((s) => s.stage === key)
    return {
      stage: key,
      count: match?.count ?? 0,
      percent_of_entry: match?.percent_of_entry ?? 0,
    }
  })

  return (
    <div className="rounded-md border border-slate-200 bg-white p-4 shadow-sm">
      <h4 className="text-sm font-semibold text-slate-900">Recruitment Funnel</h4>

      <div className="mt-4 grid grid-cols-4 gap-2">
        {displayedStages.map((s, index) => (
          <div key={s.stage} className="text-center">
            <div className="relative">
              <div className="rounded border border-slate-100 bg-slate-50 px-2 py-3">
                <p className="text-xs font-medium capitalize text-slate-500">{s.stage}</p>
                <p className="mt-1 text-xl font-bold text-slate-900">{s.count}</p>
                <p className="mt-0.5 text-xs text-slate-400">
                  {(s.percent_of_entry * 100).toFixed(0)}%
                </p>
              </div>
              {index < displayedStages.length - 1 ? (
                <span className="absolute -right-1 top-1/2 -translate-y-1/2 text-xs text-slate-300">
                  →
                </span>
              ) : null}
            </div>
          </div>
        ))}
      </div>

      <p className="mt-3 text-xs text-slate-500">
        Overall conversion: {(overall_conversion_rate * 100).toFixed(1)}%
      </p>
    </div>
  )
}
