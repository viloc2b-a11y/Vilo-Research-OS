import { PILOT_FIXTURE_DEFAULTS } from '@/lib/runtime-validation/pilot-fixture-defaults'
import {
  normalizeMembershipStatus,
} from '@/lib/auth/membership-status'
import {
  canAccessSourceCapture,
  canEditClinicalSource,
  canManageSourceDocuments,
  canViewUnblindedData,
} from '@/lib/rbac/permissions'
import { resolveEffectiveRoles } from '@/lib/rbac/effective-roles'
import type { OrganizationMembership } from '@/lib/auth/session'
import type { SupabaseClient } from '@supabase/supabase-js'

export type PilotCoordinatorCaptureAccessStatus = {
  ok: boolean
  userId: string | null
  email: string | null
  organizationRoles: string[]
  studyMemberRole: string | null
  canAccessCapture: boolean
  canEditClinicalSource: boolean
  canManageSourceDocuments: boolean
  canViewUnblinded: boolean
  message: string
}

/**
 * Verify pilot coordinator has org capture RBAC + study_members enrollment scope.
 */
export async function verifyPilotCoordinatorCaptureAccess(input: {
  supabase: SupabaseClient
  organizationId: string
  studyId: string
  coordinatorUserId?: string
  coordinatorEmail?: string
}): Promise<PilotCoordinatorCaptureAccessStatus> {
  const coordinatorUserId =
    input.coordinatorUserId ?? PILOT_FIXTURE_DEFAULTS.coordinatorActorUserId
  const coordinatorEmail =
    input.coordinatorEmail?.trim() ??
    process.env.CALENDAR_QA_COORDINATOR_EMAIL?.trim() ??
    'calendar.qa.coordinator@vilo-os.staging'

  const { data: membership, error: memErr } = await input.supabase
    .from('organization_members')
    .select('user_id, role, roles, status')
    .eq('organization_id', input.organizationId)
    .eq('user_id', coordinatorUserId)
    .maybeSingle()

  if (memErr) {
    return {
      ok: false,
      userId: coordinatorUserId,
      email: coordinatorEmail,
      organizationRoles: [],
      studyMemberRole: null,
      canAccessCapture: false,
      canEditClinicalSource: false,
      canManageSourceDocuments: false,
      canViewUnblinded: false,
      message: memErr.message,
    }
  }

  const orgMembership: OrganizationMembership = {
    organization_id: input.organizationId,
    role: (membership?.role as string) ?? 'member',
    roles: (membership?.roles as string[]) ?? [],
    status: normalizeMembershipStatus(membership?.status as string | null | undefined),
    organizations: null,
  }

  const organizationRoles = resolveEffectiveRoles(orgMembership)

  const { data: studyMember, error: smErr } = await input.supabase
    .from('study_members')
    .select('role')
    .eq('study_id', input.studyId)
    .eq('user_id', coordinatorUserId)
    .maybeSingle()

  if (smErr) {
    return {
      ok: false,
      userId: coordinatorUserId,
      email: coordinatorEmail,
      organizationRoles,
      studyMemberRole: null,
      canAccessCapture: false,
      canEditClinicalSource: false,
      canManageSourceDocuments: false,
      canViewUnblinded: false,
      message: smErr.message,
    }
  }

  const canEdit = canEditClinicalSource([orgMembership], input.organizationId)
  const canManage = canManageSourceDocuments([orgMembership], input.organizationId)
  const canAccess = canAccessSourceCapture([orgMembership], input.organizationId)
  const canUnblinded = canViewUnblindedData([orgMembership], input.organizationId)
  const studyMemberRole = (studyMember?.role as string) ?? null
  const hasStudyScope =
    studyMemberRole === 'coordinator'
    || studyMemberRole === 'lab'
    || studyMemberRole === 'study_admin'

  const ok = canEdit && canAccess && hasStudyScope

  let message = 'Pilot coordinator can open/save/submit source via user-scoped API and RPC.'
  if (!canEdit) {
    message =
      'Missing org role for clinical source edit (research_coordinator, data_coordinator, or pi_sub_i).'
  } else if (!hasStudyScope) {
    message =
      'Missing study_members row (role coordinator/lab/study_admin) — RLS hides response sets and RPC enrollment fails.'
  }

  return {
    ok,
    userId: coordinatorUserId,
    email: coordinatorEmail,
    organizationRoles,
    studyMemberRole,
    canAccessCapture: canAccess,
    canEditClinicalSource: canEdit,
    canManageSourceDocuments: canManage,
    canViewUnblinded: canUnblinded,
    message,
  }
}
