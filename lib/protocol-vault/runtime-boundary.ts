import { detectForbiddenProtocolTokens } from '@/lib/sanitization/protocol-sanitizer'
import type { StudySafeDisplay } from '@/lib/protocol-vault/types'

/** Fields that must never appear on runtime / publish / source-builder DTOs. */
export const RAW_VAULT_LEAK_FIELDS = [
  'original_filename',
  'originalFilename',
  'storage_path',
  'storagePath',
  'raw_token',
  'rawToken',
] as const

export function stripRawVaultFieldsForRuntime<T extends Record<string, unknown>>(object: T): T {
  const output = { ...object }
  for (const key of RAW_VAULT_LEAK_FIELDS) {
    if (key in output) {
      delete output[key]
    }
  }
  return output
}

export function assertRuntimeObjectHasNoRawVaultFields(
  payload: unknown,
  context = 'runtime payload',
): void {
  if (!payload || typeof payload !== 'object') return

  const visit = (value: unknown, path: string): void => {
    if (!value || typeof value !== 'object') return
    if (Array.isArray(value)) {
      value.forEach((item, index) => visit(item, `${path}[${index}]`))
      return
    }
    for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
      if ((RAW_VAULT_LEAK_FIELDS as readonly string[]).includes(key)) {
        throw new Error(
          `Runtime rejected: raw vault field "${key}" at ${path || 'root'} (${context}).`,
        )
      }
      visit(nested, path ? `${path}.${key}` : key)
    }
  }

  visit(payload, '')
}

export function assertStudySafeDisplaySanitized(
  display: StudySafeDisplay,
  context = 'study safe display',
): void {
  assertRuntimeObjectHasNoRawVaultFields(display, context)
  const hits = detectForbiddenProtocolTokens(display)
  if (hits.length > 0) {
    const tokens = [...new Set(hits.map((hit) => hit.token))].join(', ')
    throw new Error(`Runtime rejected: unsafe protocol identifier in ${context} (${tokens}).`)
  }
}

export function buildRuntimeSafeStudyLabel(display: StudySafeDisplay): string {
  assertStudySafeDisplaySanitized(display, 'runtime study label')
  return display.coordinatorDisplayName
}
