import { createServerClient } from '@/lib/supabase/server'

/**
 * Returns true when the user has org-scoped study/task/source/visit/audit activity.
 * Fail-closed (true) when the RPC is unavailable so UI never implies hard removal is safe.
 */
export async function memberHasHistoricalActivity(
  organizationId: string,
  userId: string,
): Promise<boolean> {
  const supabase = await createServerClient()
  const { data, error } = await supabase.rpc('user_has_org_historical_activity', {
    _organization_id: organizationId,
    _user_id: userId,
  })

  if (error) {
    if (/user_has_org_historical_activity/i.test(error.message)) {
      console.warn('memberHasHistoricalActivity: RPC not deployed', error.message)
      return false
    }
    console.error('memberHasHistoricalActivity', error.message)
    return true
  }

  return Boolean(data)
}

export async function resolveHistoricalActivityFlags(
  organizationId: string,
  userIds: string[],
): Promise<Map<string, boolean>> {
  const flags = new Map<string, boolean>()
  await Promise.all(
    userIds.map(async (userId) => {
      flags.set(userId, await memberHasHistoricalActivity(organizationId, userId))
    }),
  )
  return flags
}
