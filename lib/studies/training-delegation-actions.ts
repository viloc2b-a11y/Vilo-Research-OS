'use server'

import { revalidatePath } from 'next/cache'
import type { SupabaseClient } from '@supabase/supabase-js'
import { getPrimaryOrganizationId, getSessionUser } from '@/lib/auth/session'
import { createServerClient } from '@/lib/supabase/server'
import {
  createOperationalSignatureRequest,
  type OperationalSignatureRequestRow,
} from '@/lib/operational-signatures'
import { DELEGATION_TASKS } from '@/lib/studies/isf-log-templates'

type ProfileRow = {
  id: string
  display_name: string | null
}

type StaffOption = {
  userId: string
  displayName: string
  role: string
  initials: string
}

export type DelegationDutyOption = {
  code: string
  label: string
  category: string | null
  requiresTraining: boolean
  unblindedRequired: boolean
}

export type DelegationLogRow = {
  id: string
  staffUserId: string
  delegateeName: string
  staffRole: string
  staffInitials: string
  piDelegatorId: string
  piInitials: string
  delegationDate: string | null
  dateStarted: string
  dateEnded: string | null
  status: string
  staffSignatureRequestId: string | null
  piSignatureRequestId: string | null
  staffSignatureStatus: string | null
  piSignatureStatus: string | null
  tasks: string[]
}

export type DelegationWorkspace = {
  study: {
    id: string
    name: string
    organizationId: string
  }
  staff: StaffOption[]
  piCandidates: StaffOption[]
  duties: DelegationDutyOption[]
  logs: DelegationLogRow[]
}

export type CreateDelegationAssignmentInput = {
  staffUserId: string
  staffRole: string
  delegateeName: string
  staffInitials: string
  piDelegatorId: string
  piInitials: string
  taskLabels: string[]
  dateDelegated: string
  dateStarted: string
  dateEnded?: string | null
}

function initialsFromName(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 3)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')
}

function dutyCode(label: string) {
  return label
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 80)
}

async function loadProfiles(supabase: SupabaseClient, userIds: string[]) {
  if (userIds.length === 0) return new Map<string, ProfileRow>()
  const { data } = await supabase.from('profiles').select('id, display_name').in('id', userIds)
  return new Map((data as ProfileRow[] | null ?? []).map((profile) => [profile.id, profile]))
}

function defaultDelegationDuties(): DelegationDutyOption[] {
  return DELEGATION_TASKS.map((label) => ({
    code: dutyCode(label),
    label,
    category: label.includes('IP') || label.includes('Product')
      ? 'Investigational Product'
      : label.includes('SAE') || label.includes('Adverse')
        ? 'Safety'
        : 'Clinical Operations',
    requiresTraining: true,
    unblindedRequired: label === 'Unblinding Procedures',
  }))
}

export async function listDelegationWorkspace(studyId: string): Promise<DelegationWorkspace> {
  const sessionUser = await getSessionUser()
  if (!sessionUser) throw new Error('Unauthorized')

  const supabase = await createServerClient()
  const { data: study, error: studyError } = await supabase
    .from('studies')
    .select('id, name, organization_id')
    .eq('id', studyId)
    .single()

  if (studyError || !study) throw new Error(studyError?.message ?? 'Study not found')

  const organizationId = String(study.organization_id)
  const duties = defaultDelegationDuties()

  const { data: studyMembers } = await supabase
    .from('study_members')
    .select('user_id, clinical_role')
    .eq('study_id', studyId)
    .eq('is_active', true)

  let staffRows = ((studyMembers as Record<string, unknown>[] | null) ?? []).map((row) => ({
    userId: String(row.user_id),
    role: row.clinical_role ? String(row.clinical_role) : 'site_staff',
  }))

  if (staffRows.length === 0) {
    const { data: orgMembers } = await supabase
      .from('organization_members')
      .select('user_id, role, roles')
      .eq('organization_id', organizationId)

    staffRows = ((orgMembers as Record<string, unknown>[] | null) ?? []).map((row) => {
      const roles = Array.isArray(row.roles) ? (row.roles as string[]) : []
      return {
        userId: String(row.user_id),
        role: roles[0] ?? String(row.role ?? 'site_staff'),
      }
    })
  }

  const profileMap = await loadProfiles(
    supabase,
    [...new Set(staffRows.map((row) => row.userId))],
  )

  const staff = staffRows.map((row) => {
    const displayName = profileMap.get(row.userId)?.display_name ?? row.userId.slice(0, 8)
    return {
      userId: row.userId,
      displayName,
      role: row.role,
      initials: initialsFromName(displayName),
    }
  })

  const piCandidates = staff.filter((member) =>
    ['pi_sub_i', 'owner', 'admin'].includes(member.role),
  )

  const { data: logs, error: logsError } = await supabase
    .from('study_delegation_log')
    .select(
      '*, staff_signature:staff_signature_request_id(status), pi_signature:pi_signature_request_id(status)',
    )
    .eq('study_id', studyId)
    .order('created_at', { ascending: false })
    .limit(50)

  if (logsError) throw new Error(logsError.message)

  return {
    study: {
      id: String(study.id),
      name: String(study.name),
      organizationId,
    },
    staff,
    piCandidates,
    duties,
    logs: ((logs as Record<string, unknown>[] | null) ?? []).map(mapDelegationLogRow),
  }
}

export async function createDelegationAssignment(
  studyId: string,
  input: CreateDelegationAssignmentInput,
) {
  const sessionUser = await getSessionUser()
  if (!sessionUser) throw new Error('Unauthorized')
  if (input.taskLabels.length === 0) throw new Error('Select at least one delegated task.')

  const orgId = await getPrimaryOrganizationId(sessionUser.id)
  if (!orgId) throw new Error('No organization')

  const supabase = await createServerClient()
  const allowedTaskLabels = new Set(DELEGATION_TASKS)
  const selectedTasks = input.taskLabels.filter((label): label is (typeof DELEGATION_TASKS)[number] =>
    allowedTaskLabels.has(label as (typeof DELEGATION_TASKS)[number]),
  )
  if (selectedTasks.length === 0) throw new Error('Selected tasks are not available.')

  const { data: delegation, error: delError } = await supabase
    .from('study_delegation_log')
    .insert({
      organization_id: orgId,
      study_id: studyId,
      staff_user_id: input.staffUserId,
      delegatee_name: input.delegateeName.trim(),
      staff_role: input.staffRole,
      staff_initials: input.staffInitials.trim().toUpperCase(),
      initials_verification: true,
      pi_delegator_id: input.piDelegatorId,
      pi_initials: input.piInitials.trim().toUpperCase(),
      task_labels: selectedTasks,
      delegation_date: input.dateDelegated,
      delegation_start_date: input.dateStarted,
      delegation_stop_date: input.dateEnded || null,
      is_ongoing: !input.dateEnded,
      delegation_status: 'Pending Staff Signature',
    })
    .select('*')
    .single()

  if (delError || !delegation) {
    throw new Error(`Delegation failed: ${delError?.message ?? 'No delegation row returned'}`)
  }

  const delegationId = String(delegation.id)

  const delegateeRequest = await createSignatureRequestForDelegation(supabase, {
    delegationId,
    organizationId: orgId,
    studyId,
    requiredRole: input.staffRole,
    meaning: 'acknowledged_by',
    requestedBy: sessionUser.id,
    recipientUserId: input.staffUserId,
    tasks: selectedTasks,
    label: 'Delegatee acceptance',
  })
  const piRequest = await createSignatureRequestForDelegation(supabase, {
    delegationId,
    organizationId: orgId,
    studyId,
    requiredRole: 'pi_sub_i',
    meaning: 'approved_by',
    requestedBy: sessionUser.id,
    recipientUserId: input.piDelegatorId,
    tasks: selectedTasks,
    label: 'PI delegation approval',
  })

  const { error: updateError } = await supabase
    .from('study_delegation_log')
    .update({
      staff_signature_request_id: delegateeRequest.id,
      pi_signature_request_id: piRequest.id,
      last_updated: new Date().toISOString().slice(0, 10),
    })
    .eq('id', delegationId)

  if (updateError) throw new Error(updateError.message)

  await supabase.from('study_delegation_log_audit').insert({
    organization_id: orgId,
    study_id: studyId,
    delegation_log_id: delegationId,
    event_type: 'delegation_created',
    event_payload: {
      delegatee_name: input.delegateeName,
      task_count: selectedTasks.length,
      staff_signature_request_id: delegateeRequest.id,
      pi_signature_request_id: piRequest.id,
    },
    actor_user_id: sessionUser.id,
  })

  revalidatePath(`/studies/${studyId}/workspace`)
  revalidatePath(`/studies/${studyId}/setup`)
  return {
    ok: true,
    delegationId,
    staffSignatureRequestId: delegateeRequest.id,
    piSignatureRequestId: piRequest.id,
  }
}

export async function finalizeDelegationIfFullySigned(delegationLogId: string) {
  const sessionUser = await getSessionUser()
  if (!sessionUser) throw new Error('Unauthorized')

  const supabase = await createServerClient()
  const { data: log, error } = await supabase
    .from('study_delegation_log')
    .select(
      'id, organization_id, study_id, delegation_status, staff_signature_request_id, pi_signature_request_id, staff_signature:staff_signature_request_id(status), pi_signature:pi_signature_request_id(status)',
    )
    .eq('id', delegationLogId)
    .single()

  if (error || !log) throw new Error(error?.message ?? 'Delegation not found')
  if (log.delegation_status === 'Active' || log.delegation_status === 'Locked') {
    return { ok: true, status: log.delegation_status }
  }

  const staffSignature = Array.isArray(log.staff_signature)
    ? log.staff_signature[0]
    : log.staff_signature
  const piSignature = Array.isArray(log.pi_signature) ? log.pi_signature[0] : log.pi_signature
  const staffSigned =
    staffSignature && typeof staffSignature === 'object'
      ? (staffSignature as Record<string, unknown>).status === 'signed'
      : false
  const piSigned =
    piSignature && typeof piSignature === 'object'
      ? (piSignature as Record<string, unknown>).status === 'signed'
      : false

  if (!staffSigned || !piSigned) {
    const nextStatus = staffSigned ? 'Ready for PI Signature' : 'Pending Staff Signature'
    await supabase
      .from('study_delegation_log')
      .update({ delegation_status: nextStatus })
      .eq('id', delegationLogId)
    return { ok: true, status: nextStatus }
  }

  const now = new Date().toISOString()
  const { error: updateError } = await supabase
    .from('study_delegation_log')
    .update({
      delegation_status: 'Active',
      locked_at: now,
      locked_by: sessionUser.id,
      amendment_required_reason:
        'Delegation is active after delegatee and PI electronic signatures.',
    })
    .eq('id', delegationLogId)

  if (updateError) throw new Error(updateError.message)

  await supabase.from('study_delegation_log_audit').insert({
    organization_id: log.organization_id,
    study_id: log.study_id,
    delegation_log_id: delegationLogId,
    event_type: 'delegation_locked',
    event_payload: {
      status: 'Active',
      staff_signature_request_id: log.staff_signature_request_id,
      pi_signature_request_id: log.pi_signature_request_id,
    },
    actor_user_id: sessionUser.id,
  })

  revalidatePath(`/studies/${log.study_id}/workspace`)
  return { ok: true, status: 'Active' }
}

async function createSignatureRequestForDelegation(
  supabase: SupabaseClient,
  input: {
    delegationId: string
    organizationId: string
    studyId: string
    requiredRole: string
    meaning: 'acknowledged_by' | 'approved_by'
    requestedBy: string
    recipientUserId: string
    tasks: string[]
    label: string
  },
): Promise<OperationalSignatureRequestRow> {
  return createOperationalSignatureRequest(supabase, {
    organizationId: input.organizationId,
    studyId: input.studyId,
    artifactType: 'study_delegation_log',
    artifactId: input.delegationId,
    requiredRole: input.requiredRole,
    signatureMeaning: input.meaning,
    requestedBy: input.requestedBy,
    metadata: {
      workflow: 'study_delegation_log',
      label: input.label,
      recipient_user_id: input.recipientUserId,
      delegated_tasks: input.tasks,
    },
  })
}

function mapDelegationLogRow(row: Record<string, unknown>): DelegationLogRow {
  const staffSignature = Array.isArray(row.staff_signature)
    ? row.staff_signature[0]
    : row.staff_signature
  const piSignature = Array.isArray(row.pi_signature) ? row.pi_signature[0] : row.pi_signature

  return {
    id: String(row.id),
    staffUserId: String(row.staff_user_id),
    delegateeName: row.delegatee_name ? String(row.delegatee_name) : String(row.staff_user_id),
    staffRole: String(row.staff_role),
    staffInitials: row.staff_initials ? String(row.staff_initials) : '',
    piDelegatorId: String(row.pi_delegator_id),
    piInitials: row.pi_initials ? String(row.pi_initials) : '',
    delegationDate: row.delegation_date ? String(row.delegation_date) : null,
    dateStarted: String(row.delegation_start_date),
    dateEnded: row.delegation_stop_date ? String(row.delegation_stop_date) : null,
    status: String(row.delegation_status),
    staffSignatureRequestId: row.staff_signature_request_id
      ? String(row.staff_signature_request_id)
      : null,
    piSignatureRequestId: row.pi_signature_request_id ? String(row.pi_signature_request_id) : null,
    staffSignatureStatus:
      staffSignature && typeof staffSignature === 'object'
        ? String((staffSignature as Record<string, unknown>).status)
        : null,
    piSignatureStatus:
      piSignature && typeof piSignature === 'object'
        ? String((piSignature as Record<string, unknown>).status)
        : null,
    tasks: Array.isArray(row.task_labels)
      ? (row.task_labels as unknown[]).filter((task): task is string => typeof task === 'string')
      : [],
  }
}

// ----------------------------------------------------------------------------
// PROTOCOL STAFF TRAINING LOG
// ----------------------------------------------------------------------------

export async function createProtocolTraining(studyId: string, data: {
  trainingType: string
  trainingTitle: string
  trainingDescription?: string | null
  trainingMethod: string
  trainerUserId?: string | null
}) {
  const sessionUser = await getSessionUser()
  if (!sessionUser) throw new Error('Unauthorized')
  const orgId = await getPrimaryOrganizationId(sessionUser.id)

  const supabase = await createServerClient()

  const { data: training, error } = await supabase.from('study_protocol_trainings').insert({
    organization_id: orgId,
    study_id: studyId,
    training_type: data.trainingType,
    training_title: data.trainingTitle,
    training_description: data.trainingDescription,
    training_method: data.trainingMethod,
    trainer_user_id: data.trainerUserId,
    created_by: sessionUser.id,
  }).select().single()

  if (error) throw new Error(`Failed to create training: ${error.message}`)

  revalidatePath(`/studies/${studyId}/training`)
  return { ok: true, training }
}

export async function assignTrainingToStaff(
  trainingId: string,
  traineeUserId: string,
  role: string,
) {
  const sessionUser = await getSessionUser()
  if (!sessionUser) throw new Error('Unauthorized')
  const orgId = await getPrimaryOrganizationId(sessionUser.id)

  const supabase = await createServerClient()

  const { error } = await supabase.from('study_protocol_training_assignments').insert({
    organization_id: orgId,
    training_id: trainingId,
    trainee_user_id: traineeUserId,
    trainee_role: role,
    training_status: 'Assigned',
  })

  if (error) throw new Error(`Failed to assign training: ${error.message}`)

  return { ok: true }
}
