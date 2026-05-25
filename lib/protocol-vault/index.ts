/**
 * Public protocol-vault API for runtime-safe study labels and alias maps.
 * Raw document field reads stay in raw-documents.ts (vault scope required).
 */

export {
  buildProtocolAliasMapFromRows,
  listStudyAliasMapsForStudy,
  loadProtocolAliasMapForStudy,
  loadStudyAliasMapsForStudies,
  resolveSafeAlias,
  upsertStudyAliasMapEntry,
  type UpsertStudyAliasInput,
} from '@/lib/protocol-vault/alias-map'

export {
  assertRuntimeObjectHasNoRawVaultFields,
  assertStudySafeDisplaySanitized,
  buildRuntimeSafeStudyLabel,
  RAW_VAULT_LEAK_FIELDS,
  stripRawVaultFieldsForRuntime,
} from '@/lib/protocol-vault/runtime-boundary'

export { registerRawDocument, type RegisterRawDocumentInput } from '@/lib/protocol-vault/raw-documents'

export { STUDY_DISPLAY_MODES } from '@/lib/protocol-vault/types'

export {
  DEFAULT_OPERATIONAL_DISPLAY_MODE,
  DEFAULT_SANITIZED_DISPLAY_MODE,
  isDemoSanitizedMode,
  resolveDisplayModeForContext,
  resolveOperationalDisplayMode,
  type StudyDisplayContext,
} from '@/lib/protocol-vault/display-policy'

export {
  buildOperationalStudyDisplayFromParts,
  buildSanitizedStudyDisplayFromParts,
  buildStudyDisplayFromParts,
  formatStudyDisplayLabel,
  getStudyDisplay,
  getStudyDisplayBatch,
  toStudySafeDisplay,
  type StudyDisplayPartsInput,
} from '@/lib/protocol-vault/study-display'

export {
  buildStudySafeDisplayFromParts,
  getStudySafeDisplay,
  getStudySafeDisplayBatch,
} from '@/lib/protocol-vault/study-safe-display'

export type {
  ProtocolRawDocumentRecord,
  RawDocumentRegistrySummary,
  RawDocumentStatus,
  StudyAliasMapRow,
  StudyAliasSource,
  StudyAliasTokenType,
  StudyDisplay,
  StudyDisplayMode,
  StudySafeDisplay,
} from '@/lib/protocol-vault/types'
