'use server'

import { revalidatePath } from 'next/cache'
import { getPrimaryOrganizationId, getSessionUser } from '@/lib/auth/session'
import { createServerClient } from '@/lib/supabase/server'
import {
  createOperationalSignatureRequest,
} from '@/lib/operational-signatures'
import { TRAINING_TOPICS, TRAINING_TYPES } from '@/lib/studies/isf-log-templates'

type StaffOption = {
  userId: string
  displayName: string
  role: string
  initials: string
}

export type TrainingAssignmentRow = {
  id: string
  trainingItemId: string
  traineeUserId: string
  traineeName: string
  traineeRole: string
  traineeInitials: string
  trainingType: string
  trainingTopic: string
  trainingMaterialTitle: string
  dueDate: string | null
  status: string
  requiresTrainerSignature: boolean
  requiresPiAcknowledgment: boolean
  traineeSignatureRequestId: string | null
  trainerSignatureRequestId: string | null
  piSignatureRequestId: string | null
  traineeSignatureStatus: string | null
  trainerSignatureStatus: string | null
  piSignatureStatus: string | null
  lockedAt: string | null
}

export type TrainingLogWorkspace = {
  study: {
    id: string
    name: string
    organizationId: string
  }
  staff: StaffOption[]
  piCandidates: StaffOption[]
  topics: readonly string[]
  types: readonly string[]
  assignments: TrainingAssignmentRow[]
}

export type CreateTrainingAssignmentInput = {
  traineeUserId: string
  traineeName: string
  traineeRole: string
  traineeInitials: string
  trainingType: string
  trainingTopic: string
  trainingMaterialTitle: string
  dueDate?: string | null
  trainerUserId?: string | null
  trainerName?: string | null
  trainerInitials?: string | null
  requiresTrainerSignature: boolean
  requiresPiAcknowledgment: boolean
  certificateExpected: boolean
  notes?: string | null
}

function initialsFromName(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 3)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')
}

async function loadProfiles(userIds: string[]) {
  if (userIds.length === 0) return new Map<string, { display_name: string | null }>()
  const supabase = await createServerClient()
  const { data } = await supabase.from('profiles').select('id, display_name').in('id', userIds)
  return new Map(
    ((data as { id: string; display_name: string | null }[] | null) ?? []).map((profile) => [
      profile.id,
      profile,
    ]),
  )
}

export async function listTrainingLogWorkspace(studyId: string): Promise<TrainingLogWorkspace> {
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
  const { data: studyMembers } = await supabase
    .from('study_members')
    .select('user_id, clinical_role, role')
    .eq('study_id', studyId)

  let staffRows = ((studyMembers as Record<string, unknown>[] | null) ?? []).map((row) => ({
    userId: String(row.user_id),
    role: row.clinical_role ? String(row.clinical_role) : String(row.role ?? 'site_staff'),
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

  const profileMap = await loadProfiles([...new Set(staffRows.map((row) => row.userId))])
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

  const { data: assignments, error: assignmentError } = await supabase
    .from('study_training_assignments')
    .select(
      '*, study_training_items(training_type, training_topic, training_material_title, requires_trainer_signature, requires_pi_acknowledgment), trainee_signature:trainee_signature_request_id(status), trainer_signature:trainer_signature_request_id(status), pi_signature:pi_signature_request_id(status)',
    )
    .eq('study_id', studyId)
    .order('created_at', { ascending: false })
    .limit(100)

  if (assignmentError && !/study_training_assignments/i.test(assignmentError.message)) {
    throw new Error(assignmentError.message)
  }

  return {
    study: {
      id: String(study.id),
      name: String(study.name),
      organizationId,
    },
    staff,
    piCandidates,
    topics: TRAINING_TOPICS,
    types: TRAINING_TYPES,
    assignments: ((assignments as Record<string, unknown>[] | null) ?? []).map(mapAssignmentRow),
  }
}

export async function createTrainingAssignment(studyId: string, input: CreateTrainingAssignmentInput) {
  const sessionUser = await getSessionUser()
  if (!sessionUser) throw new Error('Unauthorized')
  if (!input.traineeUserId) throw new Error('Trainee is required.')
  if (!input.trainingTopic.trim()) throw new Error('Training topic is required.')
  if (!input.trainingType.trim()) throw new Error('Training type is required.')

  const orgId = await getPrimaryOrganizationId(sessionUser.id)
  if (!orgId) throw new Error('No organization')

  const supabase = await createServerClient()
  const { data: item, error: itemError } = await supabase
    .from('study_training_items')
    .insert({
      organization_id: orgId,
      study_id: studyId,
      training_type: input.trainingType,
      training_topic: input.trainingTopic,
      training_material_title: input.trainingMaterialTitle.trim() || input.trainingTopic,
      trainer_user_id: input.trainerUserId || null,
      trainer_name: input.trainerName || null,
      trainer_initials: input.trainerInitials || null,
      requires_trainer_signature: input.requiresTrainerSignature,
      requires_pi_acknowledgment: input.requiresPiAcknowledgment,
      certificate_expected: input.certificateExpected,
      created_by: sessionUser.id,
    })
    .select('id')
    .single()
  if (itemError || !item) throw new Error(itemError?.message ?? 'Training item was not created')

  const { data: assignment, error: assignmentError } = await supabase
    .from('study_training_assignments')
    .insert({
      organization_id: orgId,
      study_id: studyId,
      training_item_id: item.id,
      trainee_user_id: input.traineeUserId,
      trainee_name: input.traineeName.trim(),
      trainee_role: input.traineeRole,
      trainee_initials: input.traineeInitials.trim().toUpperCase(),
      assigned_by: sessionUser.id,
      due_date: input.dueDate || null,
      training_status: 'Assigned',
      certificate_attached: false,
      notes: input.notes || null,
    })
    .select('id')
    .single()
  if (assignmentError || !assignment) {
    throw new Error(assignmentError?.message ?? 'Training assignment was not created')
  }

  await appendTrainingAudit({
    organizationId: orgId,
    studyId,
    assignmentId: String(assignment.id),
    eventType: 'training_assignment_created',
    actorUserId: sessionUser.id,
    payload: {
      trainee_user_id: input.traineeUserId,
      training_topic: input.trainingTopic,
      training_type: input.trainingType,
      requires_trainer_signature: input.requiresTrainerSignature,
      requires_pi_acknowledgment: input.requiresPiAcknowledgment,
    },
  })

  revalidatePath(`/studies/${studyId}/workspace`)
  return { ok: true, assignmentId: String(assignment.id) }
}

export async function requestTraineeTrainingSignature(assignmentId: string) {
  return requestTrainingSignature(assignmentId, 'trainee')
}

export async function requestTrainerTrainingSignature(assignmentId: string) {
  return requestTrainingSignature(assignmentId, 'trainer')
}

export async function requestPiTrainingAcknowledgment(assignmentId: string) {
  return requestTrainingSignature(assignmentId, 'pi')
}

export async function completeTraineeTrainingSignature(assignmentId: string) {
  return completeTrainingSignature(assignmentId, 'trainee')
}

export async function completeTrainerTrainingSignature(assignmentId: string) {
  return completeTrainingSignature(assignmentId, 'trainer')
}

export async function completePiTrainingAcknowledgment(assignmentId: string) {
  return completeTrainingSignature(assignmentId, 'pi')
}

async function requestTrainingSignature(
  assignmentId: string,
  role: 'trainee' | 'trainer' | 'pi',
) {
  const sessionUser = await getSessionUser()
  if (!sessionUser) throw new Error('Unauthorized')

  const supabase = await createServerClient()
  const assignment = await loadAssignmentForAction(assignmentId)
  const existingRequestId = signatureRequestIdForRole(assignment, role)
  if (existingRequestId) return { ok: true, requestId: existingRequestId }

  const signatureConfig = signatureConfigForRole(assignment, role)
  const request = await createOperationalSignatureRequest(supabase, {
    organizationId: assignment.organizationId,
    studyId: assignment.studyId,
    artifactType: 'study_training_assignment',
    artifactId: assignment.id,
    requiredRole: signatureConfig.requiredRole,
    signatureMeaning: signatureConfig.meaning,
    requestedBy: sessionUser.id,
    metadata: {
      workflow: 'study_training_log',
      role,
      recipient_user_id: signatureConfig.recipientUserId,
      training_topic: assignment.trainingTopic,
      training_type: assignment.trainingType,
    },
  })

  const patch: Record<string, unknown> = {
    training_status: statusAfterRequest(role),
  }
  if (role === 'trainee') patch.trainee_signature_request_id = request.id
  if (role === 'trainer') patch.trainer_signature_request_id = request.id
  if (role === 'pi') patch.pi_signature_request_id = request.id

  const { error } = await supabase
    .from('study_training_assignments')
    .update(patch)
    .eq('id', assignmentId)
  if (error) throw new Error(error.message)

  await appendTrainingAudit({
    organizationId: assignment.organizationId,
    studyId: assignment.studyId,
    assignmentId,
    eventType: `${role}_signature_requested`,
    actorUserId: sessionUser.id,
    payload: { request_id: request.id },
  })

  revalidatePath(`/studies/${assignment.studyId}/workspace`)
  return { ok: true, requestId: request.id }
}

async function completeTrainingSignature(
  assignmentId: string,
  role: 'trainee' | 'trainer' | 'pi',
) {
  const sessionUser = await getSessionUser()
  if (!sessionUser) throw new Error('Unauthorized')

  const supabase = await createServerClient()
  const assignment = await loadAssignmentForAction(assignmentId)
  const requestId = signatureRequestIdForRole(assignment, role)
  if (!requestId) throw new Error(`${role} signature request has not been created.`)

  const { data: request, error: requestError } = await supabase
    .from('operational_signature_requests')
    .select('id, status')
    .eq('id', requestId)
    .single()
  if (requestError || !request) throw new Error(requestError?.message ?? 'Signature request not found')
  if (request.status !== 'signed') {
    throw new Error(`${role} signature request is not signed yet.`)
  }

  const completion = await resolveCompletionState(assignmentId)
  const patch: Record<string, unknown> = {
    training_status: completion.nextStatus,
  }
  if (completion.completed) {
    patch.completed_at = new Date().toISOString()
    patch.locked_at = new Date().toISOString()
    patch.locked_by = sessionUser.id
    patch.amendment_required_reason =
      'Training assignment completed and locked after required electronic signatures.'
  }

  const { error } = await supabase
    .from('study_training_assignments')
    .update(patch)
    .eq('id', assignmentId)
  if (error) throw new Error(error.message)

  await appendTrainingAudit({
    organizationId: assignment.organizationId,
    studyId: assignment.studyId,
    assignmentId,
    eventType: completion.completed ? 'training_assignment_locked' : `${role}_signature_completed`,
    actorUserId: sessionUser.id,
    payload: {
      request_id: requestId,
      next_status: completion.nextStatus,
      completed: completion.completed,
    },
  })

  revalidatePath(`/studies/${assignment.studyId}/workspace`)
  return { ok: true, status: completion.nextStatus }
}

async function resolveCompletionState(assignmentId: string) {
  const assignment = await loadAssignmentForAction(assignmentId)
  const traineeSigned = await isRequestSigned(assignment.traineeSignatureRequestId)
  const trainerSigned =
    !assignment.requiresTrainerSignature || await isRequestSigned(assignment.trainerSignatureRequestId)
  const piSigned =
    !assignment.requiresPiAcknowledgment || await isRequestSigned(assignment.piSignatureRequestId)

  if (traineeSigned && trainerSigned && piSigned) {
    return { completed: true, nextStatus: 'Completed' }
  }
  if (traineeSigned && assignment.requiresTrainerSignature && !trainerSigned) {
    return { completed: false, nextStatus: 'Pending Trainer Signature' }
  }
  if (traineeSigned && assignment.requiresPiAcknowledgment && !piSigned) {
    return { completed: false, nextStatus: 'Pending PI Acknowledgment' }
  }
  return { completed: false, nextStatus: 'Pending Trainee Signature' }
}

async function isRequestSigned(requestId: string | null) {
  if (!requestId) return false
  const supabase = await createServerClient()
  const { data } = await supabase
    .from('operational_signature_requests')
    .select('status')
    .eq('id', requestId)
    .maybeSingle()
  return data?.status === 'signed'
}

async function loadAssignmentForAction(assignmentId: string) {
  const supabase = await createServerClient()
  const { data, error } = await supabase
    .from('study_training_assignments')
    .select(
      '*, study_training_items(training_type, training_topic, training_material_title, trainer_user_id, requires_trainer_signature, requires_pi_acknowledgment)',
    )
    .eq('id', assignmentId)
    .single()
  if (error || !data) throw new Error(error?.message ?? 'Training assignment not found')
  return mapAssignmentForAction(data as Record<string, unknown>)
}

function signatureRequestIdForRole(
  assignment: ReturnType<typeof mapAssignmentForAction>,
  role: 'trainee' | 'trainer' | 'pi',
) {
  if (role === 'trainee') return assignment.traineeSignatureRequestId
  if (role === 'trainer') return assignment.trainerSignatureRequestId
  return assignment.piSignatureRequestId
}

function signatureConfigForRole(
  assignment: ReturnType<typeof mapAssignmentForAction>,
  role: 'trainee' | 'trainer' | 'pi',
) {
  if (role === 'trainee') {
    return {
      requiredRole: assignment.traineeRole,
      meaning: 'acknowledged_by' as const,
      recipientUserId: assignment.traineeUserId,
    }
  }
  if (role === 'trainer') {
    if (!assignment.trainerUserId) throw new Error('Trainer user is required for trainer signature.')
    return {
      requiredRole: 'research_coordinator',
      meaning: 'completed_by' as const,
      recipientUserId: assignment.trainerUserId,
    }
  }
  return {
    requiredRole: 'pi_sub_i',
    meaning: 'approved_by' as const,
    recipientUserId: assignment.trainerUserId ?? assignment.traineeUserId,
  }
}

function statusAfterRequest(role: 'trainee' | 'trainer' | 'pi') {
  if (role === 'trainee') return 'Pending Trainee Signature'
  if (role === 'trainer') return 'Pending Trainer Signature'
  return 'Pending PI Acknowledgment'
}

async function appendTrainingAudit(input: {
  organizationId: string
  studyId: string
  assignmentId: string
  eventType: string
  actorUserId: string
  payload: Record<string, unknown>
}) {
  const supabase = await createServerClient()
  await supabase.from('study_training_assignment_audit').insert({
    organization_id: input.organizationId,
    study_id: input.studyId,
    training_assignment_id: input.assignmentId,
    event_type: input.eventType,
    event_payload: input.payload,
    actor_user_id: input.actorUserId,
  })
}

function mapAssignmentForAction(row: Record<string, unknown>) {
  const item = Array.isArray(row.study_training_items)
    ? row.study_training_items[0]
    : row.study_training_items
  const itemRow = (item ?? {}) as Record<string, unknown>
  return {
    id: String(row.id),
    organizationId: String(row.organization_id),
    studyId: String(row.study_id),
    traineeUserId: String(row.trainee_user_id),
    traineeRole: String(row.trainee_role),
    trainerUserId: itemRow.trainer_user_id ? String(itemRow.trainer_user_id) : null,
    trainingType: String(itemRow.training_type ?? ''),
    trainingTopic: String(itemRow.training_topic ?? ''),
    requiresTrainerSignature: Boolean(itemRow.requires_trainer_signature),
    requiresPiAcknowledgment: Boolean(itemRow.requires_pi_acknowledgment),
    traineeSignatureRequestId: row.trainee_signature_request_id
      ? String(row.trainee_signature_request_id)
      : null,
    trainerSignatureRequestId: row.trainer_signature_request_id
      ? String(row.trainer_signature_request_id)
      : null,
    piSignatureRequestId: row.pi_signature_request_id ? String(row.pi_signature_request_id) : null,
  }
}

function mapAssignmentRow(row: Record<string, unknown>): TrainingAssignmentRow {
  const item = Array.isArray(row.study_training_items)
    ? row.study_training_items[0]
    : row.study_training_items
  const itemRow = (item ?? {}) as Record<string, unknown>
  const traineeSignature = Array.isArray(row.trainee_signature)
    ? row.trainee_signature[0]
    : row.trainee_signature
  const trainerSignature = Array.isArray(row.trainer_signature)
    ? row.trainer_signature[0]
    : row.trainer_signature
  const piSignature = Array.isArray(row.pi_signature) ? row.pi_signature[0] : row.pi_signature

  return {
    id: String(row.id),
    trainingItemId: String(row.training_item_id),
    traineeUserId: String(row.trainee_user_id),
    traineeName: String(row.trainee_name),
    traineeRole: String(row.trainee_role),
    traineeInitials: String(row.trainee_initials),
    trainingType: String(itemRow.training_type ?? ''),
    trainingTopic: String(itemRow.training_topic ?? ''),
    trainingMaterialTitle: String(itemRow.training_material_title ?? ''),
    dueDate: row.due_date ? String(row.due_date) : null,
    status: String(row.training_status),
    requiresTrainerSignature: Boolean(itemRow.requires_trainer_signature),
    requiresPiAcknowledgment: Boolean(itemRow.requires_pi_acknowledgment),
    traineeSignatureRequestId: row.trainee_signature_request_id
      ? String(row.trainee_signature_request_id)
      : null,
    trainerSignatureRequestId: row.trainer_signature_request_id
      ? String(row.trainer_signature_request_id)
      : null,
    piSignatureRequestId: row.pi_signature_request_id ? String(row.pi_signature_request_id) : null,
    traineeSignatureStatus:
      traineeSignature && typeof traineeSignature === 'object'
        ? String((traineeSignature as Record<string, unknown>).status)
        : null,
    trainerSignatureStatus:
      trainerSignature && typeof trainerSignature === 'object'
        ? String((trainerSignature as Record<string, unknown>).status)
        : null,
    piSignatureStatus:
      piSignature && typeof piSignature === 'object'
        ? String((piSignature as Record<string, unknown>).status)
        : null,
    lockedAt: row.locked_at ? String(row.locked_at) : null,
  }
}
