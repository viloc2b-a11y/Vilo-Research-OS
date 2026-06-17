import type { RecruitmentForecast } from '@/lib/crm/recruitment-forecast'
import type { RecruitmentFunnelSummary } from '@/lib/crm/recruitment-intelligence'
import type { SiteBenchmarkReport, BenchmarkScore } from '@/lib/benchmarking/score-against-benchmark'
import { RecruitmentForecastSummary } from './RecruitmentForecastSummary'

type StudyForecastEntry = {
  studyId: string
  studyName?: string
  forecast: RecruitmentForecast
}

type PortfolioRecruitmentSummaryProps = {
  forecasts: StudyForecastEntry[]
  funnelSummary: RecruitmentFunnelSummary
  benchmarkReport: SiteBenchmarkReport | null
}

const TIER_BADGE: Record<BenchmarkScore['tier'], { label: string; className: string }> = {
  top_quartile: { label: 'Top quartile', className: 'bg-teal-100 text-teal-800' },
  median: { label: 'Median', className: 'bg-amber-100 text-amber-800' },
  bottom_quartile: { label: 'Bottom quartile', className: 'bg-red-100 text-red-800' },
}

function BenchmarkScoreBadge({ score }: { score: BenchmarkScore }) {
  const config = TIER_BADGE[score.tier]
  return (
    <div className="flex items-center justify-between gap-3 rounded-md border border-slate-100 bg-slate-50 px-3 py-2">
      <span className="text-xs text-slate-600">{score.label}</span>
      <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${config.className}`}>
        {config.label}
      </span>
    </div>
  )
}

export function PortfolioRecruitmentSummary({
  forecasts,
  funnelSummary,
  benchmarkReport,
}: PortfolioRecruitmentSummaryProps) {
  const onTrackCount = forecasts.filter(
    (f) => f.forecast.risk_classification === 'on_track',
  ).length

  const atRiskCount = forecasts.filter(
    (f) =>
      f.forecast.risk_classification === 'at_risk' ||
      f.forecast.risk_classification === 'critical',
  ).length

  // Use the qualified stage count as a proxy for total qualified pipeline
  const qualifiedStage = funnelSummary.stages.find((s) => s.stage === 'qualified')
  const totalQualifiedPipeline = qualifiedStage?.count ?? 0

  const summaryItems = [
    { label: 'Studies recruiting', value: forecasts.length },
    { label: 'On track', value: onTrackCount },
    { label: 'At risk', value: atRiskCount },
    { label: 'Total qualified pipeline', value: totalQualifiedPipeline },
  ]

  // Benchmark scores relevant to recruitment
  const recruitmentBenchmarkScores = benchmarkReport?.scores.filter(
    (s) => s.category === 'enrollment_rate' || s.category === 'screen_failure_rate',
  ) ?? []

  return (
    <section className="rounded-md border border-slate-200 bg-white p-5">
      <h2 className="text-sm font-semibold text-slate-900">Portfolio Recruitment</h2>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {summaryItems.map(({ label, value }) => (
          <div key={label} className="rounded-md border border-slate-100 bg-slate-50 p-3 text-center">
            <p className="text-xs font-medium text-slate-500">{label}</p>
            <p className="mt-1 text-2xl font-semibold text-slate-900">{value}</p>
          </div>
        ))}
      </div>

      {forecasts.length === 0 ? (
        <div className="mt-4 rounded-md border border-dashed border-slate-300 p-6 text-sm text-slate-500">
          No active study recruitment data
        </div>
      ) : (
        <div className="mt-4 space-y-2">
          {forecasts.map((entry) => (
            <RecruitmentForecastSummary
              key={entry.studyId}
              forecast={entry.forecast}
              studyName={entry.studyName}
            />
          ))}
        </div>
      )}

      {recruitmentBenchmarkScores.length > 0 ? (
        <div className="mt-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Site vs Benchmark
          </p>
          <div className="mt-2 space-y-2">
            {recruitmentBenchmarkScores.map((score) => (
              <BenchmarkScoreBadge key={score.category} score={score} />
            ))}
          </div>
        </div>
      ) : null}
    </section>
  )
}
