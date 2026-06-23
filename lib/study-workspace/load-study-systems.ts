import type { SupabaseClient } from '@supabase/supabase-js'
import { mapStudySystemRow, type StudySystemEntry } from './study-systems'

const SELECT_COLS = `
  study_system_id, study_id, system_library_id,
  system_name, vendor_name, system_type, system_category,
  launch_url, support_email, support_url, training_url,
  login_notes, owner_role,
  active, pinned, is_custom, created_by,
  created_at, updated_at
`

/**
 * Load all registered systems for a study, with pinned systems first.
 *
 * Returns active + inactive systems so the UI can display both.
 * The caller decides display filtering.
 */
export async function loadStudySystems(
  supabase: SupabaseClient,
  studyId: string,
  unavailable?: string[],
): Promise<StudySystemEntry[]> {
  try {
    const { data, error } = await supabase
      .from('study_systems')
      .select(SELECT_COLS)
      .eq('study_id', studyId)
      .order('pinned', { ascending: false })
      .order('system_name', { ascending: true })

    if (error) {
      unavailable?.push(`Study systems: ${error.message}`)
      return []
    }

    return (data ?? []).map(mapStudySystemRow)
  } catch (err) {
    unavailable?.push(
      `Study systems: ${err instanceof Error ? err.message : 'unavailable'}`,
    )
    return []
  }
}

/**
 * Load only active, non-deleted systems for display.
 */
export async function loadActiveStudySystems(
  supabase: SupabaseClient,
  studyId: string,
  unavailable?: string[],
): Promise<StudySystemEntry[]> {
  const all = await loadStudySystems(supabase, studyId, unavailable)
  return all.filter((s) => s.active)
}
