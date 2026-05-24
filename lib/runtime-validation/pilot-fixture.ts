import {
  PILOT_FIXTURE_DEFAULTS,
  PHASE11_ENV_KEYS,
} from '@/lib/runtime-validation/pilot-fixture-defaults'
import type { SupabaseClient } from '@supabase/supabase-js'

export type PilotFixtureResolveHint = {
  missingEnv: string[]
  usedDefaults: boolean
  hint: string
}

export type PilotFixture = {
  studyId: string
  studySubjectId: string
  visitId: string
  organizationId: string
  studySlug: string | null
  subjectIdentifier: string | null
  visitStatus: string | null
  discoveredAt: string
}

/**
 * Resolve pilot IDs from env or discover from DB (service role).
 */
export function pilotFixtureEnvHints(): PilotFixtureResolveHint {
  const missingEnv = PHASE11_ENV_KEYS.filter((key) => !process.env[key]?.trim())
  const usedDefaults = missingEnv.length === PHASE11_ENV_KEYS.length
  return {
    missingEnv,
    usedDefaults,
    hint: usedDefaults
      ? 'Using PILOT_FIXTURE_DEFAULTS (phase2-validation-study). Set PHASE11_* in .env.local or CI for explicit scope.'
      : missingEnv.length > 0
        ? `Partial PHASE11_* env — missing: ${missingEnv.join(', ')}`
        : 'PHASE11_* env fully specified.',
  }
}

export async function resolvePilotFixture(input: {
  supabase: SupabaseClient
  studyId?: string
  studySubjectId?: string
  visitId?: string
  organizationId?: string
  allowDefaultFixture?: boolean
}): Promise<PilotFixture | null> {
  if (input.visitId && input.organizationId && input.studyId && input.studySubjectId) {
    return {
      studyId: input.studyId,
      studySubjectId: input.studySubjectId,
      visitId: input.visitId,
      organizationId: input.organizationId,
      studySlug: null,
      subjectIdentifier: null,
      visitStatus: null,
      discoveredAt: new Date().toISOString(),
    }
  }

  const envStudyId =
    input.studyId ??
    process.env.PHASE11_STUDY_ID?.trim() ??
    process.env.PHASE9_STUDY_ID?.trim() ??
    (input.allowDefaultFixture === false ? undefined : PILOT_FIXTURE_DEFAULTS.studyId)
  const usedDefaults =
    !process.env.PHASE11_STUDY_ID?.trim()
    && !process.env.PHASE9_STUDY_ID?.trim()
    && input.allowDefaultFixture !== false
  const studyId = envStudyId
  if (!studyId) return null
  const envOrganizationId = input.organizationId ?? process.env.PHASE11_ORG_ID?.trim()

  const { data: study } = await input.supabase
    .from('studies')
    .select('id, organization_id, slug')
    .eq('id', studyId)
    .maybeSingle()

  if (!study) return null
  const studyOrganizationId = study.organization_id as string
  if (envOrganizationId && envOrganizationId !== studyOrganizationId) {
    throw new Error(
      `PHASE11_ORG_ID (${envOrganizationId}) does not match studies.organization_id (${studyOrganizationId}) for PHASE11_STUDY_ID (${studyId}).`,
    )
  }
  const organizationId = envOrganizationId ?? studyOrganizationId

  let studySubjectId =
    input.studySubjectId ??
    process.env.PHASE11_SUBJECT_ID?.trim() ??
    (usedDefaults ? PILOT_FIXTURE_DEFAULTS.studySubjectId : undefined)
  if (!studySubjectId) {
    const { data: sub } = await input.supabase
      .from('study_subjects')
      .select('id, subject_identifier')
      .eq('study_id', studyId)
      .eq('organization_id', organizationId)
      .in('enrollment_status', ['enrolled', 'randomized', 'screening'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    studySubjectId = sub?.id as string | undefined
  }

  if (!studySubjectId) return null

  let visitId =
    input.visitId ??
    process.env.PHASE11_VISIT_ID?.trim() ??
    (usedDefaults ? PILOT_FIXTURE_DEFAULTS.visitId : undefined)
  let visitStatus: string | null = null
  if (!visitId) {
    const { data: visit } = await input.supabase
      .from('visits')
      .select('id, visit_status')
      .eq('study_subject_id', studySubjectId)
      .eq('organization_id', organizationId)
      .in('visit_status', ['checked_in', 'in_progress', 'scheduled'])
      .order('scheduled_date', { ascending: false })
      .limit(1)
      .maybeSingle()
    visitId = visit?.id as string | undefined
    visitStatus = (visit?.visit_status as string) ?? null
  }

  if (!visitId) return null

  const { data: subRow } = await input.supabase
    .from('study_subjects')
    .select('subject_identifier')
    .eq('id', studySubjectId)
    .maybeSingle()

  return {
    studyId,
    studySubjectId,
    visitId,
    organizationId,
    studySlug: (study.slug as string) ?? null,
    subjectIdentifier: (subRow?.subject_identifier as string) ?? null,
    visitStatus,
    discoveredAt: new Date().toISOString(),
  }
}
