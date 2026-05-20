import {
  STUDY_PHASE_OPTIONS,
  STUDY_STATUS_VALUES,
  type CreateStudyInput,
  type CreateStudyValidationResult,
  type StudyStatusValue,
} from '@/lib/studies/types'

export function normalizeStudySlug(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64)
}

function clean(value: FormDataEntryValue | null): string {
  return typeof value === 'string' ? value.trim() : ''
}

export function parseCreateStudyForm(formData: FormData): CreateStudyValidationResult {
  const errors: Record<string, string> = {}

  const organizationId = clean(formData.get('organization_id'))
  const title = clean(formData.get('title'))
  const studyCode = clean(formData.get('study_code'))
  const sponsorName = clean(formData.get('sponsor_name'))
  const phase = clean(formData.get('phase'))
  const statusRaw = clean(formData.get('status'))
  const enrollmentRaw = clean(formData.get('enrollment_target'))

  if (!organizationId) errors.organization_id = 'Organization is required.'
  if (!title) errors.title = 'Study title is required.'
  else if (title.length > 240) errors.title = 'Study title must be 240 characters or fewer.'

  const slug = normalizeStudySlug(studyCode)
  if (!studyCode) errors.study_code = 'Study code is required.'
  else if (!slug) errors.study_code = 'Study code must include letters or numbers.'

  if (!sponsorName) errors.sponsor_name = 'Sponsor name is required.'
  else if (sponsorName.length > 160) errors.sponsor_name = 'Sponsor name must be 160 characters or fewer.'

  if (!phase) errors.phase = 'Phase is required.'
  else if (!STUDY_PHASE_OPTIONS.includes(phase as (typeof STUDY_PHASE_OPTIONS)[number])) {
    errors.phase = 'Select a valid phase.'
  }

  if (!statusRaw) errors.status = 'Status is required.'
  else if (!STUDY_STATUS_VALUES.includes(statusRaw as StudyStatusValue)) {
    errors.status = 'Select a valid status.'
  }

  let enrollmentTarget: number | null = null
  if (enrollmentRaw) {
    const parsed = Number(enrollmentRaw)
    if (!Number.isInteger(parsed) || parsed < 1) {
      errors.enrollment_target = 'Target enrollment must be a positive whole number.'
    } else if (parsed > 1_000_000) {
      errors.enrollment_target = 'Target enrollment is too large.'
    } else {
      enrollmentTarget = parsed
    }
  }

  if (Object.keys(errors).length > 0) {
    return { ok: false, errors }
  }

  return {
    ok: true,
    data: {
      organizationId,
      title,
      studyCode: slug,
      sponsorName,
      phase,
      status: statusRaw as StudyStatusValue,
      enrollmentTarget,
    },
  }
}
