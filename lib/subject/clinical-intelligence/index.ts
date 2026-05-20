// lib/subject/clinical-intelligence/index.ts
// Phase 6D — Public barrel for the Longitudinal Clinical Intelligence Layer.
//
// Import from this barrel for all Phase 6D consumers:
//   import { buildLongitudinalProfile, buildRiskFlags, ... } from '@/lib/subject/clinical-intelligence'
//
// Do NOT import from individual module files in application code —
// the barrel ensures stable import paths across refactors.

// Types
export type {
  LongitudinalClinicalProfile,
  ClinicalTimelineEvent,
  ClinicalTimelineEventType,
  ClinicalEntityType,
  ClinicalRiskFlag,
  RiskFlagSeverity,
  MedicationWindow,
  MedicationWindowOverlap,
  NormalizedConditionStatus,
  ProtocolCriterion,
  ProtocolCriterionType,
  ProtocolExclusionResult,
} from './types'

// Main aggregator
export { buildLongitudinalProfile, normalizeConditionStatus } from './build-longitudinal-profile'

// Timeline
export { buildTimeline } from './timeline'

// Risk flags
export { buildRiskFlags, hasCriticalFlags } from './risk-flags'

// Medication temporal utilities
export {
  buildMedicationWindows,
  activeAtDate,
  activeNow,
  findOverlappingPairs,
  doWindowsOverlap,
  windowsForDrugClass,
  windowsForMedicationName,
} from './medication-conflicts'

// Protocol hook factories + runner
export {
  hasExclusionaryCondition,
  hasProhibitedMedication,
  hasConflictingSurgery,
  hasRiskFactor,
  evaluateCriteria,
  findMatchedExclusions,
} from './protocol-hooks'
