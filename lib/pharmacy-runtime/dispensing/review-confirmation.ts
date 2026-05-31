'use server'

import type { SupabaseClient } from '@supabase/supabase-js'
import { createServerClient } from '@/lib/supabase/server'
import { createOperationalSignatureRequest } from '@/lib/operational-signatures/create-signature-request'
import { assertPharmacyActionGate } from '../actions/access'
import { appendPharmacyDispensingAudit } from './audit'

export async function requestDispensationReviewSignature(
  input: {
    organizationId: string
    studyId: string
    siteId?: string | null
    reviewConfirmationId: string
  },
  supabase?: SupabaseClient,
) {
  const client = supabase ?? (await createServerClient())
  const gate = await assertPharmacyActionGate({
    studyId: input.studyId,
    siteId: input.siteId,
    action: 'dispensation_review' as never,
    resourceType: 'ip_dispensation_review_confirmation',
    resourceId: input.reviewConfirmationId,
    supabase: client,
  })

  const { data: review, error } = await client
    .from('ip_dispensation_review_confirmations')
    .select('id,organization_id,study_id,subject_id,visit_instance_id,procedure_instance_id,primary_crc_id,review_status')
    .eq('id', input.reviewConfirmationId)
    .maybeSingle()
  if (error) throw new Error(error.message)
  if (!review) throw new Error('Dispensation review confirmation was not found.')
  if (String(review.primary_crc_id) === gate.actorId) {
    throw new Error('Secondary CRC reviewer cannot be the primary dispensing CRC.')
  }

  const request = await createOperationalSignatureRequest(client, {
    organizationId: input.organizationId,
    studyId: input.studyId,
    subjectId: String(review.subject_id),
    visitId: String(review.visit_instance_id),
    artifactType: 'ip_dispensation_review_confirmation',
    artifactId: input.reviewConfirmationId,
    requiredRole: 'research_coordinator',
    signatureMeaning: 'reviewed_by',
    requestedBy: gate.actorId,
    metadata: {
      pharmacy_runtime: 'dispensing_phase_2',
      independent_secondary_crc_review: true,
    },
  })

  const { error: updateError } = await client
    .from('ip_dispensation_review_confirmations')
    .update({ signature_request_id: request.id, secondary_crc_id: gate.actorId })
    .eq('id', input.reviewConfirmationId)
  if (updateError) throw new Error(updateError.message)

  await appendPharmacyDispensingAudit(client, {
    organizationId: input.organizationId,
    studyId: input.studyId,
    siteId: input.siteId,
    subjectId: String(review.subject_id),
    visitInstanceId: String(review.visit_instance_id),
    procedureInstanceId: String(review.procedure_instance_id),
    reviewConfirmationId: input.reviewConfirmationId,
    actorId: gate.actorId,
    eventType: 'dispensation_review_signature_requested',
    eventPayload: { signature_request_id: request.id },
  })

  return request
}

export async function completeDispensationReviewConfirmation(
  input: {
    organizationId: string
    studyId: string
    siteId?: string | null
    reviewConfirmationId: string
    signatureId: string
    attestationText: string
  },
  supabase?: SupabaseClient,
) {
  const client = supabase ?? (await createServerClient())
  const gate = await assertPharmacyActionGate({
    studyId: input.studyId,
    siteId: input.siteId,
    action: 'dispensation_review' as never,
    resourceType: 'ip_dispensation_review_confirmation',
    resourceId: input.reviewConfirmationId,
    supabase: client,
  })

  const { data: signature, error: sigError } = await client
    .from('operational_signatures')
    .select('id,request_id,status,artifact_type,artifact_id,signer_user_id')
    .eq('id', input.signatureId)
    .eq('status', 'signed')
    .maybeSingle()
  if (sigError) throw new Error(sigError.message)
  if (!signature) throw new Error('Signed operational signature is required for dispensation review.')
  if (
    String(signature.artifact_type) !== 'ip_dispensation_review_confirmation'
    || String(signature.artifact_id) !== input.reviewConfirmationId
    || String(signature.signer_user_id) !== gate.actorId
  ) {
    throw new Error('Signature is not bound to this secondary CRC review confirmation.')
  }

  const { data: review, error: updateError } = await client
    .from('ip_dispensation_review_confirmations')
    .update({
      review_status: 'reviewed',
      secondary_crc_id: gate.actorId,
      reviewed_at: new Date().toISOString(),
      attestation_text: input.attestationText,
      signature_id: input.signatureId,
      signature_request_id: signature.request_id,
      visibility_scope: 'study_authorization_scope',
      review_mode: 'study_aware',
    })
    .eq('id', input.reviewConfirmationId)
    .neq('primary_crc_id', gate.actorId)
    .select('*')
    .single()

  if (updateError || !review) {
    throw new Error(updateError?.message ?? 'Failed to complete dispensation review confirmation.')
  }

  await appendPharmacyDispensingAudit(client, {
    organizationId: input.organizationId,
    studyId: input.studyId,
    siteId: input.siteId,
    subjectId: String(review.subject_id),
    visitInstanceId: String(review.visit_instance_id),
    procedureInstanceId: String(review.procedure_instance_id),
    dispensationId: String(review.dispensation_id),
    reviewConfirmationId: input.reviewConfirmationId,
    actorId: gate.actorId,
    eventType: 'dispensation_review_confirmed',
    eventPayload: {
      signature_id: input.signatureId,
      execution_mode: review.execution_mode,
      visibility_scope: review.visibility_scope,
    },
  })

  return review
}
