'use server'

import { createServerClient } from '@/lib/supabase/server'
import { getSessionUser } from '@/lib/auth/session'

export async function requestOperationalSignature(payload: {
  organizationId: string
  studyId: string
  subjectId?: string
  visitId?: string
  sourcePackageId?: string
  publishedSourceId?: string
  lockedSnapshotId?: string
  artifactType: string
  artifactId: string
  requiredRole: string
  signatureMeaning: string
}) {
  const sessionUser = await getSessionUser()
  if (!sessionUser) throw new Error('Unauthorized')

  const supabase = await createServerClient()
  
  const { data, error } = await supabase.from('operational_signature_requests').insert({
    ...payload,
    requested_by: sessionUser.id
  }).select('id').single()

  if (error) throw new Error(error.message)
  return { ok: true, requestId: data.id }
}

export async function signOperationalRequest(
  requestId: string,
  pinCode: string,
  attestationText: string,
  artifactHash: string = 'NO_HASH_PROVIDED'
) {
  const sessionUser = await getSessionUser()
  if (!sessionUser) throw new Error('Unauthorized')

  // Enforce Re-authentication (Mock implementation for PIN)
  if (pinCode !== '1234') { // Assume '1234' is the mock eSignature PIN for validation
    throw new Error('Authentication failed: Invalid PIN.')
  }

  const supabase = await createServerClient()

  const { data: req, error: reqErr } = await supabase.from('operational_signature_requests').select('*').eq('id', requestId).single()
  if (reqErr || !req) throw new Error('Signature request not found')

  if (req.status !== 'pending') {
    throw new Error('Signature request is not pending.')
  }

  // Record Signature
  const { data: sig, error: sigErr } = await supabase.from('operational_signatures').insert({
    request_id: requestId,
    organization_id: req.organization_id,
    study_id: req.study_id,
    subject_id: req.subject_id,
    visit_id: req.visit_id,
    source_package_id: req.source_package_id,
    published_source_id: req.published_source_id,
    locked_snapshot_id: req.locked_snapshot_id,
    artifact_type: req.artifact_type,
    artifact_id: req.artifact_id,
    required_role: req.required_role,
    signer_user_id: sessionUser.id,
    signer_role: req.required_role, // simplified
    signature_meaning: req.signature_meaning,
    signed_artifact_hash: artifactHash,
    metadata: { attestationText, authMethod: 'PIN' }
  }).select('id').single()

  if (sigErr) throw new Error(sigErr.message)

  // Update request status
  await supabase.from('operational_signature_requests').update({ status: 'signed' }).eq('id', requestId)

  // Audit event
  await supabase.from('operational_signature_events').insert({
    organization_id: req.organization_id,
    study_id: req.study_id,
    request_id: requestId,
    signature_id: sig.id,
    event_type: 'signature_completed',
    actor_user_id: sessionUser.id,
    event_payload: { attestationText, authMethod: 'PIN' }
  })

  return { ok: true, signatureId: sig.id }
}
