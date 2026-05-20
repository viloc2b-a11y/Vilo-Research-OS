const SAFETY_PATTERN =
  /\b(ae|aes|sae|adverse|safety|toxicity|serious|hypersensitivity|anaphylaxis|allergic\s+reaction)\b/i

export function isSafetyRelatedText(value: string | null | undefined): boolean {
  if (!value?.trim()) return false
  return SAFETY_PATTERN.test(value)
}

export function isOpenFindingStatus(status: string | null | undefined): boolean {
  return status === 'open' || status === 'acknowledged'
}

export function isUnresolvedWorkflowStatus(status: string | null | undefined): boolean {
  return status === 'open' || status === 'in_progress'
}
