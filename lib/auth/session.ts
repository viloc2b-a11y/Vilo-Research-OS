import { createServerClient } from '@/lib/supabase/server'

export type OrganizationMembership = {
  organization_id: string
  /** Legacy primary role (RLS / display); merged with `roles` for effective permissions. */
  role: string
  /** All assigned site roles; union with `role` when evaluating permissions. */
  roles: string[]
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

  type MembershipRow = {
    organization_id: string
    role: string
    roles?: string[] | null
    organizations: { id: string; name: string } | { id: string; name: string }[] | null
  }

  const fullSelect = await supabase
    .from('organization_members')
    .select('organization_id, role, roles, organizations(id, name)')
    .eq('user_id', userId)

  let rows: MembershipRow[] | null = fullSelect.data as MembershipRow[] | null
  let error = fullSelect.error

  if (error && /roles/i.test(error.message)) {
    const legacySelect = await supabase
      .from('organization_members')
      .select('organization_id, role, organizations(id, name)')
      .eq('user_id', userId)
    rows = legacySelect.data as MembershipRow[] | null
    error = legacySelect.error
  }

  if (error) {
    console.error('getOrganizationMemberships', error.message)
    return []
  }

  return (rows ?? []).map((row) => {
    const org = row.organizations
    const organization =
      org && typeof org === 'object' && !Array.isArray(org)
        ? (org as { id: string; name: string })
        : Array.isArray(org)
          ? (org[0] as { id: string; name: string } | undefined) ?? null
          : null

    const rolesRaw = row.roles
    const roles = Array.isArray(rolesRaw)
      ? (rolesRaw as string[]).filter((r) => typeof r === 'string' && r.trim())
      : []

    return {
      organization_id: row.organization_id as string,
      role: row.role as string,
      roles,
      organizations: organization,
    }
  })
}

export async function getPrimaryOrganizationId(userId: string): Promise<string | null> {
  const memberships = await getOrganizationMemberships(userId)
  return memberships[0]?.organization_id ?? null
}
