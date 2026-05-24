export { SPINE_ENFORCEMENT_STRATEGY } from '@/lib/runtime-integrity/enforcement-strategy'
export {
  CLINICAL_EXECUTION_TABLES,
  DERIVED_PROJECTION_TABLES,
  isClinicalExecutionTable,
  isDerivedProjectionTable,
} from '@/lib/runtime-integrity/clinical-tables'

export {
  normalizeOperationalEventType,
  LEGACY_EVENT_TYPE_ALIASES,
  collectRegistryDrift,
} from '@/lib/runtime-integrity/event-registry/normalize'

export {
  scanSourceForDirectMutations,
  scanDirectoryForDirectMutations,
  summarizeDirectMutationFindings,
  isApprovedMutationPath,
  type DirectMutationFinding,
} from '@/lib/runtime-integrity/detect/direct-mutation-scanner'

export {
  SILENT_MUTATION_PATCH_PLAN,
  catalogSummary,
  catalogEntriesByStatus,
  type SilentMutationCatalogEntry,
} from '@/lib/runtime-integrity/detect/silent-mutation-catalog'

export {
  checkVisitProjectionFreshness,
  checkSubjectProjectionFreshness,
  type ProjectionFreshnessIssue,
} from '@/lib/runtime-integrity/integrity/projection-freshness'

export {
  detectVisitReplayGaps,
  detectCataloguedReplayGaps,
  MUTATION_EVENT_EXPECTATIONS,
  type ReplayGap,
} from '@/lib/runtime-integrity/integrity/replay-gaps'

export {
  RPC_EMISSION_HARDENING_PLAN,
  RPC_EMISSION_PRINCIPLES,
} from '@/lib/runtime-integrity/integrity/rpc-emission-plan'

export { buildRuntimeIntegrityReport } from '@/lib/runtime-integrity/report/build-report'
export type { RuntimeIntegrityReport, RuntimeIntegrityScope } from '@/lib/runtime-integrity/report/types'
