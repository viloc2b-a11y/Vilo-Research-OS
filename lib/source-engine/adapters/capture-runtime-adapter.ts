/**
 * Phase 2 — Thin bridge from procedure/source capture → source-engine runtime.
 * Phase 3D — Template resolution from published source definitions.
 */

import type { CaptureFieldViewModel } from '@/lib/source/capture/types'
import { calculateDerivedMetrics } from '@/lib/source-engine/calculators/calculation-engine'
import {
  DEFAULT_SIGNATURE_POLICY,
  type SignaturePolicy,
} from '@/lib/source-engine/audit/signature-policy'
import type {
  RuleDefinition,
  SourceTemplateDefinition,
} from '@/lib/source-engine/definitions/types'
import {
  bridgeFromProcedureCaptureContext,
  mapProcedureExecutionToRuntimeContext,
  type ProcedureCaptureBridge,
} from '@/lib/source-engine/adapters/procedure-runtime-adapter'
import {
  mapCaptureFieldsToEngineResponses,
  mapEngineValidationToCaptureErrors,
  type CaptureValidationError,
} from '@/lib/source-engine/adapters/source-response-adapter'
import type { RuntimeContext, SourceResponses } from '@/lib/source-engine/runtime/runtime-context'
import { resolveSourceRuntime } from '@/lib/source-engine/runtime/runtime-resolver'
import type { RuntimeEvaluationSnapshot } from '@/lib/source-engine/runtime/runtime-state'
import {
  getFallbackGenericMetrics,
  getFallbackGenericRules,
  getFallbackGenericTemplate,
} from '@/lib/source-engine/resolution/template-registry'
import type {
  SourceEngineResolution,
  SourceEngineRuntimeConfig,
} from '@/lib/source-engine/resolution/source-template-resolver'
import { validateForSignature, validateTemplate } from '@/lib/source-engine/validators/validation-engine'
import type { TemplateValidationSummary } from '@/lib/source-engine/validators/validation.types'

export type { SourceEngineResolution, SourceEngineRuntimeConfig }

export type ProcedureEngineRuntimeOptions = {
  template?: SourceTemplateDefinition
  rules?: RuleDefinition[]
  signaturePolicy?: SignaturePolicy
  /** Pre-resolved Phase 3D config (preferred for production paths). */
  runtimeConfig?: SourceEngineRuntimeConfig
}

export type SourceEngineSnapshotStatus = {
  resolution: SourceEngineResolution
  enforceSignatureBlockers: boolean
}

export type ProcedureSourceEngineSnapshot = {
  context: RuntimeContext
  responses: SourceResponses
  runtime: RuntimeEvaluationSnapshot
  derivedValues: Record<string, unknown>
  signaturePolicy: SignaturePolicy
  validationErrors: CaptureValidationError[]
  engineStatus: SourceEngineSnapshotStatus
}

function applySignatureEnforcement(
  errors: CaptureValidationError[],
  enforce: boolean,
): CaptureValidationError[] {
  if (enforce) return errors
  return errors.map((e) => ({ ...e, blocksSignature: false }))
}

function resolveOptions(options?: ProcedureEngineRuntimeOptions): {
  template: SourceTemplateDefinition
  rules: RuleDefinition[]
  metrics: ReturnType<typeof getFallbackGenericMetrics>
  signaturePolicy: SignaturePolicy
  resolution: SourceEngineResolution
  enforceSignatureBlockers: boolean
} {
  if (options?.runtimeConfig) {
    const c = options.runtimeConfig
    return {
      template: c.template,
      rules: c.rules,
      metrics: c.metrics,
      signaturePolicy: c.signaturePolicy,
      resolution: c.resolution,
      enforceSignatureBlockers: c.enforceSignatureBlockers,
    }
  }

  if (options?.template) {
    const template = options.template
    return {
      template,
      rules: options.rules ?? getFallbackGenericRules(),
      metrics: getFallbackGenericMetrics(),
      signaturePolicy: options.signaturePolicy ?? DEFAULT_SIGNATURE_POLICY,
      resolution: {
        source: 'fallback',
        templateId: template.id,
        registryTemplateId: null,
        sourceDefinitionVersionId: null,
        publishedPackageId: null,
        definitionCode: null,
        degraded: true,
        fallback: true,
        warning: 'Explicit template override (dev/manual).',
      },
      enforceSignatureBlockers: false,
    }
  }

  const fallbackTemplate = getFallbackGenericTemplate()
  return {
    template: fallbackTemplate,
    rules: getFallbackGenericRules(),
    metrics: getFallbackGenericMetrics(),
    signaturePolicy: DEFAULT_SIGNATURE_POLICY,
    resolution: {
      source: 'fallback',
      templateId: fallbackTemplate.id,
      registryTemplateId: 'GENERIC_OA_PHASE3_TEMPLATE',
      sourceDefinitionVersionId: null,
      publishedPackageId: null,
      definitionCode: null,
      degraded: true,
      fallback: true,
      warning: 'No runtime config resolved; generic dev fallback.',
    },
    enforceSignatureBlockers: false,
  }
}

export function resolveProcedureSourceRuntime(
  bridge: ProcedureCaptureBridge,
  fields: CaptureFieldViewModel[],
  options?: ProcedureEngineRuntimeOptions,
): ProcedureSourceEngineSnapshot {
  const resolved = resolveOptions(options)
  const context = mapProcedureExecutionToRuntimeContext(bridge)
  const responses = mapCaptureFieldsToEngineResponses(fields)
  const runtime = resolveSourceRuntime(resolved.template, responses, context, {
    rules: resolved.rules,
    metrics: resolved.metrics,
  })

  const validationErrors = applySignatureEnforcement(
    mapEngineValidationToCaptureErrors(runtime.validationResults),
    resolved.enforceSignatureBlockers,
  )

  return {
    context,
    responses,
    runtime,
    derivedValues: runtime.derivedValues,
    signaturePolicy: resolved.signaturePolicy,
    validationErrors,
    engineStatus: {
      resolution: resolved.resolution,
      enforceSignatureBlockers: resolved.enforceSignatureBlockers,
    },
  }
}

export function validateProcedureSourceForSubmit(
  bridge: ProcedureCaptureBridge,
  fields: CaptureFieldViewModel[],
  options?: ProcedureEngineRuntimeOptions,
): {
  valid: boolean
  errors: CaptureValidationError[]
  blocksSubmission: boolean
} {
  const resolved = resolveOptions(options)
  const context = mapProcedureExecutionToRuntimeContext(bridge)
  const responses = mapCaptureFieldsToEngineResponses(fields)
  const results = validateTemplate(resolved.template, responses, context)
  const errors = applySignatureEnforcement(
    mapEngineValidationToCaptureErrors(results),
    false,
  )
  const blocksSubmission = errors.some((e) => e.blocksSubmission)
  return {
    valid: !blocksSubmission,
    errors,
    blocksSubmission,
  }
}

export function validateProcedureSourceForSignature(
  bridge: ProcedureCaptureBridge,
  fields: CaptureFieldViewModel[],
  options?: ProcedureEngineRuntimeOptions,
): TemplateValidationSummary & { errors: CaptureValidationError[] } {
  const resolved = resolveOptions(options)
  const context = mapProcedureExecutionToRuntimeContext(bridge)
  const responses = mapCaptureFieldsToEngineResponses(fields)
  const summary = validateForSignature(resolved.template, responses, context)
  const errors = applySignatureEnforcement(
    mapEngineValidationToCaptureErrors(summary.results),
    resolved.enforceSignatureBlockers,
  )
  return {
    ...summary,
    errors,
    blocksSignature: resolved.enforceSignatureBlockers
      ? errors.some((e) => e.blocksSignature)
      : false,
  }
}

export function getProcedureDerivedValues(
  bridge: ProcedureCaptureBridge,
  fields: CaptureFieldViewModel[],
  options?: ProcedureEngineRuntimeOptions,
): Record<string, unknown> {
  const resolved = resolveOptions(options)
  const context = mapProcedureExecutionToRuntimeContext(bridge)
  const responses = mapCaptureFieldsToEngineResponses(fields)
  return calculateDerivedMetrics(resolved.metrics, resolved.template, responses, context)
}

export function getSignaturePolicyForProcedure(
  _bridge?: ProcedureCaptureBridge,
  options?: ProcedureEngineRuntimeOptions,
): SignaturePolicy {
  if (options?.runtimeConfig) return options.runtimeConfig.signaturePolicy
  return options?.signaturePolicy ?? DEFAULT_SIGNATURE_POLICY
}

/** Convenience: capture shell context + fields → engine snapshot (optional enrichment). */
export function resolveCaptureShellEngineRuntime(
  captureContext: Parameters<typeof bridgeFromProcedureCaptureContext>[0],
  fields: CaptureFieldViewModel[],
  bridgeExtras?: Partial<ProcedureCaptureBridge>,
  options?: ProcedureEngineRuntimeOptions,
): ProcedureSourceEngineSnapshot {
  const bridge = bridgeFromProcedureCaptureContext(captureContext, bridgeExtras)
  return resolveProcedureSourceRuntime(bridge, fields, options)
}

export function applyEngineRuntimeToCaptureFields(
  fields: CaptureFieldViewModel[],
  snapshot: ProcedureSourceEngineSnapshot | null | undefined,
): CaptureFieldViewModel[] {
  if (!snapshot) return fields

  return fields.map((field) => {
    const runtimeState =
      snapshot.runtime.fields[field.fieldKey] ?? snapshot.runtime.fields[field.fieldId]

    if (!runtimeState) return field

    return {
      ...field,
      isRequired: runtimeState.required,
      runtimeState: {
        visible: runtimeState.visible,
        required: runtimeState.required,
        disabled: runtimeState.disabled,
        locked: runtimeState.locked,
        calculatedValue: runtimeState.calculatedValue,
        flags: runtimeState.flags,
        messages: runtimeState.messages,
      },
    }
  })
}
