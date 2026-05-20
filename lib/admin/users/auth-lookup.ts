import { createServiceClient } from '@/lib/supabase/server'

export async function findAuthUserByEmail(email: string) {
  const service = await createServiceClient()
  const normalized = email.trim().toLowerCase()
  let page = 1
  while (page <= 20) {
    const { data, error } = await service.auth.admin.listUsers({ page, perPage: 200 })
    if (error) throw new Error(error.message)
    const match = data?.users?.find((u) => u.email?.toLowerCase() === normalized)
    if (match) return match
    if (!data?.users?.length || data.users.length < 200) break
    page += 1
  }
  return null
}

export async function resolveEmailsForUserIds(
  userIds: string[],
): Promise<Map<string, string>> {
  const map = new Map<string, string>()
  if (userIds.length === 0) return map

  const service = await createServiceClient()
  const wanted = new Set(userIds)
  let page = 1
  while (page <= 20 && wanted.size > map.size) {
    const { data, error } = await service.auth.admin.listUsers({ page, perPage: 200 })
    if (error) break
    for (const user of data?.users ?? []) {
      if (user.id && user.email && wanted.has(user.id)) {
        map.set(user.id, user.email)
      }
    }
    if (!data?.users?.length || data.users.length < 200) break
    page += 1
  }
  return map
}
