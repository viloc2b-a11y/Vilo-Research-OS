import type { SupabaseClient } from '@supabase/supabase-js'

export type ResolvedCalendarLinks = {
  studyId: string | null
  subjectId: string | null
  visitId: string | null
  assignedUserId: string | null
  organizationId: string | null
  storageStudyId: string | null
  studyLabel: string | null
  subjectLabel: string | null
  visitLabel: string | null
  assignedUserLabel: string | null
  subjectIdentifier: string | null
}

function one<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null
  return value ?? null
}

export async function validateOrganizationUser(
  supabase: SupabaseClient,
  organizationIds: string[],
  userId: string | null,
): Promise<string | null> {
  if (!userId) return null
  const { data, error } = await supabase
    .from('organization_members')
    .select('user_id')
    .eq('user_id', userId)
    .in('organization_id', organizationIds)
    .limit(1)
    .maybeSingle()
  if (error) return 'Could not validate organization user.'
  if (!data) return 'Selected user is not a member of your organization.'
  return null
}

async function loadUserLabel(
  supabase: SupabaseClient,
  userId: string | null,
): Promise<string | null> {
  if (!userId) return null
  const { data } = await supabase
    .from('profiles')
    .select('display_name')
    .eq('id', userId)
    .maybeSingle()
  const name = data?.display_name?.trim()
  return name || `User ${userId.slice(0, 8)}`
}

async function loadStudyLabel(
  supabase: SupabaseClient,
  studyId: string,
): Promise<string | null> {
  const { data } = await supabase
    .from('studies')
    .select('name, slug, study_versions(protocol_identifier, metadata, created_at)')
    .eq('id', studyId)
    .maybeSingle()
  if (!data) return null
  const versions = data.study_versions
  const versionList = Array.isArray(versions) ? versions : versions ? [versions] : []
  const latest = versionList.sort((a, b) => {
    const aTime = a.created_at ? new Date(a.created_at).getTime() : 0
    const bTime = b.created_at ? new Date(b.created_at).getTime() : 0
    return bTime - aTime
  })[0]
  const protocol = latest?.protocol_identifier ?? data.slug
  const sponsor = (latest?.metadata as { sponsor?: string } | null)?.sponsor
  return [data.name, protocol, sponsor].filter(Boolean).join(' · ') || data.name
}

export async function resolveCalendarLinks(input: {
  supabase: SupabaseClient
  organizationIds: string[]
  studyId: string | null
  subjectId: string | null
  visitId: string | null
  assignedUserId: string | null
  requireStorageStudy?: boolean
}): Promise<{ ok: true; data: ResolvedCalendarLinks } | { ok: false; message: string }> {
  const { supabase, organizationIds } = input
  let studyId = input.studyId
  let subjectId = input.subjectId
  const visitId = input.visitId
  const assignedUserId = input.assignedUserId

  const userError = await validateOrganizationUser(supabase, organizationIds, assignedUserId)
  if (userError) return { ok: false, message: userError }

  if (visitId) {
    const { data: visit, error } = await supabase
      .from('visits')
      .select('id, organization_id, study_id, study_subject_id, visit_definitions(label, code)')
      .eq('id', visitId)
      .in('organization_id', organizationIds)
      .maybeSingle()
    if (error) return { ok: false, message: 'Could not validate related visit.' }
    if (!visit) return { ok: false, message: 'Related visit is unavailable or outside your organization.' }
    studyId = visit.study_id as string
    subjectId = visit.study_subject_id as string
  }

  if (subjectId) {
    const { data: subject, error } = await supabase
      .from('study_subjects')
      .select('id, organization_id, study_id, subject_identifier')
      .eq('id', subjectId)
      .in('organization_id', organizationIds)
      .maybeSingle()
    if (error) return { ok: false, message: 'Could not validate related subject.' }
    if (!subject) return { ok: false, message: 'Related subject is unavailable or outside your organization.' }
    if (studyId && subject.study_id !== studyId) {
      return { ok: false, message: 'Subject does not belong to the selected study.' }
    }
    studyId = subject.study_id as string
  }

  if (studyId) {
    const { data: study, error } = await supabase
      .from('studies')
      .select('id, organization_id')
      .eq('id', studyId)
      .in('organization_id', organizationIds)
      .maybeSingle()
    if (error) return { ok: false, message: 'Could not validate study access.' }
    if (!study) return { ok: false, message: 'Study is unavailable or outside your organization.' }
  }

  let organizationId: string | null = null
  let storageStudyId: string | null = studyId

  if (studyId) {
    const { data: study } = await supabase
      .from('studies')
      .select('organization_id')
      .eq('id', studyId)
      .maybeSingle()
    organizationId = study?.organization_id as string | null ?? null
  }

  if (!storageStudyId && input.requireStorageStudy) {
    const { data: fallbackStudy, error } = await supabase
      .from('studies')
      .select('id, organization_id')
      .in('organization_id', organizationIds)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle()
    if (error) return { ok: false, message: 'Could not resolve organization calendar storage.' }
    if (!fallbackStudy) {
      return { ok: false, message: 'Create or select a study before adding calendar events.' }
    }
    storageStudyId = fallbackStudy.id as string
    organizationId = fallbackStudy.organization_id as string
  } else if (studyId && !organizationId) {
    return { ok: false, message: 'Could not resolve organization for the selected study.' }
  }

  let visitLabel: string | null = null
  if (visitId) {
    const { data: visit } = await supabase
      .from('visits')
      .select('visit_definitions(label, code)')
      .eq('id', visitId)
      .maybeSingle()
    const def = one(visit?.visit_definitions)
    visitLabel = def?.label ?? def?.code ?? null
  }

  let subjectLabel: string | null = null
  let subjectIdentifier: string | null = null
  if (subjectId) {
    const { data: subject } = await supabase
      .from('study_subjects')
      .select('subject_identifier')
      .eq('id', subjectId)
      .maybeSingle()
    subjectIdentifier = subject?.subject_identifier as string | null ?? null
    subjectLabel = subjectIdentifier
  }

  const studyLabel = studyId ? await loadStudyLabel(supabase, studyId) : null
  const assignedUserLabel = await loadUserLabel(supabase, assignedUserId)

  return {
    ok: true,
    data: {
      studyId,
      subjectId,
      visitId,
      assignedUserId,
      organizationId,
      storageStudyId,
      studyLabel,
      subjectLabel,
      visitLabel,
      assignedUserLabel,
      subjectIdentifier,
    },
  }
}
