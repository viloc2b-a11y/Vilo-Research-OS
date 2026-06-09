'use server'

import { createServerClient } from '@/lib/supabase/server'
import { getSessionUser } from '@/lib/auth/session'
import { createOperationalSignatureRequest } from '@/lib/operational-signatures'
import { createTrainingAssignment } from '@/lib/studies/training-log-actions'

type GovernanceProtocolAcceptanceRequestInput = {
  studyId: string
  protocolRuntimeVersionId: string
}

type GovernanceRetrainingInput = {
  studyId: string
  protocolRuntimeVersionId: string
}

export async function requestProtocolAcceptanceAction(
  input: GovernanceProtocolAcceptanceRequestInput,
) {
  const sessionUser = await getSessionUser()
  if (!sessionUser) throw new Error('Unauthorized')
  const supabase = await createServerClient()

  const { data: versionRow, error: versionError } = await supabase
    .from('protocol_runtime_versions')
    .select('*, protocol_runtime_studies(id, organization_id, study_id, protocol_number, protocol_title)')
    .eq('id', input.protocolRuntimeVersionId)
    .maybeSingle()

  if (versionError || !versionRow) {
    throw new Error(versionError?.message ?? 'Protocol runtime version not found.')
  }

  const protocolStudy = Array.isArray(versionRow.protocol_runtime_studies)
    ? versionRow.protocol_runtime_studies[0]
    : versionRow.protocol_runtime_studies
  const organizationId = String((protocolStudy as Record<string, unknown> | null)?.organization_id ?? '')
  if (!organizationId) throw new Error('Organization could not be resolved for protocol acceptance.')
  if (String((protocolStudy as Record<string, unknown> | null)?.study_id ?? '') !== input.studyId) {
    throw new Error('Protocol runtime version is not linked to this study.')
  }

  const existingRequestId = String(
    (versionRow.pi_acceptance_signature_request_id as string | null) ?? '',
  )
  if (existingRequestId) {
    return { ok: true, requestId: existingRequestId, alreadyRequested: true }
  }

  const request = await createOperationalSignatureRequest(supabase, {
    organizationId,
    studyId: input.studyId,
    module: 'governance',
    entityType: 'protocol_version',
    entityId: input.protocolRuntimeVersionId,
    artifactType: 'protocol_version',
    artifactId: input.protocolRuntimeVersionId,
    requiredRole: 'pi_sub_i',
    signatureMeaning: 'approved_by',
    requestedBy: sessionUser.id,
    signaturePolicyCode: 'standard_signature',
    metadata: {
      workflow: 'governance_protocol_acceptance',
      protocol_runtime_version_id: input.protocolRuntimeVersionId,
      protocol_number: String((protocolStudy as Record<string, unknown> | null)?.protocol_number ?? ''),
      protocol_title: String((protocolStudy as Record<string, unknown> | null)?.protocol_title ?? ''),
    },
  })

  const { error: updateError } = await supabase
    .from('protocol_runtime_versions')
    .update({
      pi_acceptance_signature_request_id: request.id,
      pi_acceptance_status: 'pending',
    })
    .eq('id', input.protocolRuntimeVersionId)
  if (updateError) throw new Error(updateError.message)

  return { ok: true, requestId: request.id }
}

export async function generateGovernanceRetrainingAction(input: GovernanceRetrainingInput) {
  const sessionUser = await getSessionUser()
  if (!sessionUser) throw new Error('Unauthorized')

  const supabase = await createServerClient()
  const { data: versionRow, error: versionError } = await supabase
    .from('protocol_runtime_versions')
    .select(
      'id, protocol_runtime_study_id, version_label, version_date, source_document_id, protocol_runtime_studies(id, organization_id, study_id, protocol_number, protocol_title)',
    )
    .eq('id', input.protocolRuntimeVersionId)
    .maybeSingle()

  if (versionError || !versionRow) {
    throw new Error(versionError?.message ?? 'Protocol runtime version not found.')
  }

  const protocolStudy = Array.isArray(versionRow.protocol_runtime_studies)
    ? versionRow.protocol_runtime_studies[0]
    : versionRow.protocol_runtime_studies
  const organizationId = String((protocolStudy as Record<string, unknown> | null)?.organization_id ?? '')
  if (!organizationId) throw new Error('Organization could not be resolved for retraining.')

  const { data: activeDelegations, error: delegationError } = await supabase
    .from('study_delegation_log')
    .select('staff_user_id, delegatee_name, staff_role, staff_initials, delegation_status')
    .eq('study_id', input.studyId)
    .eq('delegation_status', 'Active')
  if (delegationError) throw new Error(delegationError.message)

  const trainingType = 'Refresher Training'
  const trainingTopic = `Protocol Version ${String(versionRow.version_label)}`
  const trainingTitle = `${String((protocolStudy as Record<string, unknown> | null)?.protocol_number ?? 'Protocol')} Retraining`
  const tasks = (activeDelegations ?? []) as Record<string, unknown>[]

  let created = 0
  for (const row of tasks) {
    const traineeUserId = String(row.staff_user_id)
    const traineeName = String(row.delegatee_name ?? traineeUserId)
    const traineeRole = String(row.staff_role ?? 'site_staff')
    const traineeInitials = String(row.staff_initials ?? traineeName.slice(0, 2).toUpperCase())

    const result = await createTrainingAssignment(input.studyId, {
      traineeUserId,
      traineeName,
      traineeRole,
      traineeInitials,
      trainingType,
      trainingTopic,
      trainingMaterialTitle: trainingTitle,
      trainingMaterialDocumentId: String(versionRow.source_document_id),
      dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
      trainerUserId: null,
      trainerName: null,
      trainerInitials: null,
      requiresTrainerSignature: false,
      requiresPiAcknowledgment: false,
      certificateExpected: false,
      notes: `Auto-generated from governance runtime for protocol acceptance change ${String(versionRow.version_label)}.`,
    })
    if (result.ok) created += 1
  }

  return {
    ok: true,
    generatedCount: created,
    protocolRuntimeVersionId: input.protocolRuntimeVersionId,
    protocolRuntimeStudyId: String(versionRow.protocol_runtime_study_id),
  }
}
