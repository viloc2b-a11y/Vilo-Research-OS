import type { SupabaseClient } from '@supabase/supabase-js'
import { OperationalSignatureStateError } from './operational-signature-errors'
import type { OperationalSignatureRequestRow } from './operational-signature-types'

export const OPERATIONAL_SIGNATURE_TEST_FIXTURE_ARTIFACT_TYPE =
  'operational_signature_test_fixture'

export type LoadedOperationalSignatureArtifact = {
  artifactType: string
  artifactId: string
  payload: Record<string, unknown>
}

type ArtifactLoader = (
  supabase: SupabaseClient,
  request: OperationalSignatureRequestRow,
) => Promise<LoadedOperationalSignatureArtifact>

const artifactLoaders: Record<string, ArtifactLoader> = {
  subject_document: async (supabase, request) => {
    const { data, error } = await supabase
      .from('subject_documents')
      .select(
        'document_id, study_subject_id, visit_id, document_category, file_name, file_path, mime_type, file_size, status, notes, updated_at',
      )
      .eq('document_id', request.artifactId)
      .eq('study_subject_id', request.subjectId)
      .maybeSingle()

    if (error || !data) {
      throw new OperationalSignatureStateError('Subject document artifact was not found.')
    }

    return {
      artifactType: request.artifactType,
      artifactId: request.artifactId,
      payload: data as Record<string, unknown>,
    }
  },
  study_delegation_log: async (supabase, request) => {
    const { data, error } = await supabase
      .from('study_delegation_log')
      .select(
        'id, organization_id, study_id, staff_user_id, delegatee_name, staff_role, staff_initials, pi_delegator_id, pi_initials, task_labels, delegation_date, delegation_start_date, delegation_stop_date, is_ongoing, delegation_status, updated_at',
      )
      .eq('id', request.artifactId)
      .eq('study_id', request.studyId)
      .maybeSingle()

    if (error || !data) {
      throw new OperationalSignatureStateError('Delegation log artifact was not found.')
    }

    return {
      artifactType: request.artifactType,
      artifactId: request.artifactId,
      payload: data as Record<string, unknown>,
    }
  },
  study_training_assignment: async (supabase, request) => {
    const { data, error } = await supabase
      .from('study_training_assignments')
      .select(
        'id, organization_id, study_id, training_item_id, trainee_user_id, trainee_name, trainee_role, trainee_initials, assigned_by, due_date, training_status, certificate_attached, certificate_number, notes, completed_at, locked_at, study_training_items(training_type, training_topic, training_material_title, trainer_user_id, trainer_name, trainer_initials, requires_trainer_signature, requires_pi_acknowledgment, certificate_expected)',
      )
      .eq('id', request.artifactId)
      .eq('study_id', request.studyId)
      .maybeSingle()

    if (error || !data) {
      throw new OperationalSignatureStateError('Training assignment artifact was not found.')
    }

    return {
      artifactType: request.artifactType,
      artifactId: request.artifactId,
      payload: data as Record<string, unknown>,
    }
  },
  subject_consent_version: async (supabase, request) => {
    const { data, error } = await supabase
      .from('subject_consent_versions')
      .select(
        'id, organization_id, study_id, study_subject_id, consent_type, consent_version_label, protocol_version, amendment_identifier, language, status, effective_at, expires_at, supersedes_consent_version_id, requires_pi_review, completed_at, active_at, locked_at, reason, updated_at',
      )
      .eq('id', request.artifactId)
      .eq('study_id', request.studyId)
      .maybeSingle()

    if (error || !data) {
      throw new OperationalSignatureStateError('Consent version artifact was not found.')
    }

    return {
      artifactType: request.artifactType,
      artifactId: request.artifactId,
      payload: data as Record<string, unknown>,
    }
  },
  subject_consent_withdrawal: async (supabase, request) => {
    const { data, error } = await supabase
      .from('subject_consent_withdrawals')
      .select(
        'id, organization_id, study_id, study_subject_id, consent_version_id, withdrawal_scope, reason, withdrawn_at, acknowledged_at, locked_at',
      )
      .eq('id', request.artifactId)
      .eq('study_id', request.studyId)
      .maybeSingle()

    if (error || !data) {
      throw new OperationalSignatureStateError('Consent withdrawal artifact was not found.')
    }

    return {
      artifactType: request.artifactType,
      artifactId: request.artifactId,
      payload: data as Record<string, unknown>,
    }
  },
  subject_consent_event: async (supabase, request) => {
    const { data, error } = await supabase
      .from('subject_consent_events')
      .select(
        'id, organization_id, study_id, study_subject_id, consent_version_id, event_type, event_status, event_at, reason, metadata',
      )
      .eq('id', request.artifactId)
      .eq('study_id', request.studyId)
      .maybeSingle()

    if (error || !data) {
      throw new OperationalSignatureStateError('Consent event artifact was not found.')
    }

    return {
      artifactType: request.artifactType,
      artifactId: request.artifactId,
      payload: data as Record<string, unknown>,
    }
  },
  subject_consent_optional_permission: async (supabase, request) => {
    const { data, error } = await supabase
      .from('subject_consent_optional_permissions')
      .select(
        'id, organization_id, study_id, study_subject_id, consent_version_id, permission_type, permission_status, effective_at, changed_reason, updated_at',
      )
      .eq('id', request.artifactId)
      .eq('study_id', request.studyId)
      .maybeSingle()

    if (error || !data) {
      throw new OperationalSignatureStateError('Consent optional permission artifact was not found.')
    }

    return {
      artifactType: request.artifactType,
      artifactId: request.artifactId,
      payload: data as Record<string, unknown>,
    }
  },
  [OPERATIONAL_SIGNATURE_TEST_FIXTURE_ARTIFACT_TYPE]: async (_supabase, request) => {
    const fixture = request.metadata.operational_signature_test_fixture
    if (!fixture || typeof fixture !== 'object' || Array.isArray(fixture)) {
      throw new OperationalSignatureStateError(
        'Trusted test fixture artifact payload is missing from the persisted request.',
      )
    }

    return {
      artifactType: request.artifactType,
      artifactId: request.artifactId,
      payload: fixture as Record<string, unknown>,
    }
  },
}

export async function loadOperationalSignatureArtifactForHash(
  supabase: SupabaseClient,
  request: OperationalSignatureRequestRow,
): Promise<LoadedOperationalSignatureArtifact> {
  const loader = artifactLoaders[request.artifactType]
  if (!loader) {
    throw new OperationalSignatureStateError(
      `Unsupported operational signature artifact type: ${request.artifactType}. Trusted server-side artifact loader is required before signing.`,
    )
  }

  return loader(supabase, request)
}
