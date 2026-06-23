import { createServerClient } from '@/lib/supabase/server'
import { getSessionUser } from '@/lib/auth/session'
import { loadStudySystems } from './load-study-systems'
import {
  enrichSystemsWithUsage,
  loadRecentlyUsedSystems,
  loadPinnedSystems,
  loadMostUsedSystems,
  type SystemWithUsage,
} from './study-system-usage'
import {
  loadStudySystemAccessWithSystems,
  calculateAccessReadiness,
  type StudySystemAccessWithSystem,
  type AccessReadinessSummary,
} from './study-system-access'

export type StudySystemsWithUsage = {
  allSystems: SystemWithUsage[]
  recentlyUsed: SystemWithUsage[]
  pinnedSystems: SystemWithUsage[]
  mostUsed: SystemWithUsage[]
}

export type StudyAccessData = {
  accessRecords: StudySystemAccessWithSystem[]
  readinessSummary: AccessReadinessSummary
}

/**
 * Load all study systems data (usage + access).
 */
export async function loadStudySystemsWithUsage(
  studyId: string,
): Promise<StudySystemsWithUsage> {
  const supabase = await createServerClient()
  const user = await getSessionUser()
  const userId = user?.id ?? ''

  const allSystems = await loadStudySystems(supabase, studyId)
  const enriched = await enrichSystemsWithUsage(supabase, studyId, userId, allSystems)

  const [recentlyUsed, pinnedSystems, mostUsed] = await Promise.all([
    userId ? loadRecentlyUsedSystems(supabase, studyId, userId, 5) : Promise.resolve([]),
    userId ? loadPinnedSystems(supabase, studyId, userId) : Promise.resolve([]),
    loadMostUsedSystems(supabase, studyId, 5),
  ])

  return {
    allSystems: enriched,
    recentlyUsed,
    pinnedSystems,
    mostUsed,
  }
}

/**
 * Load all access readiness data for a study.
 */
export async function loadStudyAccessData(
  studyId: string,
): Promise<StudyAccessData> {
  const supabase = await createServerClient()

  const [accessRecords, readinessSummary] = await Promise.all([
    loadStudySystemAccessWithSystems(supabase, studyId),
    calculateAccessReadiness(supabase, studyId),
  ])

  return { accessRecords, readinessSummary }
}
