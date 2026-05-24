/**
 * Strip obvious PHI keys from guardrail metadata.
 */

const PHI_KEY_LITERAL_BLOCKLIST = new Set([
  'subject_id',
  'patient_id',
  'patient_name',
  'subject_name',
  'mrn',
  'ssn',
  'date_of_birth',
  'dob',
])

const PHI_KEY_PATTERNS: readonly RegExp[] = [
  /^subject_/i,
  /^patient_/i,
  /mrn/i,
  /ssn/i,
  /date_of_birth/i,
  /\bdob\b/i,
  /phi_/i,
]

function isPhiKey(key: string): boolean {
  const normalized = key.trim().toLowerCase()
  if (PHI_KEY_LITERAL_BLOCKLIST.has(normalized)) return true
  return PHI_KEY_PATTERNS.some((pattern) => pattern.test(key))
}

export function redactGuardrailMetadata(
  metadata: Record<string, unknown>,
): Record<string, unknown> {
  const redact = (value: unknown): unknown => {
    if (value === null || value === undefined) return value
    if (Array.isArray(value)) return value.map((item) => redact(item))
    if (typeof value === 'object') {
      const out: Record<string, unknown> = {}
      for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
        if (isPhiKey(key)) continue
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

export function collectGuardrailMetadataIssues(metadata: Record<string, unknown>): string[] {
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
        if (isPhiKey(key)) issues.push(fullPath)
        visit(nested, fullPath)
      }
    }
  }
  visit(metadata, '')
  return issues
}
