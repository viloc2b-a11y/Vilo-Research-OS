import type { FieldMaskPolicy } from './field-mask-policy'

const MASK_PLACEHOLDER = '[REDACTED]'

export function maskRecord(
  record: Record<string, unknown>,
  policy: FieldMaskPolicy,
): Record<string, unknown> {
  if (policy.maskLevel === 'none' || policy.maskedFields.length === 0) return record

  const masked = { ...record }
  for (const field of policy.maskedFields) {
    if (field in masked && masked[field] != null) {
      masked[field] = MASK_PLACEHOLDER
    }
  }
  return masked
}

export function maskRecords(
  records: Record<string, unknown>[],
  policy: FieldMaskPolicy,
): Record<string, unknown>[] {
  if (policy.maskLevel === 'none' || policy.maskedFields.length === 0) return records
  return records.map((r) => maskRecord(r, policy))
}
