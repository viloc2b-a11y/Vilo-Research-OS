import type { SupabaseClient } from '@supabase/supabase-js'

export type SubjectChartActorRole = 'org_admin' | 'study_admin' | 'coordinator'

export type SubjectChartPermissions = {
  canVerify: boolean
  actorRole: SubjectChartActorRole
}

async function rpcFlag(
  supabase: SupabaseClient,
  fn: string,
  args: Record<string, string>,
): Promise<boolean> {
  const { data, error } = await supabase.rpc(fn, args).single()
  return !error && Boolean(data)
}

/**
 * Resolves verify permission for Subject Workspace clinical profile.
 * Only org admins and study admins may verify; coordinators and CRA are read-only.
 */
export async function resolveSubjectChartPermissions(
  supabase: SupabaseClient,
  input: { organizationId: string; studyId: string | null },
): Promise<SubjectChartPermissions> {
  if (!input.studyId) {
    return { canVerify: false, actorRole: 'coordinator' }
  }

  const [isOrgAdmin, isStudyAdmin] = await Promise.all([
    rpcFlag(supabase, 'user_is_org_admin', { org_id: input.organizationId }),
    rpcFlag(supabase, 'user_is_study_admin', { study_id: input.studyId }),
  ])

  const canVerify = isOrgAdmin || isStudyAdmin
  const actorRole: SubjectChartActorRole = isOrgAdmin
    ? 'org_admin'
    : isStudyAdmin
      ? 'study_admin'
      : 'coordinator'

  return { canVerify, actorRole }
}
