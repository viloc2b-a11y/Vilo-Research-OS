'use server'

import { revalidatePath } from 'next/cache'
import { logAuditEvent } from '@/lib/audit/log'
import { findAuthUserByEmail } from '@/lib/admin/users/auth-lookup'
import {
  validateDeactivation,
  validateReactivation,
  type MemberPolicySnapshot,
} from '@/lib/admin/users/deactivation-policy'
import {
  normalizeMembershipStatus,
  type OrganizationMemberStatus,
} from '@/lib/admin/users/membership-status'
import { rolesFromMembershipRow, validateRoleChange } from '@/lib/admin/users/role-policy'
import { requireActiveOrganizationAccess } from '@/lib/auth/membership-access'
import {
  canManageUsers,
  canPerformOwnershipCriticalActions,
  hasSiteAdminAccess,
  canManageUnblindedData,
} from '@/lib/rbac/permissions'
import { createServerClient } from '@/lib/supabase/server'
import type { AdminUserActionState } from '@/lib/admin/users/actions-state'

function revalidateAdminUsers() {
  try {
    revalidatePath('/admin/users')
    revalidatePath('/admin')
  } catch (err) {
    console.error('revalidateAdminUsers failed', err)
  }
}

function mapMembershipUpdateError(message: string): string {
  if (/row-level security|permission denied|42501/i.test(message)) {
    return 'You do not have permission to update roles for this organization.'
  }
  if (/organization_members_roles_check|organization_members_role_check/i.test(message)) {
    return 'One or more roles are not allowed for site memberships.'
  }
  if (/organization_members_status_check/i.test(message)) {
    return 'Invalid membership status.'
  }
  return message
}

async function requireAdminActor(organizationId: string) {
  const access = await requireActiveOrganizationAccess(organizationId)
  if (!access.ok) return { ok: false as const, message: access.message }

  const { user, memberships } = access
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
    actorCanManageUnblinded: canManageUnblindedData(memberships, organizationId),
  }
}

async function loadMemberRows(
  organizationId: string,
): Promise<
  | { ok: true; members: MemberPolicySnapshot[] }
  | { ok: false; message: string }
> {
  const supabase = await createServerClient()
  const { data, error } = await supabase
    .from('organization_members')
    .select('id, user_id, role, roles, status')
    .eq('organization_id', organizationId)

  if (error) {
    if (/status/i.test(error.message)) {
      const legacy = await supabase
        .from('organization_members')
        .select('id, user_id, role, roles')
        .eq('organization_id', organizationId)
      if (legacy.error) {
        console.error('loadMemberRows', legacy.error.message)
        return { ok: false, message: 'Could not load organization members.' }
      }
      return {
        ok: true,
        members: (legacy.data ?? []).map((row) => ({
          userId: row.user_id as string,
          roles: rolesFromMembershipRow({
            role: row.role as string,
            roles: row.roles as string[] | null,
          }),
          status: 'active' as OrganizationMemberStatus,
        })),
      }
    }
    console.error('loadMemberRows', error.message)
    return { ok: false, message: 'Could not load organization members.' }
  }

  return {
    ok: true,
    members: (data ?? []).map((row) => ({
      userId: row.user_id as string,
      roles: rolesFromMembershipRow({
        role: row.role as string,
        roles: row.roles as string[] | null,
      }),
      status: normalizeMembershipStatus(row.status as string | null),
    })),
  }
}

export async function updateOrganizationMemberRoles(
  _prev: AdminUserActionState,
  formData: FormData,
): Promise<AdminUserActionState> {
  try {
    const organizationId = String(formData.get('organization_id') ?? '').trim()
    const memberId = String(formData.get('member_id') ?? '').trim()
    const roleValues = formData.getAll('roles').map((v) => String(v))

    if (!organizationId || !memberId) {
      return { ok: false, message: 'Missing organization or member.' }
    }

    const actor = await requireAdminActor(organizationId)
    if (!actor.ok) return { ok: false, message: actor.message }

    const supabase = await createServerClient()

    type TargetRow = {
      id: string
      user_id: string
      role: string
      roles: string[] | null
      organization_id: string
      status?: string | null
    }

    let target: TargetRow | null = null

    const targetSelect = await supabase
      .from('organization_members')
      .select('id, user_id, role, roles, organization_id, status')
      .eq('id', memberId)
      .eq('organization_id', organizationId)
      .maybeSingle()

    if (targetSelect.error && /status/i.test(targetSelect.error.message)) {
      const legacy = await supabase
        .from('organization_members')
        .select('id, user_id, role, roles, organization_id')
        .eq('id', memberId)
        .eq('organization_id', organizationId)
        .maybeSingle()
      if (legacy.error || !legacy.data) {
        console.error('updateOrganizationMemberRoles target', targetSelect.error.message)
        return { ok: false, message: 'Could not load member.' }
      }
      target = legacy.data as TargetRow
    } else if (targetSelect.error) {
      console.error('updateOrganizationMemberRoles target', targetSelect.error.message)
      return { ok: false, message: 'Could not load member.' }
    } else {
      target = targetSelect.data as TargetRow | null
    }

    if (!target) {
      return { ok: false, message: 'Member not found.' }
    }

    const loaded = await loadMemberRows(organizationId)
    if (!loaded.ok) return { ok: false, message: loaded.message }

    const targetRoles = rolesFromMembershipRow({
      role: target.role as string,
      roles: target.roles as string[] | null,
    })

    const validation = validateRoleChange({
      actorUserId: actor.user.id,
      actorIsOwner: actor.actorIsOwner,
      actorIsAdmin: actor.actorIsAdmin,
      actorCanManageUnblinded: actor.actorCanManageUnblinded,
      targetUserId: target.user_id as string,
      targetCurrentRoles: targetRoles,
      requestedRoles: roleValues,
      allMembers: loaded.members.map((m) => ({ userId: m.userId, roles: m.roles })),
    })

    if (!validation.ok) return { ok: false, message: validation.message }

    const { roles, primaryRole } = validation
    const { data: updatedRow, error: updateErr } = await supabase
      .from('organization_members')
      .update({
        role: primaryRole,
        roles,
      })
      .eq('id', memberId)
      .eq('organization_id', organizationId)
      .select('id')
      .maybeSingle()

    if (updateErr) {
      return { ok: false, message: mapMembershipUpdateError(updateErr.message) }
    }
    if (!updatedRow) {
      return {
        ok: false,
        message:
          'Could not update roles. You may lack permission, or the membership was removed.',
      }
    }

    await logAuditEvent({
      organizationId,
      actorUserId: actor.user.id,
      action: 'organization_member.roles_updated',
      target: `organization_members:${memberId}`,
      metadata: {
        target_user_id: target.user_id,
        previous_roles: targetRoles,
        new_roles: roles,
        primary_role: primaryRole,
        membership_status: normalizeMembershipStatus(
          (target as { status?: string }).status,
        ),
      },
    })

    revalidateAdminUsers()
    return { ok: true, message: 'Roles updated.' }
  } catch (err) {
    console.error('updateOrganizationMemberRoles', err)
    return {
      ok: false,
      message:
        err instanceof Error ? err.message : 'An unexpected error occurred while saving roles.',
    }
  }
}

export async function deactivateOrganizationMember(
  _prev: AdminUserActionState,
  formData: FormData,
): Promise<AdminUserActionState> {
  try {
    const organizationId = String(formData.get('organization_id') ?? '').trim()
    const memberId = String(formData.get('member_id') ?? '').trim()
    const reason = String(formData.get('deactivation_reason') ?? '').trim() || null

    if (!organizationId || !memberId) {
      return { ok: false, message: 'Missing organization or member.' }
    }

    const actor = await requireAdminActor(organizationId)
    if (!actor.ok) return { ok: false, message: actor.message }

    const supabase = await createServerClient()
    const { data: target, error: targetErr } = await supabase
      .from('organization_members')
      .select('id, user_id, role, roles, status')
      .eq('id', memberId)
      .eq('organization_id', organizationId)
      .maybeSingle()

    if (targetErr || !target) {
      return { ok: false, message: 'Member not found.' }
    }

    const loaded = await loadMemberRows(organizationId)
    if (!loaded.ok) return { ok: false, message: loaded.message }

    const targetRoles = rolesFromMembershipRow({
      role: target.role as string,
      roles: target.roles as string[] | null,
    })
    const targetStatus = normalizeMembershipStatus(target.status as string | null)

    const validation = validateDeactivation({
      actorUserId: actor.user.id,
      actorIsOwner: actor.actorIsOwner,
      actorIsAdmin: actor.actorIsAdmin,
      targetUserId: target.user_id as string,
      targetRoles,
      targetStatus,
      allMembers: loaded.members,
    })

    if (!validation.ok) return { ok: false, message: validation.message }

    const { data: updatedRow, error: updateErr } = await supabase
      .from('organization_members')
      .update({
        status: 'deactivated',
        deactivated_at: new Date().toISOString(),
        deactivated_by: actor.user.id,
        deactivation_reason: reason,
      })
      .eq('id', memberId)
      .eq('organization_id', organizationId)
      .select('id')
      .maybeSingle()

    if (updateErr) {
      return { ok: false, message: mapMembershipUpdateError(updateErr.message) }
    }
    if (!updatedRow) {
      return { ok: false, message: 'Could not deactivate member.' }
    }

    await logAuditEvent({
      organizationId,
      actorUserId: actor.user.id,
      action: 'organization_member.deactivated',
      target: `organization_members:${memberId}`,
      metadata: {
        target_user_id: target.user_id,
        previous_roles: targetRoles,
        new_roles: targetRoles,
        previous_status: targetStatus,
        new_status: 'deactivated',
        mutation_reason: reason,
      },
    })

    revalidateAdminUsers()
    return { ok: true, message: 'Member deactivated. Historical records retain this user.' }
  } catch (err) {
    console.error('deactivateOrganizationMember', err)
    return {
      ok: false,
      message:
        err instanceof Error ? err.message : 'An unexpected error occurred while deactivating.',
    }
  }
}

export async function reactivateOrganizationMember(
  _prev: AdminUserActionState,
  formData: FormData,
): Promise<AdminUserActionState> {
  try {
    const organizationId = String(formData.get('organization_id') ?? '').trim()
    const memberId = String(formData.get('member_id') ?? '').trim()

    if (!organizationId || !memberId) {
      return { ok: false, message: 'Missing organization or member.' }
    }

    const actor = await requireAdminActor(organizationId)
    if (!actor.ok) return { ok: false, message: actor.message }

    const supabase = await createServerClient()
    const { data: target, error: targetErr } = await supabase
      .from('organization_members')
      .select('id, user_id, role, roles, status')
      .eq('id', memberId)
      .eq('organization_id', organizationId)
      .maybeSingle()

    if (targetErr || !target) {
      return { ok: false, message: 'Member not found.' }
    }

    const targetRoles = rolesFromMembershipRow({
      role: target.role as string,
      roles: target.roles as string[] | null,
    })
    const targetStatus = normalizeMembershipStatus(target.status as string | null)

    const validation = validateReactivation({
      actorUserId: actor.user.id,
      actorIsOwner: actor.actorIsOwner,
      actorIsAdmin: actor.actorIsAdmin,
      targetUserId: target.user_id as string,
      targetRoles,
      targetStatus,
      allMembers: [],
    })

    if (!validation.ok) return { ok: false, message: validation.message }

    const { data: updatedRow, error: updateErr } = await supabase
      .from('organization_members')
      .update({
        status: 'active',
        deactivated_at: null,
        deactivated_by: null,
        deactivation_reason: null,
      })
      .eq('id', memberId)
      .eq('organization_id', organizationId)
      .select('id')
      .maybeSingle()

    if (updateErr) {
      return { ok: false, message: mapMembershipUpdateError(updateErr.message) }
    }
    if (!updatedRow) {
      return { ok: false, message: 'Could not reactivate member.' }
    }

    await logAuditEvent({
      organizationId,
      actorUserId: actor.user.id,
      action: 'organization_member.reactivated',
      target: `organization_members:${memberId}`,
      metadata: {
        target_user_id: target.user_id,
        previous_roles: targetRoles,
        new_roles: targetRoles,
        previous_status: targetStatus,
        new_status: 'active'
      },
    })

    revalidateAdminUsers()
    return { ok: true, message: 'Member reactivated.' }
  } catch (err) {
    console.error('reactivateOrganizationMember', err)
    return {
      ok: false,
      message:
        err instanceof Error ? err.message : 'An unexpected error occurred while reactivating.',
    }
  }
}

export async function addOrganizationMemberByEmail(
  _prev: AdminUserActionState,
  formData: FormData,
): Promise<AdminUserActionState> {
  try {
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

    const loaded = await loadMemberRows(organizationId)
    if (!loaded.ok) return { ok: false, message: loaded.message }

    const validation = validateRoleChange({
      actorUserId: actor.user.id,
      actorIsOwner: actor.actorIsOwner,
      actorIsAdmin: actor.actorIsAdmin,
      actorCanManageUnblinded: actor.actorCanManageUnblinded,
      targetUserId: authUser.id,
      targetCurrentRoles: [],
      requestedRoles: [initialRole],
      allMembers: loaded.members.map((m) => ({ userId: m.userId, roles: m.roles })),
    })

    if (!validation.ok) return { ok: false, message: validation.message }

    const { roles, primaryRole } = validation
    const supabase = await createServerClient()

    const { data: existing } = await supabase
      .from('organization_members')
      .select('id, status')
      .eq('organization_id', organizationId)
      .eq('user_id', authUser.id)
      .maybeSingle()

    if (existing?.id) {
      const status = normalizeMembershipStatus(existing.status as string | null)
      if (status === 'deactivated') {
        return {
          ok: false,
          message:
            'This user is deactivated. Reactivate the existing membership instead of adding again.',
        }
      }
      return { ok: false, message: 'This user is already a member of the organization.' }
    }

    const { data: inserted, error: insertErr } = await supabase
      .from('organization_members')
      .insert({
        organization_id: organizationId,
        user_id: authUser.id,
        role: primaryRole,
        roles,
        status: 'active',
      })
      .select('id')
      .maybeSingle()

    if (insertErr) {
      if (/status/i.test(insertErr.message)) {
        const { data: legacyInsert, error: legacyErr } = await supabase
          .from('organization_members')
          .insert({
            organization_id: organizationId,
            user_id: authUser.id,
            role: primaryRole,
            roles,
          })
          .select('id')
          .maybeSingle()
        if (legacyErr) {
          return { ok: false, message: mapMembershipUpdateError(legacyErr.message) }
        }
        if (!legacyInsert) {
          return { ok: false, message: 'Could not add member.' }
        }
      } else {
        return { ok: false, message: mapMembershipUpdateError(insertErr.message) }
      }
    } else if (!inserted) {
      return {
        ok: false,
        message: 'Could not add member. You may lack permission for this organization.',
      }
    }

    await logAuditEvent({
      organizationId,
      actorUserId: actor.user.id,
      action: 'organization_member.added',
      target: `auth.users:${authUser.id}`,
      metadata: { email: authUser.email, previous_roles: [], new_roles: roles, primary_role: primaryRole },
    })

    revalidateAdminUsers()
    return { ok: true, message: `Added ${authUser.email ?? email} to the organization.` }
  } catch (err) {
    console.error('addOrganizationMemberByEmail', err)
    return {
      ok: false,
      message:
        err instanceof Error ? err.message : 'An unexpected error occurred while adding the member.',
    }
  }
}
