export type BenchmarkCategory =
  | 'enrollment_rate'
  | 'screen_failure_rate'
  | 'visit_completion_rate'
  | 'data_query_rate'
  | 'deviation_rate'
  | 'protocol_compliance_rate'
  | 'site_activation_days'

export type BenchmarkTier = 'top_quartile' | 'median' | 'bottom_quartile'

export type BenchmarkReference = {
  category: BenchmarkCategory
  label: string
  unit: string
  topQuartile: number
  median: number
  bottomQuartile: number
  source: string
}

// Industry reference values — CRO/regulatory public benchmarks (CISCRP, TransCelerate, FDA reporting)
export const EXTERNAL_BENCHMARKS: Record<BenchmarkCategory, BenchmarkReference> = {
  enrollment_rate: {
    category: 'enrollment_rate',
    label: 'Enrollment rate',
    unit: 'subjects/month',
    topQuartile: 4.5,
    median: 2.1,
    bottomQuartile: 0.8,
    source: 'TransCelerate 2023',
  },
  screen_failure_rate: {
    category: 'screen_failure_rate',
    label: 'Screen failure rate',
    unit: '%',
    topQuartile: 15,
    median: 32,
    bottomQuartile: 55,
    source: 'CISCRP 2022',
  },
  visit_completion_rate: {
    category: 'visit_completion_rate',
    label: 'Visit completion rate',
    unit: '%',
    topQuartile: 97,
    median: 91,
    bottomQuartile: 80,
    source: 'TransCelerate 2023',
  },
  data_query_rate: {
    category: 'data_query_rate',
    label: 'Data query rate',
    unit: 'queries per 1000 data points',
    topQuartile: 5,
    median: 18,
    bottomQuartile: 42,
    source: 'Medidata Rave Metrics 2022',
  },
  deviation_rate: {
    category: 'deviation_rate',
    label: 'Protocol deviation rate',
    unit: 'deviations per 100 visits',
    topQuartile: 2,
    median: 7,
    bottomQuartile: 18,
    source: 'FDA Warning Letter Analysis 2023',
  },
  protocol_compliance_rate: {
    category: 'protocol_compliance_rate',
    label: 'Protocol compliance rate',
    unit: '%',
    topQuartile: 98,
    median: 93,
    bottomQuartile: 82,
    source: 'TransCelerate 2023',
  },
  site_activation_days: {
    category: 'site_activation_days',
    label: 'Site activation time',
    unit: 'days',
    topQuartile: 45,
    median: 90,
    bottomQuartile: 180,
    source: 'CISCRP 2022',
  },
}

export function getBenchmark(category: BenchmarkCategory): BenchmarkReference {
  return EXTERNAL_BENCHMARKS[category]
}

export function getAllBenchmarks(): BenchmarkReference[] {
  return Object.values(EXTERNAL_BENCHMARKS)
}
