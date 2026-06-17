import type { SourceEffectivenessReport } from '@/lib/crm/recruitment-intelligence'

type SourceEffectivenessCardProps = {
  report: SourceEffectivenessReport
}

export function SourceEffectivenessCard({ report }: SourceEffectivenessCardProps) {
  const topSources = [...report.sources]
    .sort((a, b) => b.total_leads - a.total_leads)
    .slice(0, 5)

  const totalAttributed = report.sources.reduce((sum, s) => sum + s.total_leads, 0)

  // Find any source with > 80% concentration
  const concentrationRisk = totalAttributed > 0
    ? report.sources.find((s) => s.total_leads / totalAttributed > 0.8)
    : null

  if (report.sources.length === 0) {
    return (
      <section className="rounded-md border border-slate-200 bg-white p-5">
        <h2 className="text-sm font-semibold text-slate-900">Source Effectiveness</h2>
        <div className="mt-4 rounded-md border border-dashed border-slate-300 p-6 text-sm text-slate-500">
          No attributed leads yet
        </div>
        {report.unattributed_count > 0 ? (
          <p className="mt-3 text-xs text-slate-500">
            Unattributed leads:{' '}
            <span className="font-semibold text-slate-700">{report.unattributed_count}</span>
          </p>
        ) : null}
      </section>
    )
  }

  return (
    <section className="rounded-md border border-slate-200 bg-white p-5">
      <h2 className="text-sm font-semibold text-slate-900">Source Effectiveness</h2>

      {concentrationRisk ? (
        <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          Source concentration risk:{' '}
          <span className="font-semibold">
            {((concentrationRisk.total_leads / totalAttributed) * 100).toFixed(0)}%
          </span>{' '}
          of leads from{' '}
          <span className="font-semibold">{concentrationRisk.source_channel}</span>
        </div>
      ) : null}

      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-slate-200 text-left">
              <th className="pb-2 pr-3 font-semibold uppercase tracking-wide text-slate-500">Source</th>
              <th className="pb-2 pr-3 text-right font-semibold uppercase tracking-wide text-slate-500">Leads</th>
              <th className="pb-2 pr-3 text-right font-semibold uppercase tracking-wide text-slate-500">Qualified</th>
              <th className="pb-2 pr-3 text-right font-semibold uppercase tracking-wide text-slate-500">Randomized</th>
              <th className="pb-2 text-right font-semibold uppercase tracking-wide text-slate-500">Conv. %</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {topSources.map((source) => (
              <tr key={source.source_channel} className="text-slate-700">
                <td className="py-2 pr-3 font-medium">{source.source_channel}</td>
                <td className="py-2 pr-3 text-right">{source.total_leads}</td>
                <td className="py-2 pr-3 text-right">{source.qualified}</td>
                <td className="py-2 pr-3 text-right">{source.randomized}</td>
                <td className="py-2 text-right">
                  {(source.lead_to_randomize_rate * 100).toFixed(1)}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {report.unattributed_count > 0 ? (
        <p className="mt-3 text-xs text-slate-500">
          Unattributed leads:{' '}
          <span className="font-semibold text-slate-700">{report.unattributed_count}</span>
        </p>
      ) : null}
    </section>
  )
}
