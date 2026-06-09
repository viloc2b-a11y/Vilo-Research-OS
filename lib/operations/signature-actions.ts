'use server'

import { createServerClient } from '@/lib/supabase/server'
import {
  OPERATIONAL_SIGNATURE_WARNING,
  createOperationalSignatureRequest,
  isOperationalSignatureMeaning,
  signOperationalArtifact,
  type OperationalSignatureRow,
  type OperationalSignatureRequestRow,
  type OperationalSignatureMeaning,
  type SignaturePolicyCode,
} from '@/lib/operational-signatures'
import { authorizeOperationalSignatureWrite } from '@/lib/operational-signatures/operational-signature-auth'
import { OperationalSignatureStateError } from '@/lib/operational-signatures/operational-signature-errors'
import { getOrganizationMemberships, getSessionUser } from '@/lib/auth/session'

type RequestOperationalSignatureSuccess = {
  ok: true
  requestId: string
  request: OperationalSignatureRequestRow
}

type RequestOperationalSignatureFailure = {
  ok: false
  error: string
}

type SignOperationalRequestSuccess = {
  ok: true
  signature: OperationalSignatureRow
}

type SignOperationalRequestFailure = {
  ok: false
  error: string
}

function resolveLegacySignatureMeaning(value: string): OperationalSignatureMeaning {
  if (isOperationalSignatureMeaning(value)) return value
  const normalized = value.toLowerCase()
  if (normalized.includes('acknowledg')) return 'acknowledged_by'
  if (normalized.includes('approve') || normalized.includes('approved')) return 'approved_by'
  if (normalized.includes('pi') && normalized.includes('review')) return 'pi_review'
  if (normalized.includes('investigator') && normalized.includes('review')) return 'si_review'
  if (normalized.includes('review')) return 'reviewed_by'
  if (normalized.includes('lock')) return 'lock_approval'
  if (normalized.includes('complete') || normalized.includes('accurate')) return 'completed_by'
  return 'reviewed_by'
}

export async function requestOperationalSignature(input: {
  organizationId: string
  studyId: string
  subjectId?: string | null
  visitId?: string | null
  sourcePackageId?: string | null
  publishedSourceId?: string | null
  lockedSnapshotId?: string | null
  module?: string | null
  entityType?: string | null
  entityId?: string | null
  artifactType: string
  artifactId: string
  requiredRole: string
  signatureMeaning: string
  signaturePolicyCode?: string
  requestedUserId?: string | null
  metadata?: Record<string, unknown>
}): Promise<RequestOperationalSignatureSuccess | RequestOperationalSignatureFailure> {
  const auth = await authorizeOperationalSignatureWrite(input.organizationId)
  if (!auth.ok) return { ok: false, error: auth.message }

  const supabase = await createServerClient()

  try {
    const request = await createOperationalSignatureRequest(supabase, {
      organizationId: input.organizationId,
      studyId: input.studyId,
      subjectId: input.subjectId ?? null,
      visitId: input.visitId ?? null,
      sourcePackageId: input.sourcePackageId ?? null,
      publishedSourceId: input.publishedSourceId ?? null,
      lockedSnapshotId: input.lockedSnapshotId ?? null,
      module: input.module ?? null,
      entityType: input.entityType ?? null,
      entityId: input.entityId ?? null,
      artifactType: input.artifactType,
      artifactId: input.artifactId,
      requiredRole: input.requiredRole,
      signatureMeaning: resolveLegacySignatureMeaning(input.signatureMeaning),
      signaturePolicyCode: input.signaturePolicyCode as SignaturePolicyCode | undefined,
      requestedBy: auth.userId,
      requestedUserId: input.requestedUserId ?? null,
      metadata: input.metadata,
    })

    return { ok: true, requestId: request.id, request }
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Failed to create operational signature request'
    return { ok: false, error: message }
  }
}

export async function signOperationalRequest(
  requestId: string,
  pinCode: string,
  attestationText: string,
  mfaVerified = false,
): Promise<SignOperationalRequestSuccess | SignOperationalRequestFailure> {
  const user = await getSessionUser()
  if (!user) return { ok: false, error: 'Sign in required.' }

  const memberships = await getOrganizationMemberships(user.id)
  const supabase = await createServerClient()

  try {
    const signature = await signOperationalArtifact(supabase, {
      requestId,
      signerUserId: user.id,
      signerMemberships: memberships,
      explicitUserAction: true,
      confirmationStatement: OPERATIONAL_SIGNATURE_WARNING,
      signaturePin: pinCode,
      mfaVerified,
      metadata: {
        attestation_text: attestationText,
        signature_flow: 'legacy_wrapper',
      },
    })

    return { ok: true, signature }
  } catch (error) {
    if (error instanceof OperationalSignatureStateError) {
      return { ok: false, error: error.message }
    }
    const message = error instanceof Error ? error.message : 'Signature failed'
    return { ok: false, error: message }
  }
}
