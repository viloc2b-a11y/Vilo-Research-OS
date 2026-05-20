export {
  loadSourceDefinitionResolutionContext,
  type SourceDefinitionResolutionContext,
} from '@/lib/source-engine/resolution/load-resolution-context'

export {
  getFallbackGenericMetrics,
  getFallbackGenericRules,
  getFallbackGenericTemplate,
  getMetricsForRegistryTemplate,
  getRulesForRegistryTemplate,
  getTemplateByRegistryId,
  isRegistryTemplateId,
  REGISTRY_TEMPLATE_IDS,
  resolveRegistryIdFromTemplateKey,
  STUDY_SOURCE_ENGINE_BINDINGS,
  type RegistryTemplateId,
} from '@/lib/source-engine/resolution/template-registry'

export {
  resolveSourceEngineMetricsForProcedure,
  resolveSourceEngineRulesForProcedure,
  resolveSourceEngineRuntimeConfig,
  resolveSourceEngineRuntimeConfigFromContext,
  resolveSourceEngineTemplateForProcedure,
  type SourceEngineProcedureRef,
  type SourceEngineResolution,
  type SourceEngineRuntimeConfig,
  type TemplateResolutionSource,
} from '@/lib/source-engine/resolution/source-template-resolver'
