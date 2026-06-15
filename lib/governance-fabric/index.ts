export type { GovernanceSignal, GovernanceSignalType } from '@/lib/governance-fabric/types'
export { GOVERNANCE_DEVIATION_RULES_V1, ruleById } from '@/lib/governance-fabric/deviation-rules'
export { detectVisitGovernanceSignals } from '@/lib/governance-fabric/detect-deviations'
export {
  syncGovernanceSignalsForVisit,
  governanceSignalsToBlockers,
} from '@/lib/governance-fabric/signals'
export {
  createCapaPlaceholderForSignal,
  CAPA_PLACEHOLDER_ARCHITECTURE,
} from '@/lib/governance-fabric/capa-placeholder'
export { INSPECTION_REPLAY_READINESS } from '@/lib/governance-fabric/inspection-replay'
export { enrichVisitReadinessWithGovernanceFabric } from '@/lib/governance-fabric/integration/projection-bridge'
export {
  promoteGovernanceSignalToCapaCandidate,
  type PromoteGovernanceSignalResult,
} from '@/lib/governance-fabric/promote-to-capa'
