/**
 * Phase 1C — Standard operational event payload envelope.
 * All spine events should include these fields for audit reconstruction.
 */

export const OPERATIONAL_PAYLOAD_SCHEMA_VERSION = 'v1' as const

export type OperationalPayloadSource =
  | 'clinical-mutation-gateway'
  | 'check-in-visit'
  | 'reschedule-visit'
  | 'source-publish'
  | 'adverse-events'
  | 'generate-subject-visit-schedule'
  | 'rpc'
  | string

export type BuildOperationalPayloadInput = {
  /** Calling module (e.g. check-in-visit). */
  source: OperationalPayloadSource
  /** Logical mutation id (e.g. visits.check_in). */
  mutation: string
  /** Optional subject anchor for longitudinal queries. */
  subjectId?: string | null
  /** Domain-specific fields merged into payload.details. */
  details?: Record<string, unknown>
}

/**
 * Builds a versioned payload envelope. DB `occurred_at` remains authoritative;
 * `recorded_at` captures client emission time for debugging only.
 */
export function buildOperationalEventPayload(
  input: BuildOperationalPayloadInput,
): Record<string, unknown> {
  const details = input.details ?? {}
  return {
    schema_version: OPERATIONAL_PAYLOAD_SCHEMA_VERSION,
    source: input.source,
    mutation: input.mutation,
    recorded_at: new Date().toISOString(),
    ...(input.subjectId ? { subject_id: input.subjectId } : {}),
    details,
  }
}
