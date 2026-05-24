import { ALL_REGISTERED_OPERATIONAL_EVENT_TYPES } from '@/lib/operations/event-types'
import { CANONICAL_EVENT_TYPE_PATTERN } from '@/lib/runtime-integrity/constants'

/**
 * Legacy / drift aliases → canonical registry value.
 */
export const LEGACY_EVENT_TYPE_ALIASES: Record<string, string> = {
  external_randomization_recorded: 'EXTERNAL_RANDOMIZATION_RECORDED',
  external_randomization_voided: 'EXTERNAL_RANDOMIZATION_VOIDED',
  visit_checked_in: 'VISIT_CHECKED_IN',
  visit_rescheduled: 'VISIT_RESCHEDULED',
  procedure_completed: 'PROCEDURE_COMPLETED',
  procedure_signed: 'PROCEDURE_SIGNED',
  engine_snapshot_generated: 'ENGINE_SNAPSHOT_GENERATED',
  engine_snapshot_failed: 'ENGINE_SNAPSHOT_FAILED',
  engine_signature_blocked: 'ENGINE_SIGNATURE_BLOCKED',
  engine_signature_gate_failed_closed: 'ENGINE_SIGNATURE_GATE_FAILED_CLOSED',
  engine_tasks_materialized: 'ENGINE_TASKS_MATERIALIZED',
  engine_task_materialization_skipped: 'ENGINE_TASK_MATERIALIZATION_SKIPPED',
  engine_fallback_template_used: 'ENGINE_FALLBACK_TEMPLATE_USED',
  engine_runtime_state_applied: 'ENGINE_RUNTIME_STATE_APPLIED',
  phase10e_blinded_safe_source_rebound: 'PHASE10E_BLINDED_SAFE_SOURCE_REBOUND',
  phase10e_minimal_blinded_source_bound: 'PHASE10E_MINIMAL_BLINDED_SOURCE_BOUND',
}

export type EventNormalizationResult = {
  input: string
  canonical: string
  registered: boolean
  namingDrift: boolean
  wasAliased: boolean
}

export function normalizeOperationalEventType(eventType: string): EventNormalizationResult {
  const trimmed = eventType.trim()
  const aliased = LEGACY_EVENT_TYPE_ALIASES[trimmed] ?? LEGACY_EVENT_TYPE_ALIASES[trimmed.toLowerCase()]
  const canonical = aliased ?? trimmed
  const registered = ALL_REGISTERED_OPERATIONAL_EVENT_TYPES.has(canonical)
  const namingDrift = !CANONICAL_EVENT_TYPE_PATTERN.test(trimmed) && !aliased

  return {
    input: trimmed,
    canonical,
    registered,
    namingDrift,
    wasAliased: Boolean(aliased && aliased !== trimmed),
  }
}

export function collectRegistryDrift(): {
  legacyAliases: string[]
  nonCanonicalRegistered: string[]
} {
  const legacyAliases = Object.keys(LEGACY_EVENT_TYPE_ALIASES)
  const nonCanonicalRegistered = [...ALL_REGISTERED_OPERATIONAL_EVENT_TYPES].filter(
    (t) => !CANONICAL_EVENT_TYPE_PATTERN.test(t),
  )
  return { legacyAliases, nonCanonicalRegistered }
}
