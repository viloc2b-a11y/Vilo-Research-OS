import { EXTERNAL_BENCHMARKS, type BenchmarkCategory, type BenchmarkTier } from './external-benchmarks'

export type BenchmarkScore = {
  category: BenchmarkCategory
  label: string
  unit: string
  siteValue: number
  tier: BenchmarkTier
  percentileEstimate: number
  vsMedian: number
  vsTopQuartile: number
  interpretation: 'outperforming' | 'on_target' | 'underperforming' | 'critical'
}

type SortDirection = 'higher_is_better' | 'lower_is_better'

const SORT_DIRECTION: Record<BenchmarkCategory, SortDirection> = {
  enrollment_rate: 'higher_is_better',
  screen_failure_rate: 'lower_is_better',
  visit_completion_rate: 'higher_is_better',
  data_query_rate: 'lower_is_better',
  deviation_rate: 'lower_is_better',
  protocol_compliance_rate: 'higher_is_better',
  site_activation_days: 'lower_is_better',
}

function tierFor(
  value: number,
  ref: { topQuartile: number; median: number; bottomQuartile: number },
  direction: SortDirection,
): BenchmarkTier {
  if (direction === 'higher_is_better') {
    if (value >= ref.topQuartile) return 'top_quartile'
    if (value >= ref.median) return 'median'
    return 'bottom_quartile'
  } else {
    if (value <= ref.topQuartile) return 'top_quartile'
    if (value <= ref.median) return 'median'
    return 'bottom_quartile'
  }
}

function percentileEstimate(tier: BenchmarkTier): number {
  if (tier === 'top_quartile') return 82
  if (tier === 'median') return 50
  return 18
}

function interpretation(tier: BenchmarkTier, category: BenchmarkCategory): BenchmarkScore['interpretation'] {
  if (tier === 'top_quartile') return 'outperforming'
  if (tier === 'median') return 'on_target'
  if (category === 'deviation_rate' || category === 'screen_failure_rate') return 'critical'
  return 'underperforming'
}

export function scoreAgainstBenchmark(
  category: BenchmarkCategory,
  siteValue: number,
): BenchmarkScore {
  const ref = EXTERNAL_BENCHMARKS[category]
  const direction = SORT_DIRECTION[category]
  const tier = tierFor(siteValue, ref, direction)
  const pct = percentileEstimate(tier)
  const vsMedian = direction === 'higher_is_better'
    ? ((siteValue - ref.median) / ref.median) * 100
    : ((ref.median - siteValue) / ref.median) * 100
  const vsTopQuartile = direction === 'higher_is_better'
    ? ((siteValue - ref.topQuartile) / ref.topQuartile) * 100
    : ((ref.topQuartile - siteValue) / ref.topQuartile) * 100

  return {
    category,
    label: ref.label,
    unit: ref.unit,
    siteValue,
    tier,
    percentileEstimate: pct,
    vsMedian: Math.round(vsMedian * 10) / 10,
    vsTopQuartile: Math.round(vsTopQuartile * 10) / 10,
    interpretation: interpretation(tier, category),
  }
}

export type SiteBenchmarkInput = Partial<Record<BenchmarkCategory, number>>

export type SiteBenchmarkReport = {
  scores: BenchmarkScore[]
  overallTier: BenchmarkTier
  categoriesScored: number
  outperforming: number
  onTarget: number
  underperforming: number
  critical: number
}

export function buildSiteBenchmarkReport(input: SiteBenchmarkInput): SiteBenchmarkReport {
  const scores: BenchmarkScore[] = []

  for (const [category, value] of Object.entries(input) as [BenchmarkCategory, number][]) {
    if (value != null && !isNaN(value)) {
      scores.push(scoreAgainstBenchmark(category, value))
    }
  }

  const outperforming = scores.filter((s) => s.interpretation === 'outperforming').length
  const onTarget = scores.filter((s) => s.interpretation === 'on_target').length
  const underperforming = scores.filter((s) => s.interpretation === 'underperforming').length
  const critical = scores.filter((s) => s.interpretation === 'critical').length

  const topCount = scores.filter((s) => s.tier === 'top_quartile').length
  const midCount = scores.filter((s) => s.tier === 'median').length
  const overallTier: BenchmarkTier =
    topCount > scores.length / 2
      ? 'top_quartile'
      : midCount + topCount > scores.length / 2
        ? 'median'
        : 'bottom_quartile'

  return {
    scores,
    overallTier,
    categoriesScored: scores.length,
    outperforming,
    onTarget,
    underperforming,
    critical,
  }
}
