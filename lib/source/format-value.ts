/**
 * @deprecated Import from `@/lib/source/read-contract/format` instead.
 */
export {
  EMPTY_DISPLAY,
  formatTimestamp,
  formatValuePayload,
} from '@/lib/source/read-contract/format'

export function shortId(id: string | null | undefined, len = 8): string {
  if (!id) return '—'
  return id.length > len ? `${id.slice(0, len)}…` : id
}
