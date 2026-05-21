/** Default source line when coordinator adds data from the subject Clinical Profile workspace. */
export const DEFAULT_CLINICAL_PROFILE_SOURCE_ATTRIBUTION =
  'Subject-reported / Clinical Profile'

export function resolveClinicalProfileSourceAttribution(
  value: string | null | undefined,
  override?: string | null,
): string {
  const trimmed = value?.trim()
  if (trimmed) return trimmed
  const alt = override?.trim()
  if (alt) return alt
  return DEFAULT_CLINICAL_PROFILE_SOURCE_ATTRIBUTION
}
