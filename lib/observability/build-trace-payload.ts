/**
 * OBS-2 — Build runtime trace row payloads with GOV-1 authority enums (no free-text labels).
 */

import {
  buildGovernedWorkflowTraceRefs,
  type GovernedWorkflowTraceRefs,
} from '@/lib/governance/workflow-authority/observability-contract'
import type { WorkflowKey } from '@/lib/governance/workflow-authority/constants'
import {
  assertWorkflowAuthorityLevel,
  isWorkflowAuthorityLevel,
  isWorkflowKey,
} from '@/lib/governance/workflow-authority/constants'
import { redactTelemetryMetadata } from '@/lib/observability/redact-telemetry-metadata'
import type {
  RuntimeTraceAuthorityFields,
  RuntimeTraceAuthorityValidationResult,
  RuntimeTraceInsert,
} from '@/lib/observability/types'

export function validateRuntimeTraceAuthorityFields(
  fields: RuntimeTraceAuthorityFields,
): RuntimeTraceAuthorityValidationResult {
  const errors: string[] = []

  if (fields.workflowKey !== null && !isWorkflowKey(fields.workflowKey)) {
    errors.push(`Invalid workflow_key: ${String(fields.workflowKey)}`)
  }

  if (fields.baseAuthorityLevel !== null && !isWorkflowAuthorityLevel(fields.baseAuthorityLevel)) {
    errors.push(`Invalid base_authority_level: ${String(fields.baseAuthorityLevel)}`)
  }

  if (
    fields.effectiveAuthorityLevel !== null &&
    !isWorkflowAuthorityLevel(fields.effectiveAuthorityLevel)
  ) {
    errors.push(`Invalid effective_authority_level: ${String(fields.effectiveAuthorityLevel)}`)
  }

  if (fields.effectiveAuthorityLevel !== null && fields.baseAuthorityLevel === null) {
    errors.push('base_authority_level is required when effective_authority_level is set')
  }

  if (errors.length > 0) return { ok: false, errors }
  return { ok: true }
}

/**
 * Normalizes OBS-2 authority columns for DB insert. Strips forbidden keys from metadata.
 */
export function buildRuntimeTraceInsertPayload(
  input: RuntimeTraceInsert,
): RuntimeTraceInsert & { metadata: Record<string, unknown> } {
  const authorityValidation = validateRuntimeTraceAuthorityFields({
    workflowKey: input.workflowKey,
    baseAuthorityLevel: input.baseAuthorityLevel,
    effectiveAuthorityLevel: input.effectiveAuthorityLevel,
  })
  if (!authorityValidation.ok) {
    throw new Error(authorityValidation.errors.join('; '))
  }

  const metadata = redactTelemetryMetadata(input.metadata ?? {})

  if (
    input.workflowKey &&
    input.baseAuthorityLevel &&
    input.effectiveAuthorityLevel
  ) {
    buildGovernedWorkflowTraceRefs({
      workflowKey: input.workflowKey,
      baseAuthorityLevel: input.baseAuthorityLevel,
      effectiveAuthorityLevel: input.effectiveAuthorityLevel,
    })
  } else if (input.workflowKey && input.baseAuthorityLevel) {
    buildGovernedWorkflowTraceRefs({
      workflowKey: input.workflowKey,
      baseAuthorityLevel: input.baseAuthorityLevel,
    })
  }

  return {
    ...input,
    metadata,
  }
}

export function toRuntimeTraceAuthorityColumns(
  refs: GovernedWorkflowTraceRefs,
): Pick<
  RuntimeTraceAuthorityFields,
  'workflowKey' | 'baseAuthorityLevel' | 'effectiveAuthorityLevel'
> {
  assertWorkflowAuthorityLevel(refs.baseAuthorityLevel)
  assertWorkflowAuthorityLevel(refs.effectiveAuthorityLevel)
  return {
    workflowKey: refs.workflowKey as WorkflowKey,
    baseAuthorityLevel: refs.baseAuthorityLevel,
    effectiveAuthorityLevel: refs.effectiveAuthorityLevel,
  }
}
