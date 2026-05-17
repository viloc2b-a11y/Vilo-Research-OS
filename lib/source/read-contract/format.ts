/**
 * Phase 5.2B — Render-safe formatting (pure, deterministic).
 */

import type { SourceValuePayload } from '@/lib/api/source/read-types'

export const EMPTY_DISPLAY = '—'

export function formatValuePayload(value: SourceValuePayload | null | undefined): string {
  if (!value || typeof value !== 'object') return EMPTY_DISPLAY
  if (value.value_text != null && value.value_text !== '') return String(value.value_text)
  if (value.value_number != null) return String(value.value_number)
  if (value.value_boolean != null) return value.value_boolean ? 'true' : 'false'
  if (value.value_date != null) return String(value.value_date)
  if (value.value_datetime != null) return String(value.value_datetime)
  if (value.value_json != null) return formatStructuredPayload(value.value_json)
  return EMPTY_DISPLAY
}

export function formatStructuredPayload(value: unknown): string {
  if (value === null || value === undefined) return EMPTY_DISPLAY
  if (typeof value === 'string') return value
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return String(value)
  }
}

export function formatTimestamp(iso: string | null | undefined): string {
  if (!iso) return EMPTY_DISPLAY
  try {
    return new Date(iso).toLocaleString(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    })
  } catch {
    return iso
  }
}

export function formatActor(userId: string | null | undefined, len = 8): string {
  if (!userId) return EMPTY_DISPLAY
  return userId.length > len ? `${userId.slice(0, len)}…` : userId
}

export function formatEventKind(kind: string): string {
  return kind.replace(/_/g, ' ')
}

export function formatStatusLabel(status: string): string {
  return status.replace(/_/g, ' ')
}

export type SeverityTone = 'info' | 'warning' | 'error'

export function severityTone(severity: string): SeverityTone {
  if (severity === 'error') return 'error'
  if (severity === 'warning') return 'warning'
  return 'info'
}

export function severityTextClass(tone: SeverityTone): string {
  if (tone === 'error') return 'text-destructive'
  if (tone === 'warning') return 'text-amber-700 dark:text-amber-400'
  return 'text-muted-foreground'
}
