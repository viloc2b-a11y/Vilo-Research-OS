import { LeadCard } from '@/app/(ops)/recruitment/_components/LeadCard'
import type { RecruitmentQueueItem, ScoreTier } from '@/app/(ops)/recruitment/_lib/recruitment-view-model'

const TIER_CLASS: Record<ScoreTier, string> = {
  high: 'border-red-200 bg-red-50 text-red-700',
  medium: 'border-amber-200 bg-amber-50 text-amber-700',
  waitlist: 'border-slate-200 bg-slate-50 text-slate-600',
}

export function RecruitmentQueue({
  items,
  organizationId,
  canInteract,
}: {
  items: RecruitmentQueueItem[]
  organizationId: string
  canInteract: boolean
}) {
  const counts = items.reduce<Record<ScoreTier, number>>(
    (acc, item) => {
      acc[item.tier] += 1
      return acc
    },
    { high: 0, medium: 0, waitlist: 0 },
  )

  return (
    <section className="rounded-md border border-slate-200 bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">Recruitment Queue</h2>
          <p className="mt-1 text-sm text-slate-600">
            Default visibility: assigned to me and unassigned leads. Coordinator actions stay inline in this workspace.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {(Object.keys(counts) as ScoreTier[]).map((tier) => (
            <span key={tier} className={`rounded-full border px-2.5 py-1 text-xs font-semibold capitalize ${TIER_CLASS[tier]}`}>
              {tier}: {counts[tier]}
            </span>
          ))}
        </div>
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        {items.map((item) => (
          <LeadCard key={item.lead.id} lead={item.lead} organizationId={organizationId} tier={item.tier} canInteract={canInteract} />
        ))}
        {items.length === 0 ? (
          <div className="rounded-md border border-dashed border-slate-300 p-6 text-sm text-slate-500 lg:col-span-2">
            No leads are visible in the current operational queue.
          </div>
        ) : null}
      </div>
    </section>
  )
}
