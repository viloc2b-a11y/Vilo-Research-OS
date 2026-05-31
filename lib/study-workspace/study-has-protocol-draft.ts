import type { SupabaseClient } from '@supabase/supabase-js'
import { createServerClient } from '@/lib/supabase/server'

/**
 * Returns true when the workspace study (studies.id) has at least one protocol
 * runtime version, i.e. a reconciliation draft can exist. Used to decide whether
 * Study Setup shows "Review Runtime Draft" vs "Continue Setup". Read-only.
 */
export async function studyHasProtocolRuntimeVersion(
  studyId: string,
  organizationId: string,
  supabaseClient?: SupabaseClient,
): Promise<boolean> {
  const supabase = supabaseClient ?? (await createServerClient())
  try {
    const { data: studies, error } = await supabase
      .from('protocol_runtime_studies')
      .select('id')
      .eq('organization_id', organizationId)
      .eq('study_id', studyId)

    if (error || !studies?.length) return false

    const runtimeStudyIds = studies.map((row) => String(row.id))
    const { count, error: versionError } = await supabase
      .from('protocol_runtime_versions')
      .select('id', { count: 'exact', head: true })
      .in('protocol_runtime_study_id', runtimeStudyIds)

    if (versionError) return false
    return (count ?? 0) > 0
  } catch {
    return false
  }
}
