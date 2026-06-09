import crypto from 'node:crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import { computeOperationalArtifactHash } from './artifact-hash'
import { loadOperationalSignatureArtifactForHash } from './artifact-loader'
import { appendOperationalSignatureEvent } from './append-signature-event'
import {
  loadSignatureCredential,
  recordSignaturePinFailure,
  resetSignatureCredentialFailures,
  verifySignaturePin,
} from './signature-credentials'
import { loadActiveSignaturePolicies } from './signature-policies'
import { validateSignerAuthorization } from './validate-signer-authorization'
import {
  OPERATIONAL_SIGNATURE_WARNING,
  mapOperationalSignatureRequestRow,
  mapOperationalSignatureRow,
  type OperationalSignatureRow,
  type SignOperationalArtifactInput,
} from './operational-signature-types'
import { OperationalSignatureStateError } from './operational-signature-errors'

export async function signOperationalArtifact(
  supabase: SupabaseClient,
  input: SignOperationalArtifactInput,
): Promise<OperationalSignatureRow> {
  if (!input.explicitUserAction || input.confirmationStatement !== OPERATIONAL_SIGNATURE_WARNING) {
    throw new OperationalSignatureStateError('Explicit signature confirmation is required.')
  }

  const requestResult = await supabase
    .from('operational_signature_requests')
    .select('*')
    .eq('id', input.requestId)
    .single()

  if (requestResult.error || !requestResult.data) {
    throw new OperationalSignatureStateError('Signature request was not found.')
  }

  const request = mapOperationalSignatureRequestRow(
    requestResult.data as Record<string, unknown>,
  )
  if (request.status !== 'pending') {
    throw new OperationalSignatureStateError('Only pending signature requests can be signed.')
  }

  const authorization = validateSignerAuthorization({
    memberships: input.signerMemberships,
    organizationId: request.organizationId,
    requiredRole: request.requiredRole,
  })
  if (!authorization.ok) {
    throw new OperationalSignatureStateError(authorization.reason)
  }

  const { data: sessionUserResult } = await supabase.auth.getUser()
  const sessionUser = sessionUserResult.user
  if (!sessionUser || sessionUser.id !== input.signerUserId) {
    throw new OperationalSignatureStateError('Current session does not match the signer.')
  }

  const policies = await loadActiveSignaturePolicies(supabase)
  const policy =
    policies.find((row) => row.policyCode === request.signaturePolicyCode) ??
    policies.find((row) => row.policyCode === 'standard_signature') ??
    null

  const credential = await loadSignatureCredential(supabase, input.signerUserId)
  if (!credential || !credential.active) {
    throw new OperationalSignatureStateError('Create an active Signature PIN before signing.')
  }
  if (credential.lockedUntil && new Date(credential.lockedUntil).getTime() > Date.now()) {
    throw new OperationalSignatureStateError('Signature PIN is temporarily locked. Please reset it later.')
  }
  if (credential.requiresReset) {
    throw new OperationalSignatureStateError('Signature PIN requires reset before signing.')
  }
  const pinValid = await verifySignaturePin(input.signaturePin, credential.signaturePinHash)
  if (!pinValid) {
    const updated = await recordSignaturePinFailure(supabase, {
      userId: input.signerUserId,
      reason: 'Invalid signature PIN.',
    })
    throw new OperationalSignatureStateError(
      updated?.lockedUntil && new Date(updated.lockedUntil).getTime() > Date.now()
        ? 'Invalid PIN. Signature PIN has been temporarily locked.'
        : 'Invalid signature PIN.',
    )
  }
  await resetSignatureCredentialFailures(supabase, input.signerUserId)
  if (policy?.mfaRequired && !input.mfaVerified) {
    throw new OperationalSignatureStateError('MFA verification is required for this signature policy.')
  }

  const loadedArtifact = await loadOperationalSignatureArtifactForHash(supabase, request)
  const signedArtifactHash = computeOperationalArtifactHash({
    artifact: loadedArtifact.payload,
    artifact_id: request.artifactId,
    artifact_type: request.artifactType,
    locked_snapshot_id: request.lockedSnapshotId,
    published_source_id: request.publishedSourceId,
    request_id: request.id,
    signature_meaning: request.signatureMeaning,
    source_package_id: request.sourcePackageId,
    subject_id: request.subjectId,
    visit_id: request.visitId,
  })
  const signedAt = new Date().toISOString()
  const auditTrailId = crypto.randomUUID()

  const signatureResult = await supabase
    .from('operational_signatures')
    .insert({
      request_id: request.id,
      organization_id: request.organizationId,
      study_id: request.studyId,
      subject_id: request.subjectId,
      visit_id: request.visitId,
      source_package_id: request.sourcePackageId,
      published_source_id: request.publishedSourceId,
      locked_snapshot_id: request.lockedSnapshotId,
      module: request.module ?? request.artifactType,
      entity_type: request.entityType ?? request.artifactType,
      entity_id: request.entityId ?? request.artifactId,
      artifact_type: request.artifactType,
      artifact_id: request.artifactId,
      required_role: authorization.requiredRole,
      signer_user_id: input.signerUserId,
      signer_name_snapshot: sessionUser.user_metadata?.full_name
        ? String(sessionUser.user_metadata.full_name)
        : sessionUser.email ?? sessionUser.id,
      signer_role_snapshot: authorization.signerRole,
      signer_role: authorization.signerRole,
      signature_meaning: request.signatureMeaning,
      signature_policy_code: request.signaturePolicyCode,
      signed_artifact_hash: signedArtifactHash,
      signed_content_version: String(input.metadata?.signed_content_version ?? '1'),
      verification_method: policy?.mfaRequired ? 'signature_pin+mfa' : 'signature_pin',
      signed_at: signedAt,
      ip_address: input.ipAddress ?? null,
      user_agent: input.userAgent ?? null,
      status: 'signed',
      session_id: input.metadata?.session_id ? String(input.metadata.session_id) : null,
      audit_trail_id: auditTrailId,
      metadata: {
      ...(input.metadata ?? {}),
      explicit_user_action: true,
      delegation_matched: authorization.delegationMatched,
      hash_source: 'server_loaded_artifact',
    },
  })
    .select('*')
    .single()

  if (signatureResult.error || !signatureResult.data) {
    throw new Error(signatureResult.error?.message ?? 'Failed to record operational signature')
  }

  const signature = mapOperationalSignatureRow(signatureResult.data as Record<string, unknown>)

  const updateResult = await supabase
    .from('operational_signature_requests')
    .update({ status: 'signed' })
    .eq('id', request.id)
    .eq('status', 'pending')

  if (updateResult.error) throw new Error(updateResult.error.message)

  await finalizeGovernanceProtocolAcceptance(supabase, request, signature)
  await appendOperationalSignatureEvent(supabase, {
    organizationId: request.organizationId,
    studyId: request.studyId,
    requestId: request.id,
    signatureId: signature.id,
    eventType: 'signature_recorded',
    eventPayload: {
      audit_trail_id: auditTrailId,
      signature_id: signature.id,
      request_id: request.id,
      artifact_type: signature.artifactType,
      artifact_id: signature.artifactId,
      signer_user_id: signature.signerUserId,
      signer_role: signature.signerRole,
      required_role: signature.requiredRole,
      signature_meaning: signature.signatureMeaning,
      delegation_matched: authorization.delegationMatched,
      signed_artifact_hash: signature.signedArtifactHash,
      ip_address: signature.ipAddress,
      user_agent: signature.userAgent,
      signed_at: signature.signedAt,
    },
    actorUserId: input.signerUserId,
  })

  return signature
}

async function finalizeGovernanceProtocolAcceptance(
  supabase: SupabaseClient,
  request: ReturnType<typeof mapOperationalSignatureRequestRow>,
  signature: OperationalSignatureRow,
) {
  if (request.module !== 'governance' || request.entityType !== 'protocol_version') return

  const now = signature.signedAt
  const { error } = await supabase
    .from('protocol_runtime_versions')
    .update({
      pi_acceptance_signature_request_id: request.id,
      pi_acceptance_signature_id: signature.id,
      pi_acceptance_status: 'signed',
      pi_accepted_at: now,
      pi_accepted_by: signature.signerUserId,
    })
    .eq('id', request.entityId ?? request.artifactId)

  if (error) {
    throw new OperationalSignatureStateError(
      `Failed to persist PI protocol acceptance: ${error.message}`,
    )
  }
}
