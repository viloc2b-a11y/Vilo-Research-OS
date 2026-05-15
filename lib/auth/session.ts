import { createServerClient } from '@/lib/supabase/server'

export type OrganizationMembership = {
  organization_id: string
  role: string
  organizations: { id: string; name: string } | null
}

export async function getSessionUser() {
  const supabase = await createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return user
}

export async function getOrganizationMemberships(
  userId: string,
): Promise<OrganizationMembership[]> {
  const supabase = await createServerClient()

  const { data, error } = await supabase
    .from('organization_members')
    .select('organization_id, role, organizations(id, name)')
    .eq('user_id', userId)

  if (error) {
    console.error('getOrganizationMemberships', error.message)
    return []
  }

  return (data ?? []).map((row) => {
    const org = row.organizations
    const organization =
      org && typeof org === 'object' && !Array.isArray(org)
        ? (org as { id: string; name: string })
        : Array.isArray(org)
          ? (org[0] as { id: string; name: string } | undefined) ?? null
          : null

    return {
      organization_id: row.organization_id as string,
      role: row.role as string,
      organizations: organization,
    }
  })
}

export async function getPrimaryOrganizationId(userId: string): Promise<string | null> {
  const memberships = await getOrganizationMemberships(userId)
  return memberships[0]?.organization_id ?? null
}
