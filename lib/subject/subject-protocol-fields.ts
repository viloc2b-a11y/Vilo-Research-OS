import { parseSubjectRole } from '@/lib/studies/protocol-primitives'
import type { SupabaseClient } from '@supabase/supabase-js'

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export async function resolveSubjectProtocolFields(
  supabase: SupabaseClient,
  input: {
    studyId: string
    organizationId: string
    subjectId?: string
    subjectRoleRaw: string | null
    householdIdRaw: string | null
    anchorSubjectIdRaw: string | null
    generateHousehold: boolean
  },
): Promise<
  | {
      ok: true
      subject_role: string
      household_id: string | null
      anchor_subject_id: string | null
    }
  | { ok: false; message: string }
> {
  const subject_role = parseSubjectRole(input.subjectRoleRaw)
  let household_id = input.householdIdRaw
  const anchor_subject_id = input.anchorSubjectIdRaw

  if (input.generateHousehold) {
    household_id = crypto.randomUUID()
  } else if (household_id && !UUID_RE.test(household_id)) {
    return { ok: false, message: 'Household ID must be a valid UUID or left empty.' }
  }

  if (anchor_subject_id) {
    if (!UUID_RE.test(anchor_subject_id)) {
      return { ok: false, message: 'Anchor subject must be a valid subject id (UUID).' }
    }
    if (input.subjectId && anchor_subject_id === input.subjectId) {
      return { ok: false, message: 'Anchor subject cannot be the same as this subject.' }
    }
    const { data: anchor, error } = await supabase
      .from('study_subjects')
      .select('id')
      .eq('id', anchor_subject_id)
      .eq('study_id', input.studyId)
      .eq('organization_id', input.organizationId)
      .maybeSingle()
    if (error) return { ok: false, message: error.message }
    if (!anchor) return { ok: false, message: 'Anchor subject not found in this study.' }
  }

  return {
    ok: true,
    subject_role,
    household_id: household_id || null,
    anchor_subject_id: anchor_subject_id || null,
  }
}
