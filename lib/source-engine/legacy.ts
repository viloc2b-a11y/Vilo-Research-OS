/**
 * Legacy source engine exports — prior capture/compiler integration.
 * Import from `@/lib/source-engine/legacy` when migrating off older APIs.
 */

export type * from '@/lib/source-engine/types'

export {
  CLINICAL_DOMAIN_ORDER,
  CLINICAL_FIELD_CATALOG,
  ADRENAL_TESTING_FIELDS,
  DEMOGRAPHICS_FIELDS,
  HIT_MONITORING_FIELDS,
  PREGNANCY_TESTING_FIELDS,
  PK_SAMPLING_FIELDS,
  VITAL_SIGNS_FIELDS,
  getAllCatalogFields,
  getCatalogField,
  getCatalogFieldsByDomain,
  pickCatalogFields,
} from '@/lib/source-engine/config.library'

export {
  calculateDerivedValues,
  calculateSingleDerived,
  evaluateCondition,
  evaluateRequirement,
  evaluateTriggers,
  evaluateVisibility,
  getRuntimeFieldState,
  resolveEffectiveSections,
  validateField,
  validateSection,
  validateTemplate,
} from '@/lib/source-engine/engine.rules'

export {
  Domain,
  FieldType,
  QuerySeverity,
  SignatureState,
} from '@/lib/source-engine/canonical'

export type {
  BusinessRule,
  BusinessRuleResult,
  FieldSpec,
  FieldSpecValidation,
  TriggerActionType,
  TriggerRule,
} from '@/lib/source-engine/canonical'

export {
  CLINICAL_DOMAIN_TO_CANONICAL,
  WIDGET_TO_CANONICAL_FIELD_TYPE,
  buildRuleContext,
  defaultSourcePath,
  getBySourcePath,
  setBySourcePath,
  sourceContextToRuleContext,
  toFieldSpec,
  toFieldSpecs,
} from '@/lib/source-engine/adapters'

export {
  applyTriggerRules,
  evaluateBusinessRules,
  evaluateFieldSpecConditional,
  querySeverityToLegacy,
  runCalculations,
  validateFieldSpec,
} from '@/lib/source-engine/engine.canonical'

export {
  VILO_FIELD_CATALOG,
  getViloCatalogField,
  getViloCatalogFieldsByDomain,
  pickViloCatalogFields,
} from '@/lib/source-engine/vilo-field-catalog'

export {
  BUSINESS_RULES,
  DYNAMIC_TRIGGERS,
  VILO_BUSINESS_RULES,
} from '@/lib/source-engine/vilo-dynamic-rules'

export {
  GENERIC_PHASE3_IMMUNOLOGY_LEGACY_BUSINESS_RULES,
  GENERIC_PHASE3_IMMUNOLOGY_LEGACY_DOMAIN_SET,
  GENERIC_PHASE3_IMMUNOLOGY_LEGACY_TRIGGER_RULES,
} from '@/lib/source-engine/rules.generic-phase3-immunology-legacy'

export {
  GENERIC_PHASE3_IMMUNOLOGY_LEGACY_ENGINE_CONFIG,
  GENERIC_PHASE3_IMMUNOLOGY_LEGACY_PILOT_SECTIONS,
  GENERIC_PHASE3_IMMUNOLOGY_LEGACY_PILOT_TEMPLATE,
  GENERIC_PHASE3_IMMUNOLOGY_LEGACY_PILOT_TRIGGERS,
} from '@/lib/source-engine/templates.generic-phase3-immunology-legacy'

export {
  CANONICAL_CLINICAL_LIBRARY_ID,
  CANONICAL_CLINICAL_LIBRARY_VERSION,
  CANONICAL_CONTROLLED_LISTS,
  CANONICAL_CORE_LIBRARY_CODES,
  CANONICAL_OVERLAY_LIBRARY_CODES,
  canonicalFieldsToFieldDefinitions,
  composeCanonicalLibraryFieldKeys,
  getAllCanonicalLibraryBlocks,
  getCanonicalLibraryBlock,
  getCanonicalLibraryFields,
  loadCanonicalClinicalLibraryDocument,
  reportCanonicalFieldKeyCollisions,
  resolveCanonicalClinicalDomain,
  runCanonicalClinicalLibrarySmokeTests,
} from '@/lib/source-engine/canonical-clinical-library'

export type {
  CanonicalClinicalField,
  CanonicalClinicalLibraryBlock,
  CanonicalClinicalLibraryDocument,
  CanonicalLibraryCollision,
  CanonicalLibrarySmokeResult,
} from '@/lib/source-engine/canonical-clinical-library'

export {
  SOURCE_COMPOSITION_CATALOG_VERSION,
  SOURCE_COMPOSITION_TEMPLATE_KEYS,
  buildCompositionPublishSnapshot,
  getCompositionManifest,
  listCompositionManifests,
  loadCompositionTemplatesCatalog,
  resolveSourceCompositionManifest,
} from '@/lib/source-engine/source-composition'

export { SourceCompositionResolveError } from '@/lib/source-engine/source-composition-resolver'

export type {
  CompositionPublishSnapshot,
  ResolvedCompositionFieldMeta,
  ResolvedSourceComposition,
  SourceCompositionManifest,
} from '@/lib/source-engine/source-composition'

export { runAllExamples } from '@/lib/source-engine/examples.runtime'
export { initViloEngine } from '@/lib/source-engine/init'
export type { ViloEngineInit } from '@/lib/source-engine/init'
