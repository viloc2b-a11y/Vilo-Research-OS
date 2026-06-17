import type { RecruitmentForecast } from '@/lib/crm/recruitment-forecast'
import { ForecastRiskBadge } from './ForecastRiskBadge'

const INF_SENTINEL = 9999

type RecruitmentForecastSummaryProps = {
  forecast: RecruitmentForecast
  studyName?: string
}

export function RecruitmentForecastSummary({ forecast, studyName }: RecruitmentForecastSummaryProps) {
  return (
    <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
      {studyName ? (
        <p className="mb-2 text-xs font-semibold text-slate-700">{studyName}</p>
      ) : null}
      <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600">
        <ForecastRiskBadge risk={forecast.risk_classification} />
        <span>
          Projected:{' '}
          <span className="font-semibold text-slate-900">
            {forecast.projected_enrollment_date ?? '—'}
          </span>
        </span>
        <span>
          Remaining:{' '}
          <span className="font-semibold text-slate-900">{forecast.subjects_remaining}</span>
        </span>
        <span>
          Leads needed:{' '}
          <span className="font-semibold text-slate-900">
            {forecast.leads_required >= INF_SENTINEL ? '—' : forecast.leads_required}
          </span>
        </span>
      </div>
    </div>
  )
}
