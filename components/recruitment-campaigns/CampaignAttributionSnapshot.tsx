import type { CampaignDetail } from '@/lib/crm/campaign-management'

type CampaignAttributionSnapshotProps = {
  detail: CampaignDetail
}

export function CampaignAttributionSnapshot({ detail }: CampaignAttributionSnapshotProps) {
  return (
    <section>
      <h2 className="mb-3 text-sm font-semibold text-slate-900">Attribution Snapshot</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        {/* Top UTM Sources */}
        <div className="rounded-md border border-slate-200 bg-white p-4">
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Top UTM Sources
          </h3>
          {detail.top_sources.length === 0 ? (
            <p className="text-sm text-slate-400">No source data available.</p>
          ) : (
            <ul className="space-y-2">
              {detail.top_sources.map((item, index) => (
                <li key={index} className="flex items-center justify-between text-sm">
                  <span className="text-slate-700">{item.utm_source ?? '(not set)'}</span>
                  <span className="tabular-nums font-semibold text-slate-900">{item.count}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Top UTM Mediums */}
        <div className="rounded-md border border-slate-200 bg-white p-4">
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Top UTM Mediums
          </h3>
          {detail.top_mediums.length === 0 ? (
            <p className="text-sm text-slate-400">No medium data available.</p>
          ) : (
            <ul className="space-y-2">
              {detail.top_mediums.map((item, index) => (
                <li key={index} className="flex items-center justify-between text-sm">
                  <span className="text-slate-700">{item.utm_medium ?? '(not set)'}</span>
                  <span className="tabular-nums font-semibold text-slate-900">{item.count}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  )
}
