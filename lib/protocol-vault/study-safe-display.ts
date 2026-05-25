/**
 * Sanitized study labels — prefer getStudyDisplay(studyId, 'sanitized') for new code.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  buildSanitizedStudyDisplayFromParts,
  getStudyDisplay,
  getStudyDisplayBatch,
  toStudySafeDisplay,
  type StudyDisplayPartsInput,
} from '@/lib/protocol-vault/study-display'
import { buildRuntimeSafeStudyLabel } from '@/lib/protocol-vault/runtime-boundary'
import type { StudySafeDisplay } from '@/lib/protocol-vault/types'

export type { StudyDisplayPartsInput }

/** @deprecated Use buildSanitizedStudyDisplayFromParts or buildStudyDisplayFromParts */
export function buildStudySafeDisplayFromParts(input: StudyDisplayPartsInput): StudySafeDisplay {
  return toStudySafeDisplay(buildSanitizedStudyDisplayFromParts(input))
}

export async function getStudySafeDisplay(
  supabase: SupabaseClient,
  studyId: string,
): Promise<StudySafeDisplay | null> {
  const display = await getStudyDisplay(supabase, studyId, 'sanitized')
  return display ? toStudySafeDisplay(display) : null
}

export async function getStudySafeDisplayBatch(
  supabase: SupabaseClient,
  studyIds: string[],
): Promise<Map<string, StudySafeDisplay>> {
  const displays = await getStudyDisplayBatch(supabase, studyIds, 'sanitized')
  const result = new Map<string, StudySafeDisplay>()
  for (const [id, display] of displays) {
    result.set(id, toStudySafeDisplay(display))
  }
  return result
}

export { buildRuntimeSafeStudyLabel }
