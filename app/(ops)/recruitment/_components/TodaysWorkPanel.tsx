import { LeadCard } from '@/app/(ops)/recruitment/_components/LeadCard'
import type { RecruitmentWorkItem } from '@/app/(ops)/recruitment/_lib/recruitment-view-model'

const REASON_LABELS: Record<RecruitmentWorkItem['reasons'][number], string> = {
  overdue_followup: 'Overdue follow-up',
  due_today: 'Due today',
  high_score_uncontacted: 'High score, uncontacted',
  upcoming_screening: 'Upcoming screening',
  stalled: 'Stalled',
}

export function TodaysWorkPanel({
  items,
  organizationId,
  canInteract,
}: {
  items: RecruitmentWorkItem[]
  organizationId: string
  canInteract: boolean
}) {
  return (
    <section className="rounded-md border border-slate-200 bg-white p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">Today&apos;s Work</h2>
          <p className="mt-1 text-sm text-slate-600">
            Overdue follow-ups, due-today work, high-score uncontacted leads, screenings, and stalled leads.
          </p>
        </div>
        <span className="rounded-full bg-teal-50 px-3 py-1 text-xs font-semibold text-teal-700">
          {items.length} items
        </span>
      </div>

      <div className="mt-4 space-y-3">
        {items.map((item) => (
          <div key={item.lead.id} className="rounded-md border border-slate-200 bg-slate-50 p-3">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-slate-900 px-2 py-0.5 text-xs font-semibold text-white">
                Priority {item.priority}
              </span>
              {item.daysOverdue !== null ? (
                <span className="rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-xs font-semibold text-red-700">
                  {item.daysOverdue}d overdue
                </span>
              ) : null}
              {item.reasons.map((reason) => (
                <span key={reason} className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-xs text-slate-600">
                  {REASON_LABELS[reason]}
                </span>
              ))}
            </div>
            <LeadCard lead={item.lead} organizationId={organizationId} compact canInteract={canInteract} />
          </div>
        ))}
        {items.length === 0 ? (
          <div className="rounded-md border border-dashed border-slate-300 p-6 text-sm text-slate-500">
            No recruitment work requires attention right now.
          </div>
        ) : null}
      </div>
    </section>
  )
}
