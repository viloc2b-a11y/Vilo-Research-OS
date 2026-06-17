import type { RecruitmentFunnelSummary } from '@/lib/crm/recruitment-intelligence'
import { FunnelSnapshotCard } from './FunnelSnapshotCard'

type RecruitmentFunnelPanelProps = {
  funnel: RecruitmentFunnelSummary
}

export function RecruitmentFunnelPanel({ funnel }: RecruitmentFunnelPanelProps) {
  // Find two stages with highest drop-off (exclude first stage, which has no previous)
  const dropsWithStage = funnel.stages
    .slice(1) // skip the first stage (no previous to drop from)
    .map((s, index) => ({
      fromStage: funnel.stages[index].stage, // original index = index (since we sliced 1 off)
      toStage: s.stage,
      dropOff: s.drop_off_from_previous,
    }))
    .sort((a, b) => b.dropOff - a.dropOff)

  const topDrops = dropsWithStage.slice(0, 2)

  return (
    <section className="rounded-md border border-slate-200 bg-white p-5">
      <h2 className="text-sm font-semibold text-slate-900">Recruitment Funnel</h2>

      <div className="mt-4">
        <FunnelSnapshotCard {...funnel} />
      </div>

      {funnel.total_leads > 0 && topDrops.length > 0 ? (
        <div className="mt-3 space-y-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Highest drop-off</p>
          {topDrops.map((drop) => (
            <div
              key={`${drop.fromStage}-${drop.toStage}`}
              className="flex items-center gap-1.5 text-xs text-slate-700"
            >
              <span className="capitalize">{drop.fromStage.replaceAll('_', ' ')}</span>
              <span className="text-slate-400">→</span>
              <span className="capitalize">{drop.toStage.replaceAll('_', ' ')}</span>
              <span className="font-semibold text-red-600">(-{drop.dropOff} leads)</span>
            </div>
          ))}
        </div>
      ) : null}

      <p className="mt-3 text-xs text-slate-500">
        Overall conversion:{' '}
        <span className="font-semibold text-slate-900">
          {(funnel.overall_conversion_rate * 100).toFixed(1)}%
        </span>
      </p>
    </section>
  )
}
