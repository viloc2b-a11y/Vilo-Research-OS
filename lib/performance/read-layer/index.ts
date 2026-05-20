export { resolveScope, toQueryScope } from './scope'
export { buildPerformanceReadModel, VPI_USE_RPC } from './aggregator'
export type { AggregatorMode, BuildPerformanceReadModelOptions } from './aggregator'
export { VPI_DASHBOARD_RPC_KEYS } from './rpc-dashboard'
export type { VpiDashboardPayload } from './rpc-dashboard'
export type {
  PerformanceScope,
  PerformanceQueryScope,
  PerformanceRole,
  PerformanceLoadStatus,
  PerformanceQueryError,
  RawSignal,
} from '@/lib/performance/types'
