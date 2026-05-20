export type {
  DerivedMetricDefinition,
  DerivedMetricId,
} from '@/lib/source-engine/definitions/types'

export type CalculationResult = {
  metricId: string
  targetFieldId: string
  value: unknown
}
