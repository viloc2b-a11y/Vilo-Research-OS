import type { ReviewItemState } from '@/lib/protocol-intake-review/types'

export function resolvedFieldValue(
  item: ReviewItemState,
  fieldKey: string,
  original: unknown,
): unknown {
  if (fieldKey in item.field_overrides) return item.field_overrides[fieldKey]
  return original
}

export function canIncludeInApproved(status: ReviewItemState['reviewer_status']): boolean {
  return status === 'accepted' || status === 'edited'
}
