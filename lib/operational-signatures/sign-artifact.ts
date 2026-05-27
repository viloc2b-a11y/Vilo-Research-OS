import type { SupabaseClient } from '@supabase/supabase-js'
import { computeOperationalArtifactHash } from './artifact-hash'
import { appendOperationalSignatureEvent } from './append-signature-event'
import { validateSignerAuthorization } from './validate-signer-authorization'
import {
  OPERATIONAL_SIGNATURE_WARNING,
  mapOperationalSignatureRequestRow,
  mapOperationalSignatureRow,
  type OperationalSignatureRow,
  type SignOperationalArtifactInput,
} from './operational-signature-types'
import { OperationalSignatureStateError } from './create-signature-request'

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

  const signedArtifactHash = computeOperationalArtifactHash({
    artifact: input.artifactSnapshot ?? {},
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
      artifact_type: request.artifactType,
      artifact_id: request.artifactId,
      required_role: authorization.requiredRole,
      signer_user_id: input.signerUserId,
      signer_role: authorization.signerRole,
      signature_meaning: request.signatureMeaning,
      signed_artifact_hash: signedArtifactHash,
      signed_at: signedAt,
      ip_address: input.ipAddress ?? null,
      user_agent: input.userAgent ?? null,
      status: 'signed',
      metadata: {
        ...(input.metadata ?? {}),
        explicit_user_action: true,
        delegation_matched: authorization.delegationMatched,
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

  await appendOperationalSignatureEvent(supabase, {
    organizationId: request.organizationId,
    studyId: request.studyId,
    requestId: request.id,
    signatureId: signature.id,
    eventType: 'signature_recorded',
    eventPayload: {
      signer_role: signature.signerRole,
      required_role: signature.requiredRole,
      signature_meaning: signature.signatureMeaning,
      signed_artifact_hash: signature.signedArtifactHash,
      signed_at: signature.signedAt,
    },
    actorUserId: input.signerUserId,
  })

  return signature
}
