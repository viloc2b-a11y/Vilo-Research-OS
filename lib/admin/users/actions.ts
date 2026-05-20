'use server'

import { revalidatePath } from 'next/cache'
import { logAuditEvent } from '@/lib/audit/log'
import { findAuthUserByEmail } from '@/lib/admin/users/auth-lookup'
import { rolesFromMembershipRow, validateRoleChange } from '@/lib/admin/users/role-policy'
import { getOrganizationMemberships, getSessionUser } from '@/lib/auth/session'
import {
  canManageUsers,
  canPerformOwnershipCriticalActions,
  hasSiteAdminAccess,
} from '@/lib/rbac/permissions'
import { createServerClient } from '@/lib/supabase/server'

export type AdminUserActionState = {
  ok: boolean
  message: string | null
}

export const INITIAL_ADMIN_USER_ACTION_STATE: AdminUserActionState = {
  ok: false,
  message: null,
}

function revalidateAdminUsers() {
  revalidatePath('/admin/users')
  revalidatePath('/admin')
}

async function requireAdminActor(organizationId: string) {
  const user = await getSessionUser()
  if (!user) return { ok: false as const, message: 'Sign in required.' }

  const memberships = await getOrganizationMemberships(user.id)
  if (!hasSiteAdminAccess(memberships, organizationId)) {
    return { ok: false as const, message: 'Admin access required for this organization.' }
  }
  if (!canManageUsers(memberships, organizationId)) {
    return { ok: false as const, message: 'You cannot manage users for this organization.' }
  }

  return {
    ok: true as const,
    user,
    memberships,
    actorIsOwner: canPerformOwnershipCriticalActions(memberships, organizationId),
    actorIsAdmin: canManageUsers(memberships, organizationId),
  }
}

async function loadMemberRows(organizationId: string) {
  const supabase = await createServerClient()
  const { data, error } = await supabase
    .from('organization_members')
    .select('id, user_id, role, roles')
    .eq('organization_id', organizationId)

  if (error) throw new Error(error.message)
  return (data ?? []).map((row) => ({
    id: row.id as string,
    userId: row.user_id as string,
    roles: rolesFromMembershipRow({ role: row.role as string, roles: row.roles as string[] }),
  }))
}

export async function updateOrganizationMemberRoles(
  _prev: AdminUserActionState,
  formData: FormData,
): Promise<AdminUserActionState> {
  const organizationId = String(formData.get('organization_id') ?? '').trim()
  const memberId = String(formData.get('member_id') ?? '').trim()
  const roleValues = formData.getAll('roles').map((v) => String(v))

  if (!organizationId || !memberId) {
    return { ok: false, message: 'Missing organization or member.' }
  }

  const actor = await requireAdminActor(organizationId)
  if (!actor.ok) return { ok: false, message: actor.message }

  const supabase = await createServerClient()
  const { data: target, error: targetErr } = await supabase
    .from('organization_members')
    .select('id, user_id, role, roles, organization_id')
    .eq('id', memberId)
    .eq('organization_id', organizationId)
    .maybeSingle()

  if (targetErr || !target) {
    return { ok: false, message: 'Member not found.' }
  }

  const allMembers = await loadMemberRows(organizationId)
  const validation = validateRoleChange({
    actorUserId: actor.user.id,
    actorIsOwner: actor.actorIsOwner,
    actorIsAdmin: actor.actorIsAdmin,
    targetUserId: target.user_id as string,
    targetCurrentRoles: rolesFromMembershipRow({
      role: target.role as string,
      roles: target.roles as string[] | null,
    }),
    requestedRoles: roleValues,
    allMembers: allMembers.map((m) => ({ userId: m.userId, roles: m.roles })),
  })

  if (!validation.ok) return { ok: false, message: validation.message }

  const { roles, primaryRole } = validation
  const { error: updateErr } = await supabase
    .from('organization_members')
    .update({
      role: primaryRole,
      roles,
    })
    .eq('id', memberId)
    .eq('organization_id', organizationId)

  if (updateErr) {
    return { ok: false, message: updateErr.message }
  }

  await logAuditEvent({
    organizationId,
    actorUserId: actor.user.id,
    action: 'organization_member.roles_updated',
    target: `organization_members:${memberId}`,
    metadata: {
      target_user_id: target.user_id,
      roles,
      primary_role: primaryRole,
    },
  })

  revalidateAdminUsers()
  return { ok: true, message: 'Roles updated.' }
}

export async function addOrganizationMemberByEmail(
  _prev: AdminUserActionState,
  formData: FormData,
): Promise<AdminUserActionState> {
  const organizationId = String(formData.get('organization_id') ?? '').trim()
  const email = String(formData.get('email') ?? '').trim()
  const initialRole = String(formData.get('initial_role') ?? 'research_coordinator').trim()

  if (!organizationId || !email) {
    return { ok: false, message: 'Organization and email are required.' }
  }

  const actor = await requireAdminActor(organizationId)
  if (!actor.ok) return { ok: false, message: actor.message }

  if (initialRole === 'owner' && !actor.actorIsOwner) {
    return { ok: false, message: 'Only an owner can add a member with the owner role.' }
  }

  let authUser
  try {
    authUser = await findAuthUserByEmail(email)
  } catch (err) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : 'Could not look up user.',
    }
  }

  if (!authUser?.id) {
    return {
      ok: false,
      message:
        'No account found for that email. User must sign up or be provisioned first — invite-by-email is not wired yet.',
    }
  }

  const validation = validateRoleChange({
    actorUserId: actor.user.id,
    actorIsOwner: actor.actorIsOwner,
    actorIsAdmin: actor.actorIsAdmin,
    targetUserId: authUser.id,
    targetCurrentRoles: [],
    requestedRoles: [initialRole],
    allMembers: (await loadMemberRows(organizationId)).map((m) => ({
      userId: m.userId,
      roles: m.roles,
    })),
  })

  if (!validation.ok) return { ok: false, message: validation.message }

  const { roles, primaryRole } = validation
  const supabase = await createServerClient()

  const { data: existing } = await supabase
    .from('organization_members')
    .select('id')
    .eq('organization_id', organizationId)
    .eq('user_id', authUser.id)
    .maybeSingle()

  if (existing?.id) {
    return { ok: false, message: 'This user is already a member of the organization.' }
  }

  const { error: insertErr } = await supabase.from('organization_members').insert({
    organization_id: organizationId,
    user_id: authUser.id,
    role: primaryRole,
    roles,
  })

  if (insertErr) {
    return { ok: false, message: insertErr.message }
  }

  await logAuditEvent({
    organizationId,
    actorUserId: actor.user.id,
    action: 'organization_member.added',
    target: `auth.users:${authUser.id}`,
    metadata: { email: authUser.email, roles, primary_role: primaryRole },
  })

  revalidateAdminUsers()
  return { ok: true, message: `Added ${authUser.email ?? email} to the organization.` }
}
