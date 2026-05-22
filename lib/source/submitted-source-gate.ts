export const SOURCE_SUBMITTED_OR_BEYOND_STATUSES = [
  'submitted',
  'pending_review',
  'reviewed',
  'signed',
  'locked',
  'corrected',
  'addended',
] as const

export function isSourceCaptureSubmitted(status: string | null | undefined): boolean {
  if (!status) return false
  return (SOURCE_SUBMITTED_OR_BEYOND_STATUSES as readonly string[]).includes(status)
}
