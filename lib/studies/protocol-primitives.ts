export const SUBJECT_ROLE_OPTIONS = [
  ['participant', 'Participant'],
  ['index_patient', 'Index patient'],
  ['household_contact', 'Household contact'],
  ['caregiver', 'Caregiver'],
  ['specimen_donor', 'Specimen donor'],
] as const

export type SubjectRoleValue = (typeof SUBJECT_ROLE_OPTIONS)[number][0]

export const VISIT_MODALITY_OPTIONS = [
  ['', 'Site (default)'],
  ['site', 'Site'],
  ['phone', 'Phone'],
  ['remote', 'Remote'],
  ['home', 'Home'],
  ['off_site', 'Off-site'],
] as const

export type VisitModalityValue = 'site' | 'phone' | 'remote' | 'home' | 'off_site'

const SUBJECT_ROLE_SET = new Set<string>(SUBJECT_ROLE_OPTIONS.map(([v]) => v))
const MODALITY_SET = new Set<string>(
  VISIT_MODALITY_OPTIONS.map(([v]) => v).filter(Boolean),
)

export function parseSubjectRole(value: string | null | undefined): SubjectRoleValue {
  const trimmed = value?.trim() ?? ''
  return SUBJECT_ROLE_SET.has(trimmed) ? (trimmed as SubjectRoleValue) : 'participant'
}

export function parseCommaSeparatedList(value: string | null | undefined): string[] | null {
  const trimmed = value?.trim() ?? ''
  if (!trimmed) return null
  const items = trimmed
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  return items.length ? items : null
}

export function formatCommaSeparatedList(values: string[] | null | undefined): string {
  if (!values?.length) return ''
  return values.join(', ')
}

export function parseVisitModality(value: string | null | undefined): string | null {
  const trimmed = value?.trim() ?? ''
  if (!trimmed || trimmed === 'site') return null
  return MODALITY_SET.has(trimmed) ? trimmed : null
}

export function isAnchorRole(role: string): boolean {
  return role === 'household_contact' || role === 'caregiver'
}
