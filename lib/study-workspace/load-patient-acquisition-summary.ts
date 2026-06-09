import type { SupabaseClient } from '@supabase/supabase-js'
import { createServerClient } from '@/lib/supabase/server'

const SOURCE_SAMPLE_LIMIT = 500

export type StudyPatientAcquisitionSourceSummary = {
  source: string
  subjectCount: number
  screeningCount: number
  randomizedCount: number
  screenFailedCount: number
}

export type StudyPatientAcquisitionSummary = {
  subjectCount: number | null
  attributedSubjectCount: number | null
  unattributedSubjectCount: number | null
  screeningCount: number | null
  randomizedCount: number | null
  screenFailedCount: number | null
  topSources: StudyPatientAcquisitionSourceSummary[]
  sourceSampleLimit: number
  unavailable: string[]
}

async function safeExactCount(
  label: string,
  unavailable: string[],
  run: () => Promise<{ count: number | null; error: { message: string } | null }>,
): Promise<number | null> {
  try {
    const { count, error } = await run()
    if (error) {
      unavailable.push(`${label}: ${error.message}`)
      return null
    }
    return count ?? 0
  } catch (err) {
    unavailable.push(`${label}: ${err instanceof Error ? err.message : 'unavailable'}`)
    return null
  }
}

function addSourceRow(
  map: Map<string, StudyPatientAcquisitionSourceSummary>,
  source: string,
  enrollmentStatus: string | null,
) {
  const item = map.get(source) ?? {
    source,
    subjectCount: 0,
    screeningCount: 0,
    randomizedCount: 0,
    screenFailedCount: 0,
  }

  item.subjectCount += 1
  if (enrollmentStatus === 'screening') item.screeningCount += 1
  if (enrollmentStatus === 'randomized') item.randomizedCount += 1
  if (enrollmentStatus === 'screen_failed') item.screenFailedCount += 1
  map.set(source, item)
}

export async function loadStudyPatientAcquisitionSummary(
  studyId: string,
  organizationId: string,
  supabaseClient?: SupabaseClient,
): Promise<StudyPatientAcquisitionSummary> {
  const supabase = supabaseClient ?? (await createServerClient())
  const unavailable: string[] = []

  const [
    subjectCount,
    attributedSubjectCount,
    unattributedSubjectCount,
    screeningCount,
    randomizedCount,
    screenFailedCount,
  ] = await Promise.all([
    safeExactCount('Acquisition subjects', unavailable, async () =>
      supabase
        .from('study_subjects')
        .select('id', { count: 'exact', head: true })
        .eq('organization_id', organizationId)
        .eq('study_id', studyId),
    ),
    safeExactCount('Source attributed subjects', unavailable, async () =>
      supabase
        .from('study_subjects')
        .select('id', { count: 'exact', head: true })
        .eq('organization_id', organizationId)
        .eq('study_id', studyId)
        .not('recruitment_source', 'is', null),
    ),
    safeExactCount('Source missing subjects', unavailable, async () =>
      supabase
        .from('study_subjects')
        .select('id', { count: 'exact', head: true })
        .eq('organization_id', organizationId)
        .eq('study_id', studyId)
        .is('recruitment_source', null),
    ),
    safeExactCount('Screening subjects', unavailable, async () =>
      supabase
        .from('study_subjects')
        .select('id', { count: 'exact', head: true })
        .eq('organization_id', organizationId)
        .eq('study_id', studyId)
        .eq('enrollment_status', 'screening'),
    ),
    safeExactCount('Randomized subjects', unavailable, async () =>
      supabase
        .from('study_subjects')
        .select('id', { count: 'exact', head: true })
        .eq('organization_id', organizationId)
        .eq('study_id', studyId)
        .eq('enrollment_status', 'randomized'),
    ),
    safeExactCount('Screen failed subjects', unavailable, async () =>
      supabase
        .from('study_subjects')
        .select('id', { count: 'exact', head: true })
        .eq('organization_id', organizationId)
        .eq('study_id', studyId)
        .eq('enrollment_status', 'screen_failed'),
    ),
  ])

  let topSources: StudyPatientAcquisitionSourceSummary[] = []

  try {
    const { data, error } = await supabase
      .from('study_subjects')
      .select('recruitment_source, enrollment_status')
      .eq('organization_id', organizationId)
      .eq('study_id', studyId)
      .not('recruitment_source', 'is', null)
      .order('updated_at', { ascending: false })
      .limit(SOURCE_SAMPLE_LIMIT)

    if (error) {
      unavailable.push(`Source mix: ${error.message}`)
    } else {
      const bySource = new Map<string, StudyPatientAcquisitionSourceSummary>()
      for (const row of data ?? []) {
        const source = String(row.recruitment_source ?? '').trim()
        if (!source) continue
        addSourceRow(bySource, source, row.enrollment_status ? String(row.enrollment_status) : null)
      }
      topSources = [...bySource.values()]
        .sort((a, b) => b.subjectCount - a.subjectCount)
        .slice(0, 5)
    }
  } catch (err) {
    unavailable.push(`Source mix: ${err instanceof Error ? err.message : 'unavailable'}`)
  }

  return {
    subjectCount,
    attributedSubjectCount,
    unattributedSubjectCount,
    screeningCount,
    randomizedCount,
    screenFailedCount,
    topSources,
    sourceSampleLimit: SOURCE_SAMPLE_LIMIT,
    unavailable,
  }
}
