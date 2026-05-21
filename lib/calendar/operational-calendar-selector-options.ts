import type { SupabaseClient } from '@supabase/supabase-js'

export type OperationalCalendarStudyOption = {
  id: string
  name: string
  protocolNumber: string | null
  sponsor: string | null
  status: string
}

export type OperationalCalendarSubjectOption = {
  id: string
  studyId: string
  subjectCode: string
  randomizationNumber: string | null
  status: string
}

export type OperationalCalendarVisitOption = {
  id: string
  studyId: string
  subjectId: string
  visitName: string
  visitNumber: string | null
  targetDate: string | null
  status: string
}

export type OperationalCalendarCoordinatorOption = {
  id: string
  displayName: string
  role: string
}

export type OperationalCalendarSelectorOptions = {
  studies: OperationalCalendarStudyOption[]
  subjects: OperationalCalendarSubjectOption[]
  visits: OperationalCalendarVisitOption[]
  coordinators: OperationalCalendarCoordinatorOption[]
}

type StudyRow = {
  id: string
  name: string
  status: string
  slug: string | null
  study_versions?: {
    protocol_identifier?: string | null
    metadata?: { sponsor?: string } | null
    created_at?: string
  }[] | {
    protocol_identifier?: string | null
    metadata?: { sponsor?: string } | null
    created_at?: string
  } | null
}

type SubjectRow = {
  id: string
  organization_id: string
  study_id: string
  subject_identifier: string
  randomization_number: string | null
  enrollment_status: string
}

type VisitRow = {
  id: string
  study_id: string
  study_subject_id: string
  target_date: string | null
  scheduled_date: string | null
  visit_status: string
  visit_day: number | null
  visit_definitions?: { code?: string | null; label?: string | null } | { code?: string | null; label?: string | null }[] | null
}

type MemberRow = {
  user_id: string
  role: string
}

function one<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null
  return value ?? null
}

function latestStudyVersion(
  versions: StudyRow['study_versions'],
): { protocol_identifier?: string | null; metadata?: { sponsor?: string } | null } | null {
  if (!versions) return null
  const list = Array.isArray(versions) ? versions : [versions]
  if (list.length === 0) return null
  const sorted = [...list].sort((a, b) => {
    const aTime = a.created_at ? new Date(a.created_at).getTime() : 0
    const bTime = b.created_at ? new Date(b.created_at).getTime() : 0
    return bTime - aTime
  })
  return sorted[0] ?? null
}

function formatCoordinatorLabel(profile: { display_name?: string | null } | null, userId: string): string {
  const name = profile?.display_name?.trim()
  if (name) return name
  return `User ${userId.slice(0, 8)}`
}

export async function loadOperationalCalendarSelectorOptions(
  supabase: SupabaseClient,
  organizationIds: string[],
  options?: { unblindedOrganizationIds?: string[] },
): Promise<OperationalCalendarSelectorOptions> {
  const unblindedOrganizationIds = new Set(options?.unblindedOrganizationIds ?? [])
  if (organizationIds.length === 0) {
    return { studies: [], subjects: [], visits: [], coordinators: [] }
  }

  const [studiesResult, subjectsResult, visitsResult, membersResult] = await Promise.all([
    supabase
      .from('studies')
      .select('id, name, status, slug, study_versions(protocol_identifier, metadata, created_at)')
      .in('organization_id', organizationIds)
      .order('name', { ascending: true })
      .limit(200),
    supabase
      .from('study_subjects')
      .select('id, organization_id, study_id, subject_identifier, randomization_number, enrollment_status')
      .in('organization_id', organizationIds)
      .order('subject_identifier', { ascending: true })
      .limit(1000),
    supabase
      .from('visits')
      .select(`
        id,
        study_id,
        study_subject_id,
        target_date,
        scheduled_date,
        visit_status,
        visit_day,
        visit_definitions(code, label)
      `)
      .in('organization_id', organizationIds)
      .order('target_date', { ascending: false, nullsFirst: false })
      .order('scheduled_date', { ascending: false })
      .limit(800),
    supabase
      .from('organization_members')
      .select('user_id, role')
      .in('organization_id', organizationIds)
      .order('role', { ascending: true })
      .limit(300),
  ])

  const studies = ((studiesResult.data ?? []) as StudyRow[]).map((row) => {
    const version = latestStudyVersion(row.study_versions)
    const metadata = version?.metadata as { sponsor?: string } | null | undefined
    return {
      id: row.id,
      name: row.name,
      protocolNumber: version?.protocol_identifier ?? row.slug ?? null,
      sponsor: typeof metadata?.sponsor === 'string' ? metadata.sponsor : null,
      status: row.status,
    }
  })

  const subjects = ((subjectsResult.data ?? []) as SubjectRow[]).map((row) => ({
    id: row.id,
    studyId: row.study_id,
    subjectCode: row.subject_identifier,
    randomizationNumber: unblindedOrganizationIds.has(row.organization_id)
      ? row.randomization_number
      : null,
    status: row.enrollment_status,
  }))

  const visits = ((visitsResult.data ?? []) as VisitRow[]).map((row) => {
    const def = one(row.visit_definitions)
    const visitName = def?.label ?? def?.code ?? 'Visit'
    const visitNumber = def?.code ?? (row.visit_day != null ? `Day ${row.visit_day}` : null)
    return {
      id: row.id,
      studyId: row.study_id,
      subjectId: row.study_subject_id,
      visitName,
      visitNumber,
      targetDate: row.target_date ?? row.scheduled_date,
      status: row.visit_status,
    }
  })

  const coordinatorByUser = new Map<string, OperationalCalendarCoordinatorOption>()
  if (membersResult.error) {
    console.error('loadOperationalCalendarSelectorOptions coordinators', membersResult.error.message)
  }

  for (const row of (membersResult.data ?? []) as MemberRow[]) {
    if (coordinatorByUser.has(row.user_id)) continue
    coordinatorByUser.set(row.user_id, {
      id: row.user_id,
      displayName: formatCoordinatorLabel(null, row.user_id),
      role: row.role,
    })
  }

  return {
    studies,
    subjects,
    visits,
    coordinators: [...coordinatorByUser.values()].sort((a, b) =>
      a.displayName.localeCompare(b.displayName),
    ),
  }
}

export function formatStudyOptionLabel(study: OperationalCalendarStudyOption): string {
  const parts = [study.name]
  if (study.protocolNumber) parts.push(study.protocolNumber)
  if (study.sponsor) parts.push(study.sponsor)
  parts.push(study.status)
  return parts.join(' · ')
}

export function formatSubjectOptionLabel(subject: OperationalCalendarSubjectOption): string {
  const parts = [subject.subjectCode]
  if (subject.randomizationNumber) parts.push(`Rand ${subject.randomizationNumber}`)
  parts.push(subject.status)
  return parts.join(' · ')
}

export function formatVisitOptionLabel(
  visit: OperationalCalendarVisitOption,
  subjectCode?: string,
): string {
  const parts: string[] = []
  if (subjectCode) parts.push(subjectCode)
  parts.push(visit.visitName)
  if (visit.visitNumber) parts.push(visit.visitNumber)
  if (visit.targetDate) parts.push(visit.targetDate)
  parts.push(visit.status)
  return parts.join(' · ')
}
