import type { OrganizationMembership } from '@/lib/auth/session'
import { getOrganizationMemberships, getSessionUser } from '@/lib/auth/session'
import { additionalRoles } from '@/lib/admin/users/role-labels'
import { rolesFromMembershipRow } from '@/lib/admin/users/role-policy'
import type { OrganizationMembersAdminModel, OrganizationMemberRow } from '@/lib/admin/users/types'
import { resolveEmailsForUserIds } from '@/lib/admin/users/auth-lookup'
import {
  canManageUsers,
  canPerformOwnershipCriticalActions,
  hasSiteAdminAccess,
} from '@/lib/rbac/permissions'
import { resolvePrimaryRole } from '@/lib/rbac/effective-roles'
import { createServerClient } from '@/lib/supabase/server'

export async function loadOrganizationMembersAdmin(
  organizationId: string,
): Promise<
  | { ok: true; model: OrganizationMembersAdminModel }
  | { ok: false; reason: 'unauthorized' | 'forbidden' | 'not_found' }
> {
  const user = await getSessionUser()
  if (!user) return { ok: false, reason: 'unauthorized' }

  const memberships = await getOrganizationMemberships(user.id)
  if (!hasSiteAdminAccess(memberships, organizationId)) {
    return { ok: false, reason: 'forbidden' }
  }

  const supabase = await createServerClient()
  const { data: org, error: orgErr } = await supabase
    .from('organizations')
    .select('id, name')
    .eq('id', organizationId)
    .maybeSingle()

  if (orgErr || !org) return { ok: false, reason: 'not_found' }

  type MemberRow = {
    id: string
    organization_id: string
    user_id: string
    role: string
    roles: string[] | null
    created_at: string
    updated_at?: string | null
  }

  const fullSelect = await supabase
    .from('organization_members')
    .select('id, organization_id, user_id, role, roles, created_at, updated_at')
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: true })

  let rows: MemberRow[] | null = fullSelect.data as MemberRow[] | null
  if (fullSelect.error && /updated_at/i.test(fullSelect.error.message)) {
    const legacy = await supabase
      .from('organization_members')
      .select('id, organization_id, user_id, role, roles, created_at')
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: true })
    rows = legacy.data as MemberRow[] | null
  } else if (fullSelect.error) {
    return { ok: false, reason: 'not_found' }
  }

  const userIds = (rows ?? []).map((r) => r.user_id as string)
  const emailByUserId = await resolveEmailsForUserIds(userIds)

  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, display_name')
    .in('id', userIds.length > 0 ? userIds : ['00000000-0000-0000-0000-000000000000'])

  const displayByUserId = new Map<string, string>()
  for (const p of profiles ?? []) {
    if (p.display_name) displayByUserId.set(p.id as string, p.display_name as string)
  }

  const actorIsOwner = canPerformOwnershipCriticalActions(memberships, organizationId)
  const actorIsAdmin = canManageUsers(memberships, organizationId)

  const members: OrganizationMemberRow[] = (rows ?? []).map((row) => {
    const roles = rolesFromMembershipRow({ role: row.role, roles: row.roles })
    const primary = resolvePrimaryRole({ role: row.role, roles: row.roles }) ?? roles[0] ?? null
    return {
      id: row.id as string,
      organizationId: row.organization_id as string,
      userId: row.user_id as string,
      email: emailByUserId.get(row.user_id as string) ?? null,
      displayName: displayByUserId.get(row.user_id as string) ?? null,
      primaryRole: primary,
      roles,
      additionalRoles: additionalRoles(primary, roles),
      joinedAt: row.created_at as string,
      updatedAt: (row.updated_at as string | null) ?? null,
      statusLabel: 'Active',
    }
  })

  const inviteSupported = Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY?.trim())

  return {
    ok: true,
    model: {
      organizationId,
      organizationName: org.name as string,
      actorUserId: user.id,
      actorIsOwner,
      actorIsAdmin,
      members,
      inviteSupported,
    },
  }
}

export function adminOrganizationsForUser(
  memberships: OrganizationMembership[],
): { id: string; name: string }[] {
  return memberships
    .filter((m) => hasSiteAdminAccess([m], m.organization_id))
    .map((m) => ({
      id: m.organization_id,
      name: m.organizations?.name ?? m.organization_id,
    }))
}
