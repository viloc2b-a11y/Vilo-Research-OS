import type { SupabaseClient } from '@supabase/supabase-js'
import {
  isOperationalSignatureMeaning,
  mapOperationalSignatureRequestRow,
  type CreateOperationalSignatureRequestInput,
  type OperationalSignatureRequestRow,
} from './operational-signature-types'
import { appendOperationalSignatureEvent } from './append-signature-event'
import { assertOperationalSignatureStudyScope } from './validate-org-study-scope'
import { OperationalSignatureStateError } from './operational-signature-errors'

export async function createOperationalSignatureRequest(
  supabase: SupabaseClient,
  input: CreateOperationalSignatureRequestInput,
): Promise<OperationalSignatureRequestRow> {
  if (!input.studyId.trim()) throw new OperationalSignatureStateError('Study scope is required.')
  if (!input.artifactType.trim()) {
    throw new OperationalSignatureStateError('Artifact type is required.')
  }
  if (!input.artifactId.trim()) throw new OperationalSignatureStateError('Artifact id is required.')
  if (!input.requiredRole.trim()) {
    throw new OperationalSignatureStateError('Required role is required.')
  }
  if (!isOperationalSignatureMeaning(input.signatureMeaning)) {
    throw new OperationalSignatureStateError('Signature meaning is not supported.')
  }
  await assertOperationalSignatureStudyScope(supabase, {
    organizationId: input.organizationId,
    studyId: input.studyId,
  })

  const { data, error } = await supabase
    .from('operational_signature_requests')
    .insert({
      organization_id: input.organizationId,
      study_id: input.studyId,
      subject_id: input.subjectId ?? null,
      visit_id: input.visitId ?? null,
      source_package_id: input.sourcePackageId ?? null,
      published_source_id: input.publishedSourceId ?? null,
      locked_snapshot_id: input.lockedSnapshotId ?? null,
      artifact_type: input.artifactType.trim(),
      artifact_id: input.artifactId,
      required_role: input.requiredRole.trim(),
      signature_meaning: input.signatureMeaning,
      status: 'pending',
      requested_by: input.requestedBy,
      metadata: input.metadata ?? {},
    })
    .select('*')
    .single()

  if (error || !data) {
    throw new Error(error?.message ?? 'Failed to create operational signature request')
  }

  const request = mapOperationalSignatureRequestRow(data as Record<string, unknown>)
  await appendOperationalSignatureEvent(supabase, {
    organizationId: request.organizationId,
    studyId: request.studyId,
    requestId: request.id,
    eventType: 'signature_request_created',
    eventPayload: {
      artifact_type: request.artifactType,
      artifact_id: request.artifactId,
      required_role: request.requiredRole,
      signature_meaning: request.signatureMeaning,
    },
    actorUserId: input.requestedBy,
  })

  return request
}
