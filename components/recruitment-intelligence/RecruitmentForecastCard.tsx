import type { RecruitmentForecast } from '@/lib/crm/recruitment-forecast'
import { ForecastRiskBadge } from './ForecastRiskBadge'

const INF_SENTINEL = 9999

type RecruitmentForecastCardProps = RecruitmentForecast

export function RecruitmentForecastCard({
  subjects_remaining,
  projected_enrollment_date,
  required_run_rate,
  run_rate_gap,
  leads_required,
  current_pipeline_coverage,
  probability_of_hitting_target,
  risk_classification,
}: RecruitmentForecastCardProps) {
  const coveragePercent = Math.min(current_pipeline_coverage * 100, 200)
  const probabilityPercent = (probability_of_hitting_target * 100).toFixed(0)

  const gapPositive = run_rate_gap > 0
  const gapColor = gapPositive ? 'text-red-600' : 'text-teal-700'
  const gapLabel = gapPositive
    ? `+${run_rate_gap.toFixed(1)} subj/wk behind`
    : `${Math.abs(run_rate_gap).toFixed(1)} subj/wk ahead`

  return (
    <div className="rounded-md border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <h4 className="text-sm font-semibold text-slate-900">Recruitment Forecast</h4>
        <ForecastRiskBadge risk={risk_classification} />
      </div>

      <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
        <div className="rounded border border-slate-100 bg-slate-50 p-2.5">
          <dt className="text-xs text-slate-500">Projected completion</dt>
          <dd className="mt-0.5 font-semibold text-slate-900">
            {projected_enrollment_date ?? '—'}
          </dd>
        </div>

        <div className="rounded border border-slate-100 bg-slate-50 p-2.5">
          <dt className="text-xs text-slate-500">Subjects remaining</dt>
          <dd className="mt-0.5 font-semibold text-slate-900">{subjects_remaining}</dd>
        </div>

        <div className="rounded border border-slate-100 bg-slate-50 p-2.5">
          <dt className="text-xs text-slate-500">Required run rate</dt>
          <dd className="mt-0.5 font-semibold text-slate-900">
            {required_run_rate >= INF_SENTINEL ? '—' : `${required_run_rate.toFixed(1)} subj/wk`}
          </dd>
        </div>

        <div className="rounded border border-slate-100 bg-slate-50 p-2.5">
          <dt className="text-xs text-slate-500">Current vs required</dt>
          <dd className={`mt-0.5 font-semibold ${gapColor}`}>
            {run_rate_gap >= INF_SENTINEL || run_rate_gap <= -INF_SENTINEL ? '—' : gapLabel}
          </dd>
        </div>

        <div className="rounded border border-slate-100 bg-slate-50 p-2.5">
          <dt className="text-xs text-slate-500">Leads required</dt>
          <dd className="mt-0.5 font-semibold text-slate-900">
            {leads_required >= INF_SENTINEL ? '—' : leads_required}
          </dd>
        </div>

        <div className="rounded border border-slate-100 bg-slate-50 p-2.5">
          <dt className="text-xs text-slate-500">Pipeline coverage</dt>
          <dd className="mt-0.5 font-semibold text-slate-900">{coveragePercent.toFixed(0)}%</dd>
        </div>

        <div className="rounded border border-slate-100 bg-slate-50 p-2.5 sm:col-span-2">
          <dt className="text-xs text-slate-500">Probability of hitting target</dt>
          <dd className="mt-0.5 font-semibold text-slate-900">{probabilityPercent}%</dd>
        </div>
      </dl>
    </div>
  )
}
