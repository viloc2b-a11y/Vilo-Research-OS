/**
 * Phase 3D — Resolve Source Engine templates from published source definitions.
 *
 * Priority:
 * A. Published binding (SDV meta / validation manifest / published provenance)
 * B. Study-specific registry (definition code heuristics + study bindings)
 * C. Generic dev fallback (degraded, no signature enforcement)
 */

import {
  DEFAULT_SIGNATURE_POLICY,
  type SignaturePolicy,
} from '@/lib/source-engine/audit/signature-policy'
import type {
  DerivedMetricDefinition,
  RuleDefinition,
  SourceTemplateDefinition,
} from '@/lib/source-engine/definitions/types'
import {
  loadSourceDefinitionResolutionContext,
  type SourceDefinitionResolutionContext,
} from '@/lib/source-engine/resolution/load-resolution-context'
import {
  getFallbackGenericMetrics,
  getFallbackGenericRules,
  getFallbackGenericTemplate,
  getMetricsForRegistryTemplate,
  getRulesForRegistryTemplate,
  getTemplateByRegistryId,
  isRegistryTemplateId,
  resolveRegistryIdFromTemplateKey,
  STUDY_SOURCE_ENGINE_BINDINGS,
  type RegistryTemplateId,
} from '@/lib/source-engine/resolution/template-registry'

const TEMPLATE_META_KEYS = [
  'source_engine_template_id',
  'engine_template_key',
  'sourceEngineTemplateId',
] as const

export type TemplateResolutionSource = 'published' | 'registry' | 'fallback'

export type SourceEngineResolution = {
  source: TemplateResolutionSource
  templateId: string
  registryTemplateId: RegistryTemplateId | null
  sourceDefinitionVersionId: string | null
  publishedPackageId: string | null
  definitionCode: string | null
  degraded: boolean
  fallback: boolean
  warning: string | null
  /** Dev fallback only — allow task materialization when explicitly set in SDV meta. */
  allowTaskMaterialization?: boolean
}

export type SourceEngineRuntimeConfig = {
  template: SourceTemplateDefinition
  rules: RuleDefinition[]
  metrics: DerivedMetricDefinition[]
  signaturePolicy: SignaturePolicy
  resolution: SourceEngineResolution
  /** When false, signature gate ignores blocksSignature findings (fallback/dev). */
  enforceSignatureBlockers: boolean
}

export type SourceEngineProcedureRef = {
  procedureExecutionId: string
  sourceDefinitionVersionId: string
  organizationId: string
  studyId: string
}

function normalizeTemplateKey(raw: string): string {
  return raw.trim()
}

function readBooleanMeta(obj: Record<string, unknown> | null, key: string): boolean {
  if (!obj) return false
  const value = obj[key]
  return value === true || value === 'true' || value === 1
}

function readTemplateKeyFromObject(obj: Record<string, unknown> | null): string | null {
  if (!obj) return null
  for (const key of TEMPLATE_META_KEYS) {
    const value = obj[key]
    if (typeof value === 'string' && value.trim()) {
      return normalizeTemplateKey(value)
    }
  }
  const engine = obj.source_engine
  if (engine && typeof engine === 'object' && !Array.isArray(engine)) {
    const nested = engine as Record<string, unknown>
    for (const key of TEMPLATE_META_KEYS) {
      const value = nested[key]
      if (typeof value === 'string' && value.trim()) {
        return normalizeTemplateKey(value)
      }
    }
  }
  return null
}

function resolveRegistryKeyFromDefinitionCode(code: string): RegistryTemplateId | null {
  const c = code.toUpperCase()
  if (c.includes('BIOSPECIMEN') || c.includes('PK_SAMPLE') || c.includes('SPECIMEN')) {
    return 'GENERIC_BIOSPECIMEN_COLLECTION_TEMPLATE'
  }
  if (c.includes('RESPIRATORY') || c.includes('SPIRO') || c.includes('PULM')) {
    return 'GENERIC_RESPIRATORY_PHASE3_TEMPLATE'
  }
  if (
    c.includes('IMMUNO') ||
    c.includes('ENDOCRINE') ||
    c.includes('OA') ||
    c.includes('VITAL')
  ) {
    return 'GENERIC_OA_PHASE3_TEMPLATE'
  }
  return null
}

/** Published SDV with package — bind executable registry template (not dev fallback). */
function resolvePublishedExecutableRegistry(
  ctx: SourceDefinitionResolutionContext,
): RegistryTemplateId | null {
  const isPublished =
    ctx.lifecycleStatus === 'published'
    || ctx.publishedSourceStatus != null
    || Boolean(ctx.publishedPackageId)
    || Boolean(ctx.meta?.package_id)

  if (!isPublished || ctx.publishedFieldKeys.length === 0) {
    return null
  }

  const registryIds: RegistryTemplateId[] = [
    'GENERIC_OA_PHASE3_TEMPLATE',
    'GENERIC_RESPIRATORY_PHASE3_TEMPLATE',
    'GENERIC_BIOSPECIMEN_COLLECTION_TEMPLATE',
  ]

  let best: { id: RegistryTemplateId; score: number } | null = null
  const publishedSet = new Set(ctx.publishedFieldKeys)

  for (const registryId of registryIds) {
    const template = getTemplateByRegistryId(registryId)
    if (!template) continue
    const templateKeys = new Set(template.fields.map((f) => f.id))
    let overlap = 0
    for (const key of publishedSet) {
      if (templateKeys.has(key)) overlap += 1
    }
    if (!best || overlap > best.score) {
      best = { id: registryId, score: overlap }
    }
  }

  if (best && best.score >= 2) {
    return best.id
  }

  // Phase 2 validation / visit-template SDVs (e.g. definition code D1) still need executable runtime.
  if (ctx.publishedPackageId || ctx.meta?.package_id) {
    return 'GENERIC_OA_PHASE3_TEMPLATE'
  }

  return null
}

function extractPublishedTemplateKey(
  ctx: SourceDefinitionResolutionContext,
): string | null {
  const fromMeta = readTemplateKeyFromObject(ctx.meta)
  if (fromMeta) return fromMeta

  const manifestObj =
    ctx.validationRulesManifest &&
    typeof ctx.validationRulesManifest === 'object' &&
    !Array.isArray(ctx.validationRulesManifest)
      ? (ctx.validationRulesManifest as Record<string, unknown>)
      : null
  const fromManifest = readTemplateKeyFromObject(manifestObj)
  if (fromManifest) return fromManifest

  if (ctx.publishedProvenance) {
    const fromProv = readTemplateKeyFromObject(ctx.publishedProvenance)
    if (fromProv) return fromProv
    for (const hintKey of ['module_code', 'study_template_id', 'domain_module']) {
      const hint = ctx.publishedProvenance[hintKey]
      if (typeof hint === 'string' && hint.trim()) {
        const mapped = resolveRegistryIdFromTemplateKey(hint)
        if (mapped) return mapped
      }
    }
  }

  return null
}

function readAllowTaskMaterializationOnFallback(
  ctx: SourceDefinitionResolutionContext,
): boolean {
  return (
    readBooleanMeta(ctx.meta, 'source_engine_allow_tasks_on_fallback') ||
    readBooleanMeta(ctx.meta, 'allow_task_materialization_on_fallback')
  )
}

function buildConfigFromRegistry(
  registryId: RegistryTemplateId,
  resolution: Omit<SourceEngineResolution, 'templateId' | 'registryTemplateId'>,
): SourceEngineRuntimeConfig {
  const template = getTemplateByRegistryId(registryId)!
  return {
    template,
    rules: getRulesForRegistryTemplate(registryId),
    metrics: getMetricsForRegistryTemplate(registryId),
    signaturePolicy: DEFAULT_SIGNATURE_POLICY,
    resolution: {
      ...resolution,
      templateId: template.id,
      registryTemplateId: registryId,
    },
    enforceSignatureBlockers: true,
  }
}

function buildFallbackConfig(
  ctx: SourceDefinitionResolutionContext | null,
  warning: string,
): SourceEngineRuntimeConfig {
  const template = getFallbackGenericTemplate()
  console.warn(`[source-engine] ${warning}`)
  return {
    template,
    rules: getFallbackGenericRules(),
    metrics: getFallbackGenericMetrics(),
    signaturePolicy: DEFAULT_SIGNATURE_POLICY,
    resolution: {
      source: 'fallback',
      templateId: template.id,
      registryTemplateId: 'GENERIC_OA_PHASE3_TEMPLATE',
      sourceDefinitionVersionId: ctx?.sourceDefinitionVersionId ?? null,
      publishedPackageId: ctx?.publishedPackageId ?? null,
      definitionCode: ctx?.definitionCode ?? null,
      degraded: true,
      fallback: true,
      warning,
      allowTaskMaterialization: ctx ? readAllowTaskMaterializationOnFallback(ctx) : false,
    },
    enforceSignatureBlockers: false,
  }
}

export function resolveSourceEngineTemplateForProcedure(
  ctx: SourceDefinitionResolutionContext,
): { template: SourceTemplateDefinition; resolution: SourceEngineResolution } {
  const publishedRegistry = resolvePublishedExecutableRegistry(ctx)
  if (publishedRegistry) {
    const config = buildConfigFromRegistry(publishedRegistry, {
      source: 'published',
      sourceDefinitionVersionId: ctx.sourceDefinitionVersionId,
      publishedPackageId: ctx.publishedPackageId,
      definitionCode: ctx.definitionCode,
      degraded: false,
      fallback: false,
      warning: null,
    })
    return { template: config.template, resolution: config.resolution }
  }

  const publishedKey = extractPublishedTemplateKey(ctx)
  if (publishedKey) {
    const registryId = resolveRegistryIdFromTemplateKey(publishedKey)
    if (registryId) {
      const config = buildConfigFromRegistry(registryId, {
        source: 'published',
        sourceDefinitionVersionId: ctx.sourceDefinitionVersionId,
        publishedPackageId: ctx.publishedPackageId,
        definitionCode: ctx.definitionCode,
        degraded: false,
        fallback: false,
        warning: null,
      })
      return { template: config.template, resolution: config.resolution }
    }
  }

  const studyBinding = STUDY_SOURCE_ENGINE_BINDINGS[ctx.studyId]
  if (studyBinding && isRegistryTemplateId(studyBinding)) {
    const config = buildConfigFromRegistry(studyBinding, {
      source: 'registry',
      sourceDefinitionVersionId: ctx.sourceDefinitionVersionId,
      publishedPackageId: ctx.publishedPackageId,
      definitionCode: ctx.definitionCode,
      degraded: false,
      fallback: false,
      warning: null,
    })
    return { template: config.template, resolution: config.resolution }
  }

  const registryKey =
    resolveRegistryKeyFromDefinitionCode(ctx.definitionCode)
    ?? (ctx.definitionCode.toUpperCase() === 'D1' ? 'GENERIC_OA_PHASE3_TEMPLATE' : null)
  if (registryKey) {
    const config = buildConfigFromRegistry(registryKey, {
      source: 'registry',
      sourceDefinitionVersionId: ctx.sourceDefinitionVersionId,
      publishedPackageId: ctx.publishedPackageId,
      definitionCode: ctx.definitionCode,
      degraded: false,
      fallback: false,
      warning: null,
    })
    return { template: config.template, resolution: config.resolution }
  }

  const fallback = buildFallbackConfig(
    ctx,
    'No published source-engine template binding; using generic dev fallback.',
  )
  return { template: fallback.template, resolution: fallback.resolution }
}

export function resolveSourceEngineRulesForProcedure(
  ctx: SourceDefinitionResolutionContext,
): RuleDefinition[] {
  return resolveSourceEngineRuntimeConfigFromContext(ctx).rules
}

export function resolveSourceEngineMetricsForProcedure(
  ctx: SourceDefinitionResolutionContext,
): DerivedMetricDefinition[] {
  return resolveSourceEngineRuntimeConfigFromContext(ctx).metrics
}

export function resolveSourceEngineRuntimeConfigFromContext(
  ctx: SourceDefinitionResolutionContext,
): SourceEngineRuntimeConfig {
  const { template, resolution } = resolveSourceEngineTemplateForProcedure(ctx)
  const registryId = resolution.registryTemplateId
  if (registryId && resolution.source !== 'fallback') {
    return buildConfigFromRegistry(registryId, {
      source: resolution.source,
      sourceDefinitionVersionId: resolution.sourceDefinitionVersionId,
      publishedPackageId: resolution.publishedPackageId,
      definitionCode: resolution.definitionCode,
      degraded: resolution.degraded,
      fallback: resolution.fallback,
      warning: resolution.warning,
    })
  }
  if (resolution.fallback) {
    return buildFallbackConfig(ctx, resolution.warning ?? 'Generic fallback template in use.')
  }
  return {
    template,
    rules: getFallbackGenericRules(),
    metrics: getFallbackGenericMetrics(),
    signaturePolicy: DEFAULT_SIGNATURE_POLICY,
    resolution,
    enforceSignatureBlockers: resolution.source === 'published',
  }
}

export async function resolveSourceEngineRuntimeConfig(
  ref: SourceEngineProcedureRef,
): Promise<SourceEngineRuntimeConfig> {
  if (!ref.sourceDefinitionVersionId?.trim()) {
    return buildFallbackConfig(
      null,
      'Missing sourceDefinitionVersionId; using generic dev fallback.',
    )
  }

  const ctx = await loadSourceDefinitionResolutionContext(ref.sourceDefinitionVersionId)
  if (!ctx) {
    return buildFallbackConfig(
      null,
      `Could not load source definition version ${ref.sourceDefinitionVersionId}; using generic dev fallback.`,
    )
  }

  return resolveSourceEngineRuntimeConfigFromContext(ctx)
}

export { getFallbackGenericTemplate } from '@/lib/source-engine/resolution/template-registry'
