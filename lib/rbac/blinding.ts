/**
 * Blinding conventions for payloads and read models.
 *
 * Mark sensitive operational/source rows in JSON payloads:
 * - blinding_scope: "blinded" | "unblinded" | "public_to_site"
 * - is_unblinded: boolean (legacy shorthand for unblinded)
 *
 * Default when unset: public_to_site (visible to blinded site staff).
 * Rows explicitly marked unblinded are hidden from users without canViewUnblindedData.
 */

import type { OrganizationMembership } from '@/lib/auth/session'
import { canViewUnblindedData } from '@/lib/rbac/unblinded-access'

export type BlindingScope = 'blinded' | 'unblinded' | 'public_to_site'

export const BLINDING_SCOPES: BlindingScope[] = ['blinded', 'unblinded', 'public_to_site']

/** Payload keys stripped from blinded views (operational_events, source snapshots, etc.). */
export const UNBLINDED_PAYLOAD_FIELD_KEYS = [
  'treatment_assignment',
  'randomization_arm',
  'randomization_number',
  'ip_allocation',
  'ip_kit_id',
  'kit_treatment_meaning',
  'placebo_active_mapping',
  'unblinded_notes',
  'unblinded_pharmacy_notes',
  'unblinded_monitoring_notes',
  'unblinded_deviation_notes',
  'unblinded_task_title',
  'unblinded_document_id',
] as const

export function resolvePayloadBlindingScope(
  payload: Record<string, unknown> | null | undefined,
): BlindingScope {
  if (!payload) return 'public_to_site'
  const scope = payload.blinding_scope
  if (scope === 'blinded' || scope === 'unblinded' || scope === 'public_to_site') {
    return scope
  }
  if (payload.is_unblinded === true) return 'unblinded'
  return 'public_to_site'
}

export function isUnblindedScopedPayload(
  payload: Record<string, unknown> | null | undefined,
): boolean {
  return resolvePayloadBlindingScope(payload) === 'unblinded'
}

function membershipsFromInput(
  membership: OrganizationMembership | OrganizationMembership[],
): OrganizationMembership[] {
  return Array.isArray(membership) ? membership : [membership]
}

export function canViewBlindingScope(
  membership: OrganizationMembership | OrganizationMembership[],
  blindingScope: BlindingScope | string | null | undefined,
  organizationId?: string,
): boolean {
  if (blindingScope !== 'unblinded') return true
  return canViewUnblindedData(membershipsFromInput(membership), organizationId)
}

export function redactUnblindedPayload(
  payload: Record<string, unknown> | null | undefined,
  membership: OrganizationMembership | OrganizationMembership[],
  organizationId?: string,
): Record<string, unknown> | null {
  return redactOperationalEventPayload(payload, canViewUnblindedData(membershipsFromInput(membership), organizationId))
}

export function filterUnblindedRows<T extends { payload?: Record<string, unknown> | null }>(
  rows: T[],
  membership: OrganizationMembership | OrganizationMembership[],
  organizationId?: string,
): T[] {
  return filterRowsByBlindingScope(rows, canViewUnblindedData(membershipsFromInput(membership), organizationId))
}

export function filterRowsByBlindingScope<T extends { payload?: Record<string, unknown> | null }>(
  rows: T[],
  canViewUnblinded: boolean,
): T[] {
  if (canViewUnblinded) return rows
  return rows.filter((row) => !isUnblindedScopedPayload(row.payload ?? null))
}

export function redactOperationalEventPayload(
  payload: Record<string, unknown> | null | undefined,
  canViewUnblinded: boolean,
): Record<string, unknown> | null {
  if (!payload) return null
  if (canViewUnblinded) return payload
  if (isUnblindedScopedPayload(payload)) return null

  const redacted: Record<string, unknown> = { ...payload }
  for (const key of UNBLINDED_PAYLOAD_FIELD_KEYS) {
    if (key in redacted) delete redacted[key]
  }
  return redacted
}

export function redactOperationalEventPayloadForDisplay(
  payload: unknown,
  canViewUnblinded: boolean,
): string {
  const record =
    payload && typeof payload === 'object'
      ? redactOperationalEventPayload(payload as Record<string, unknown>, canViewUnblinded)
      : null
  if (!record) return 'Operational event recorded.'
  const parts = [
    typeof record.validation_status === 'string' ? `Validation: ${record.validation_status}` : null,
    typeof record.response_set_id === 'string' ? `Source set ${String(record.response_set_id).slice(0, 8)}` : null,
    typeof record.note_preview === 'string' ? record.note_preview : null,
    typeof record.title === 'string' ? record.title : null,
  ].filter(Boolean)
  return parts.length ? parts.join(' · ') : 'Operational event recorded.'
}

export type SubjectUnblindedFields = {
  randomizationNumber?: string | null
  randomizationArm?: string | null
  studyArm?: string | null
}

/** Remove treatment/randomization identifiers from subject/header models for blinded users. */
export function redactSubjectUnblindedFields<T extends SubjectUnblindedFields>(
  subject: T,
  canViewUnblinded: boolean,
): T {
  if (canViewUnblinded) return subject
  return {
    ...subject,
    randomizationNumber: null,
    randomizationArm: null,
    studyArm: null,
  }
}
