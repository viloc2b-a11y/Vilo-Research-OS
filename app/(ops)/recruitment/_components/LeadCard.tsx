import type { RecruitmentLeadSummary } from '@/lib/crm/recruitment-loaders'
import type { ScoreTier } from '@/app/(ops)/recruitment/_lib/recruitment-view-model'

const STAGE_CLASS: Record<string, string> = {
  lead: 'border-slate-200 bg-slate-50 text-slate-600',
  contacted: 'border-blue-200 bg-blue-50 text-blue-700',
  pre_screen: 'border-violet-200 bg-violet-50 text-violet-700',
  qualified: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  scheduled: 'border-amber-200 bg-amber-50 text-amber-700',
  randomized: 'border-teal-200 bg-teal-50 text-teal-700',
}

const TIER_CLASS: Record<ScoreTier, string> = {
  high: 'border-red-200 bg-red-50 text-red-700',
  medium: 'border-amber-200 bg-amber-50 text-amber-700',
  waitlist: 'border-slate-200 bg-slate-50 text-slate-600',
}

export function LeadCard({
  lead,
  tier,
  compact = false,
}: {
  lead: RecruitmentLeadSummary
  tier?: ScoreTier
  compact?: boolean
}) {
  return (
    <article className="rounded-md border border-slate-200 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">{lead.full_name}</h3>
          <p className="mt-1 text-xs text-slate-500">
            {lead.email ?? 'No email'} · {lead.phone || 'No phone'}
          </p>
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          {tier ? (
            <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold capitalize ${TIER_CLASS[tier]}`}>
              {tier}
            </span>
          ) : null}
          <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${STAGE_CLASS[lead.stage] ?? STAGE_CLASS.lead}`}>
            {lead.stage.replaceAll('_', ' ')}
          </span>
        </div>
      </div>

      <dl className={`mt-4 grid gap-3 text-sm ${compact ? 'grid-cols-2' : 'md:grid-cols-3'}`}>
        <Field label="Score" value={lead.prescreen_score?.toString() ?? 'Not scored'} />
        <Field label="Campaign" value={lead.campaign_id ?? 'Unattributed'} />
        <Field label="Source" value={lead.recruitment_source_channel ?? 'Unknown'} />
        <Field label="Assigned user" value={lead.assigned_user_id ?? 'Unassigned'} />
        <Field label="Last contact" value={formatDateTime(lead.last_contacted_at)} />
        <Field label="Attempts" value={lead.contact_attempts.toString()} />
      </dl>
    </article>
  )
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="mt-1 truncate text-slate-800" title={value}>{value}</dd>
    </div>
  )
}

function formatDateTime(value: string | null): string {
  if (!value) return 'Never'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Unknown'
  return date.toLocaleString()
}
