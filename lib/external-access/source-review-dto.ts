/**
 * External-safe source review DTO — submitted coordinator-entered values only.
 * Never carries runtime intelligence, hashes, or internal blocker reasoning.
 */

export type SourceReviewCorrectionStatus = 'none' | 'approved_correction' | 'approved_addendum'

export type SourceReviewFieldRow = {
  field_label: string
  submitted_value: string | number | boolean | null
}

export type SourceReviewDto = {
  response_set_id: string
  study_id: string
  subject_display_code: string | null
  visit_label: string
  procedure_label: string
  procedure_execution_status: string | null
  fields: SourceReviewFieldRow[]
  submitted_at: string | null
  submitted_by_role: string | null
  correction_status: SourceReviewCorrectionStatus
}

/** Keys that must never appear on external inspection-readiness payloads. */
export const FORBIDDEN_EXTERNAL_DTO_KEYS = [
  'runtime_traces',
  'runtime_trace',
  'execution_spans',
  'telemetry',
  'operational_events',
  'workflow_telemetry_events',
  'workflow_telemetry',
  'orchestration',
  'coordinator_orchestration',
  'visit_coordinator_orchestration',
  'automation',
  'operational_intelligence',
  'financial_runtime',
  'financial runtime',
  'internal_work_queue',
  'internal blockers',
  'work_queue',
  'work queues',
  'integrity_hash',
  'source_integrity_hashes',
  'hash_value',
  'chronology_checksum',
  'coordinator_burden',
  'overload',
  'remediation',
  'remediation_lineage',
  'why_blocked',
  'blocker_reason',
  'lineage',
  'placeholders',
  'operational_event_id',
  'structured_payload',
  'likely_',
  'site-defense signals',
  'site_internal_only',
  'prevention_queue',
  'prevention queues',
  'site_defense',
  'stabilization',
  'unstable',
  'stabilizing',
  'hiddenNoiseCount',
  'riskWeight',
  'automation_proposals',
  'automation proposals',
  'replay chronology',
  'coordinator burden metrics',
] as const

export type SourceReviewDtoInput = {
  response_set_id: string
  study_id: string
  subject_display_code?: string | null
  visit_label: string
  procedure_label: string
  procedure_execution_status?: string | null
  fields: Array<{
    field_label: string
    submitted_value: string | number | boolean | null
  }>
  submitted_at?: string | null
  submitted_by_role?: string | null
  correction_status?: SourceReviewCorrectionStatus
}

export function buildSourceReviewDto(input: SourceReviewDtoInput): SourceReviewDto {
  return {
    response_set_id: input.response_set_id,
    study_id: input.study_id,
    subject_display_code: input.subject_display_code ?? null,
    visit_label: input.visit_label,
    procedure_label: input.procedure_label,
    procedure_execution_status: input.procedure_execution_status ?? null,
    fields: input.fields.map((f) => ({
      field_label: f.field_label,
      submitted_value: f.submitted_value,
    })),
    submitted_at: input.submitted_at ?? null,
    submitted_by_role: input.submitted_by_role ?? null,
    correction_status: input.correction_status ?? 'none',
  }
}

function collectKeys(value: unknown, prefix = ''): string[] {
  if (value === null || typeof value !== 'object') return []
  const keys: string[] = []
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    const path = prefix ? `${prefix}.${k}` : k
    keys.push(path)
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      keys.push(...collectKeys(v, path))
    }
  }
  return keys
}

export function assertSourceReviewDtoHasNoInternalRuntimeFields(
  payload: unknown,
): { ok: true } | { ok: false; forbidden: string[] } {
  const keys = collectKeys(payload)
  const forbidden: string[] = []
  for (const key of keys) {
    const lower = key.toLowerCase()
    for (const banned of FORBIDDEN_EXTERNAL_DTO_KEYS) {
      if (lower.includes(banned)) {
        forbidden.push(key)
        break
      }
    }
  }
  if (forbidden.length > 0) return { ok: false, forbidden }
  return { ok: true }
}

export function assertNoExternalRuntimeLeak(
  payload: unknown,
): { ok: true } | { ok: false; forbidden: string[] } {
  return assertSourceReviewDtoHasNoInternalRuntimeFields(payload)
}
