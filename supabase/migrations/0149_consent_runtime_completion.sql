-- Consent Runtime completion: master consent registry, reader linkage,
-- reconsent detection state, patient eConsent sessions/signatures.

CREATE TABLE IF NOT EXISTS public.consent_document_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  study_id uuid NOT NULL REFERENCES public.studies(id) ON DELETE CASCADE,
  protocol_version_id uuid,
  document_reader_artifact_id uuid REFERENCES public.document_intelligence_documents(id) ON DELETE SET NULL,
  document_id uuid,
  consent_type text NOT NULL,
  version_number integer NOT NULL,
  version_label text,
  irb_approval_date date,
  effective_date date NOT NULL,
  expiration_date date,
  reconsent_required boolean NOT NULL DEFAULT false,
  required_by_date date,
  amendment_identifier text,
  status text NOT NULL DEFAULT 'draft',
  extraction_confidence numeric(5,4),
  review_status text NOT NULL DEFAULT 'not_required',
  optional_clause_changed boolean NOT NULL DEFAULT false,
  language text NOT NULL DEFAULT 'en',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT consent_document_versions_type_check CHECK (
    consent_type IN (
      'main_icf',
      'hipaa_authorization',
      'assent',
      'optional_future_use',
      'genetic_testing',
      'biospecimen_storage',
      'contact_future_research'
    )
  ),
  CONSTRAINT consent_document_versions_status_check CHECK (
    status IN ('draft', 'review_needed', 'irb_approved', 'active', 'superseded', 'retired')
  ),
  CONSTRAINT consent_document_versions_review_check CHECK (
    review_status IN ('not_required', 'needs_review', 'reviewed')
  ),
  CONSTRAINT consent_document_versions_version_positive CHECK (version_number > 0),
  CONSTRAINT consent_document_versions_metadata_object CHECK (jsonb_typeof(metadata) = 'object')
);

CREATE UNIQUE INDEX IF NOT EXISTS consent_document_versions_unique_version_idx
  ON public.consent_document_versions(study_id, consent_type, version_number);
CREATE UNIQUE INDEX IF NOT EXISTS consent_document_versions_one_active_idx
  ON public.consent_document_versions(study_id, consent_type)
  WHERE status = 'active';
CREATE INDEX IF NOT EXISTS consent_document_versions_reader_idx
  ON public.consent_document_versions(document_reader_artifact_id);
CREATE INDEX IF NOT EXISTS consent_document_versions_reconsent_idx
  ON public.consent_document_versions(study_id, reconsent_required, status);

CREATE TABLE IF NOT EXISTS public.consent_document_clauses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  study_id uuid NOT NULL REFERENCES public.studies(id) ON DELETE CASCADE,
  consent_document_version_id uuid NOT NULL REFERENCES public.consent_document_versions(id) ON DELETE CASCADE,
  clause_type text NOT NULL,
  clause_status text NOT NULL DEFAULT 'present',
  extracted_text text,
  extraction_confidence numeric(5,4),
  requires_optional_permission boolean NOT NULL DEFAULT false,
  requires_reconsent_on_change boolean NOT NULL DEFAULT false,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT consent_document_clauses_type_check CHECK (
    clause_type IN (
      'future_research_use',
      'genetic_testing',
      'optional_biospecimen_storage',
      'contact_for_future_studies',
      'data_sharing',
      'hipaa_authorization',
      'withdrawal_language'
    )
  ),
  CONSTRAINT consent_document_clauses_status_check CHECK (
    clause_status IN ('present', 'absent', 'changed', 'needs_review')
  ),
  CONSTRAINT consent_document_clauses_unique UNIQUE (consent_document_version_id, clause_type),
  CONSTRAINT consent_document_clauses_metadata_object CHECK (jsonb_typeof(metadata) = 'object')
);

CREATE INDEX IF NOT EXISTS consent_document_clauses_version_idx
  ON public.consent_document_clauses(consent_document_version_id);

CREATE TABLE IF NOT EXISTS public.subject_consent_reconsent_requirements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  study_id uuid NOT NULL REFERENCES public.studies(id) ON DELETE CASCADE,
  study_subject_id uuid NOT NULL REFERENCES public.study_subjects(id) ON DELETE CASCADE,
  consent_document_version_id uuid NOT NULL REFERENCES public.consent_document_versions(id) ON DELETE CASCADE,
  current_subject_consent_version_id uuid REFERENCES public.subject_consent_versions(id) ON DELETE SET NULL,
  consent_outdated boolean NOT NULL DEFAULT true,
  reconsent_required boolean NOT NULL DEFAULT true,
  consent_action_required boolean NOT NULL DEFAULT true,
  pending_consent_version_id uuid REFERENCES public.consent_document_versions(id) ON DELETE SET NULL,
  reconsent_due_date date,
  reconsent_status text NOT NULL DEFAULT 'pending',
  reason text NOT NULL,
  detected_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  waived_at timestamptz,
  waived_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT subject_consent_reconsent_status_check CHECK (
    reconsent_status IN ('not_required', 'pending', 'overdue', 'completed', 'waived')
  ),
  CONSTRAINT subject_consent_reconsent_unique UNIQUE (study_subject_id, consent_document_version_id),
  CONSTRAINT subject_consent_reconsent_metadata_object CHECK (jsonb_typeof(metadata) = 'object')
);

CREATE INDEX IF NOT EXISTS subject_consent_reconsent_queue_idx
  ON public.subject_consent_reconsent_requirements(study_id, reconsent_status, reconsent_due_date);
CREATE INDEX IF NOT EXISTS subject_consent_reconsent_subject_idx
  ON public.subject_consent_reconsent_requirements(study_subject_id, reconsent_status);

CREATE TABLE IF NOT EXISTS public.subject_consent_patient_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  study_id uuid NOT NULL REFERENCES public.studies(id) ON DELETE CASCADE,
  study_subject_id uuid NOT NULL REFERENCES public.study_subjects(id) ON DELETE CASCADE,
  consent_document_version_id uuid REFERENCES public.consent_document_versions(id) ON DELETE SET NULL,
  subject_consent_version_id uuid REFERENCES public.subject_consent_versions(id) ON DELETE SET NULL,
  token_hash text NOT NULL UNIQUE,
  token_hint text NOT NULL,
  scope text NOT NULL DEFAULT 'consent_only',
  language text NOT NULL DEFAULT 'en',
  status text NOT NULL DEFAULT 'active',
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  sent_at timestamptz,
  last_viewed_at timestamptz,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT subject_consent_patient_sessions_scope_check CHECK (scope = 'consent_only'),
  CONSTRAINT subject_consent_patient_sessions_language_check CHECK (language IN ('en', 'es')),
  CONSTRAINT subject_consent_patient_sessions_status_check CHECK (
    status IN ('active', 'viewed', 'signed', 'expired', 'revoked')
  ),
  CONSTRAINT subject_consent_patient_sessions_metadata_object CHECK (jsonb_typeof(metadata) = 'object')
);

CREATE INDEX IF NOT EXISTS subject_consent_patient_sessions_subject_idx
  ON public.subject_consent_patient_sessions(study_subject_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.subject_consent_patient_signatures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  study_id uuid NOT NULL REFERENCES public.studies(id) ON DELETE CASCADE,
  study_subject_id uuid NOT NULL REFERENCES public.study_subjects(id) ON DELETE CASCADE,
  patient_session_id uuid NOT NULL REFERENCES public.subject_consent_patient_sessions(id) ON DELETE RESTRICT,
  subject_consent_version_id uuid REFERENCES public.subject_consent_versions(id) ON DELETE SET NULL,
  consent_event_id uuid REFERENCES public.subject_consent_events(id) ON DELETE SET NULL,
  signer_type text NOT NULL,
  signer_name text NOT NULL,
  signature_method text NOT NULL DEFAULT 'typed_attestation',
  attestation_text text NOT NULL,
  signed_at timestamptz NOT NULL DEFAULT now(),
  ip_address inet,
  user_agent text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT subject_consent_patient_signatures_signer_check CHECK (
    signer_type IN ('patient', 'lar_guardian', 'witness')
  ),
  CONSTRAINT subject_consent_patient_signatures_method_check CHECK (
    signature_method IN ('typed_attestation', 'drawn_signature', 'checkbox_attestation')
  ),
  CONSTRAINT subject_consent_patient_signatures_name_required CHECK (length(trim(signer_name)) > 0),
  CONSTRAINT subject_consent_patient_signatures_metadata_object CHECK (jsonb_typeof(metadata) = 'object')
);

CREATE INDEX IF NOT EXISTS subject_consent_patient_signatures_session_idx
  ON public.subject_consent_patient_signatures(patient_session_id);
CREATE INDEX IF NOT EXISTS subject_consent_patient_signatures_subject_idx
  ON public.subject_consent_patient_signatures(study_subject_id, signed_at DESC);

ALTER TABLE public.subject_consent_versions
  ADD COLUMN IF NOT EXISTS consent_document_version_id uuid REFERENCES public.consent_document_versions(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS patient_signature_id uuid REFERENCES public.subject_consent_patient_signatures(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS lar_guardian_signature_id uuid REFERENCES public.subject_consent_patient_signatures(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS witness_signature_id uuid REFERENCES public.subject_consent_patient_signatures(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS patient_signature_required boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS witness_signature_required boolean NOT NULL DEFAULT false;

ALTER TABLE public.subject_consent_events
  ADD COLUMN IF NOT EXISTS consent_document_version_id uuid REFERENCES public.consent_document_versions(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS patient_session_id uuid REFERENCES public.subject_consent_patient_sessions(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS patient_signature_id uuid REFERENCES public.subject_consent_patient_signatures(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS subject_consent_versions_master_idx
  ON public.subject_consent_versions(consent_document_version_id);
CREATE INDEX IF NOT EXISTS subject_consent_events_master_idx
  ON public.subject_consent_events(consent_document_version_id);

CREATE OR REPLACE FUNCTION public.consent_runtime_touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS consent_document_versions_touch_updated_at
  ON public.consent_document_versions;
CREATE TRIGGER consent_document_versions_touch_updated_at
BEFORE UPDATE ON public.consent_document_versions
FOR EACH ROW EXECUTE FUNCTION public.consent_runtime_touch_updated_at();

ALTER TABLE public.consent_document_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.consent_document_clauses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subject_consent_reconsent_requirements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subject_consent_patient_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subject_consent_patient_signatures ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS consent_document_versions_select ON public.consent_document_versions;
CREATE POLICY consent_document_versions_select ON public.consent_document_versions
  FOR SELECT USING (organization_id IN (SELECT public.user_organization_ids()) AND public.user_has_study_access(study_id));
DROP POLICY IF EXISTS consent_document_versions_insert ON public.consent_document_versions;
CREATE POLICY consent_document_versions_insert ON public.consent_document_versions
  FOR INSERT WITH CHECK (organization_id IN (SELECT public.user_organization_ids()) AND public.user_has_study_access(study_id));
DROP POLICY IF EXISTS consent_document_versions_update ON public.consent_document_versions;
CREATE POLICY consent_document_versions_update ON public.consent_document_versions
  FOR UPDATE USING (organization_id IN (SELECT public.user_organization_ids()) AND public.user_has_study_access(study_id));

DROP POLICY IF EXISTS consent_document_clauses_select ON public.consent_document_clauses;
CREATE POLICY consent_document_clauses_select ON public.consent_document_clauses
  FOR SELECT USING (organization_id IN (SELECT public.user_organization_ids()) AND public.user_has_study_access(study_id));
DROP POLICY IF EXISTS consent_document_clauses_insert ON public.consent_document_clauses;
CREATE POLICY consent_document_clauses_insert ON public.consent_document_clauses
  FOR INSERT WITH CHECK (organization_id IN (SELECT public.user_organization_ids()) AND public.user_has_study_access(study_id));

DROP POLICY IF EXISTS subject_consent_reconsent_select ON public.subject_consent_reconsent_requirements;
CREATE POLICY subject_consent_reconsent_select ON public.subject_consent_reconsent_requirements
  FOR SELECT USING (organization_id IN (SELECT public.user_organization_ids()) AND public.user_has_study_access(study_id));
DROP POLICY IF EXISTS subject_consent_reconsent_insert ON public.subject_consent_reconsent_requirements;
CREATE POLICY subject_consent_reconsent_insert ON public.subject_consent_reconsent_requirements
  FOR INSERT WITH CHECK (organization_id IN (SELECT public.user_organization_ids()) AND public.user_has_study_access(study_id));
DROP POLICY IF EXISTS subject_consent_reconsent_update ON public.subject_consent_reconsent_requirements;
CREATE POLICY subject_consent_reconsent_update ON public.subject_consent_reconsent_requirements
  FOR UPDATE USING (organization_id IN (SELECT public.user_organization_ids()) AND public.user_has_study_access(study_id));

DROP POLICY IF EXISTS subject_consent_patient_sessions_select ON public.subject_consent_patient_sessions;
CREATE POLICY subject_consent_patient_sessions_select ON public.subject_consent_patient_sessions
  FOR SELECT USING (organization_id IN (SELECT public.user_organization_ids()) AND public.user_has_study_access(study_id));
DROP POLICY IF EXISTS subject_consent_patient_sessions_insert ON public.subject_consent_patient_sessions;
CREATE POLICY subject_consent_patient_sessions_insert ON public.subject_consent_patient_sessions
  FOR INSERT WITH CHECK (organization_id IN (SELECT public.user_organization_ids()) AND public.user_has_study_access(study_id));
DROP POLICY IF EXISTS subject_consent_patient_sessions_update ON public.subject_consent_patient_sessions;
CREATE POLICY subject_consent_patient_sessions_update ON public.subject_consent_patient_sessions
  FOR UPDATE USING (organization_id IN (SELECT public.user_organization_ids()) AND public.user_has_study_access(study_id));

DROP POLICY IF EXISTS subject_consent_patient_signatures_select ON public.subject_consent_patient_signatures;
CREATE POLICY subject_consent_patient_signatures_select ON public.subject_consent_patient_signatures
  FOR SELECT USING (organization_id IN (SELECT public.user_organization_ids()) AND public.user_has_study_access(study_id));
DROP POLICY IF EXISTS subject_consent_patient_signatures_insert ON public.subject_consent_patient_signatures;
CREATE POLICY subject_consent_patient_signatures_insert ON public.subject_consent_patient_signatures
  FOR INSERT WITH CHECK (organization_id IN (SELECT public.user_organization_ids()) AND public.user_has_study_access(study_id));

COMMENT ON TABLE public.consent_document_versions IS
  'Master study consent document registry populated manually or from Document Reader extraction.';
COMMENT ON TABLE public.subject_consent_reconsent_requirements IS
  'Subject-level reconsent detection queue/state derived from required consent document versions.';
