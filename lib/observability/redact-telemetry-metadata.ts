/**
 * OBS-1 — Redact non-PHI telemetry metadata before persistence.
 */

import { OBS_FORBIDDEN_AUTHORITY_METADATA_KEYS } from '@/lib/observability/constants'

const METADATA_PHI_KEY_PATTERNS: readonly RegExp[] = [
  /^subject_/i,
  /^patient_/i,
  /mrn/i,
  /ssn/i,
  /date_of_birth/i,
  /\bdob\b/i,
  /phi_/i,
  /hipaa/i,
  /subject_identifier/i,
  /study_subject_id/i,
  /patient_name/i,
  /subject_name/i,
]

const PHI_KEY_LITERAL_BLOCKLIST = new Set([
  'subject_id',
  'patient_id',
  'patient_name',
  'subject_name',
  'mrn',
  'ssn',
  'date_of_birth',
  'dob',
  'authorityname',
  'authoritylabel',
  'authoritydisplayname',
  'authoritytiername',
  'authoritydescription',
])

function isPhiKey(key: string): boolean {
  const normalized = key.trim().toLowerCase()
  if (PHI_KEY_LITERAL_BLOCKLIST.has(normalized)) return true
  return METADATA_PHI_KEY_PATTERNS.some((pattern) => pattern.test(key))
}

function isForbiddenAuthorityMetadataKey(key: string): boolean {
  return (OBS_FORBIDDEN_AUTHORITY_METADATA_KEYS as readonly string[]).includes(key)
}

/**
 * Returns paths of PHI-like or forbidden authority keys found in metadata.
 */
export function collectTelemetryMetadataIssues(metadata: Record<string, unknown>): string[] {
  const issues: string[] = []

  const visit = (value: unknown, path: string) => {
    if (value === null || value === undefined) return
    if (Array.isArray(value)) {
      value.forEach((item, index) => visit(item, `${path}[${index}]`))
      return
    }
    if (typeof value === 'object') {
      for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
        const fullPath = path ? `${path}.${key}` : key
        if (isPhiKey(key) || isForbiddenAuthorityMetadataKey(key)) {
          issues.push(fullPath)
        }
        visit(nested, fullPath)
      }
    }
  }

  visit(metadata, '')
  return issues
}

/**
 * Deep-clones metadata and removes PHI-like keys and free-text authority label keys.
 * OBS-2 authority belongs on runtime_traces columns, not metadata.
 */
export function redactTelemetryMetadata(
  metadata: Record<string, unknown>,
): Record<string, unknown> {
  const redact = (value: unknown): unknown => {
    if (value === null || value === undefined) return value
    if (Array.isArray(value)) {
      return value.map((item) => redact(item))
    }
    if (typeof value === 'object') {
      const out: Record<string, unknown> = {}
      for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
        if (isPhiKey(key) || isForbiddenAuthorityMetadataKey(key)) continue
        out[key] = redact(nested)
      }
      return out
    }
    return value
  }

  const result = redact(metadata)
  return typeof result === 'object' && result !== null && !Array.isArray(result)
    ? (result as Record<string, unknown>)
    : {}
}

export function assertTelemetryMetadataSafe(metadata: Record<string, unknown>): void {
  const issues = collectTelemetryMetadataIssues(metadata)
  if (issues.length > 0) {
    throw new Error(
      `Telemetry metadata contains forbidden keys: ${issues.slice(0, 8).join(', ')}`,
    )
  }
}
