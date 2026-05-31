-- Full Consent Runtime.
-- Scope: subject consent runtime only. Does not alter Visit Runtime, Procedure
-- Signatures, Training Log, Delegation Log, IP Accountability, SDV, or Query Workflow.

CREATE TABLE IF NOT EXISTS public.subject_consent_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  study_id uuid NOT NULL REFERENCES public.studies(id) ON DELETE CASCADE,
  study_subject_id uuid NOT NULL REFERENCES public.study_subjects(id) ON DELETE CASCADE,
  consent_type text NOT NULL,
  consent_version_label text NOT NULL,
  protocol_version text,
  amendment_identifier text,
  language text NOT NULL DEFAULT 'en',
  status text NOT NULL DEFAULT 'pending',
  effective_at timestamptz,
  expires_at timestamptz,
  supersedes_consent_version_id uuid REFERENCES public.subject_consent_versions(id) ON DELETE SET NULL,
  superseded_by_consent_version_id uuid REFERENCES public.subject_consent_versions(id) ON DELETE SET NULL,
  coordinator_signature_request_id uuid REFERENCES public.operational_signature_requests(id) ON DELETE SET NULL,
  pi_signature_request_id uuid REFERENCES public.operational_signature_requests(id) ON DELETE SET NULL,
  requires_pi_review boolean NOT NULL DEFAULT false,
  completed_at timestamptz,
  active_at timestamptz,
  locked_at timestamptz,
  locked_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reason text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT subject_consent_versions_type_check CHECK (
    consent_type IN (
      'initial_consent',
      're_consent',
      'amendment_consent',
      'hipaa_authorization',
      'optional_consent',
      'future_use_consent',
      'genetic_consent'
    )
  ),
  CONSTRAINT subject_consent_versions_status_check CHECK (
    status IN ('pending', 'completed', 'active', 'superseded', 'withdrawn', 'expired', 'invalidated')
  ),
  CONSTRAINT subject_consent_versions_label_required CHECK (length(trim(consent_version_label)) > 0),
  CONSTRAINT subject_consent_versions_metadata_object CHECK (jsonb_typeof(metadata) = 'object')
);

CREATE UNIQUE INDEX IF NOT EXISTS subject_consent_one_active_initial_idx
  ON public.subject_consent_versions(study_subject_id, study_id)
  WHERE consent_type = 'initial_consent' AND status = 'active';

CREATE INDEX IF NOT EXISTS subject_consent_versions_subject_idx
  ON public.subject_consent_versions(study_subject_id, created_at DESC);
CREATE INDEX IF NOT EXISTS subject_consent_versions_study_idx
  ON public.subject_consent_versions(study_id);
CREATE INDEX IF NOT EXISTS subject_consent_versions_coordinator_sig_idx
  ON public.subject_consent_versions(coordinator_signature_request_id);
CREATE INDEX IF NOT EXISTS subject_consent_versions_pi_sig_idx
  ON public.subject_consent_versions(pi_signature_request_id);

CREATE TABLE IF NOT EXISTS public.subject_consent_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  study_id uuid NOT NULL REFERENCES public.studies(id) ON DELETE CASCADE,
  study_subject_id uuid NOT NULL REFERENCES public.study_subjects(id) ON DELETE CASCADE,
  consent_version_id uuid REFERENCES public.subject_consent_versions(id) ON DELETE SET NULL,
  event_type text NOT NULL,
  event_status text NOT NULL DEFAULT 'pending',
  event_at timestamptz NOT NULL DEFAULT now(),
  reason text,
  signature_request_id uuid REFERENCES public.operational_signature_requests(id) ON DELETE SET NULL,
  actor_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT subject_consent_events_type_check CHECK (
    event_type IN (
      'initial_consent',
      're_consent',
      'amendment_consent',
      'hipaa_authorization',
      'optional_permission_update',
      'future_use_consent',
      'genetic_consent',
      'withdrawal',
      'supersession',
      'invalidation',
      'signature_requested',
      'signature_completed',
      'document_linked'
    )
  ),
  CONSTRAINT subject_consent_events_status_check CHECK (
    event_status IN ('pending', 'completed', 'active', 'superseded', 'withdrawn', 'expired', 'invalidated')
  ),
  CONSTRAINT subject_consent_events_metadata_object CHECK (jsonb_typeof(metadata) = 'object')
);

CREATE INDEX IF NOT EXISTS subject_consent_events_subject_idx
  ON public.subject_consent_events(study_subject_id, event_at DESC);
CREATE INDEX IF NOT EXISTS subject_consent_events_version_idx
  ON public.subject_consent_events(consent_version_id, event_at DESC);
CREATE INDEX IF NOT EXISTS subject_consent_events_sig_idx
  ON public.subject_consent_events(signature_request_id);

CREATE TABLE IF NOT EXISTS public.subject_consent_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  study_id uuid NOT NULL REFERENCES public.studies(id) ON DELETE CASCADE,
  study_subject_id uuid NOT NULL REFERENCES public.study_subjects(id) ON DELETE CASCADE,
  consent_version_id uuid REFERENCES public.subject_consent_versions(id) ON DELETE SET NULL,
  consent_event_id uuid REFERENCES public.subject_consent_events(id) ON DELETE SET NULL,
  document_kind text NOT NULL,
  file_name text NOT NULL,
  file_path text,
  external_document_id text,
  mime_type text,
  document_hash text,
  linked_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  linked_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT subject_consent_documents_kind_check CHECK (
    document_kind IN ('icf', 'hipaa', 'optional_consent', 'withdrawal', 'source_document', 'other')
  ),
  CONSTRAINT subject_consent_documents_file_required CHECK (length(trim(file_name)) > 0),
  CONSTRAINT subject_consent_documents_metadata_object CHECK (jsonb_typeof(metadata) = 'object')
);

CREATE INDEX IF NOT EXISTS subject_consent_documents_subject_idx
  ON public.subject_consent_documents(study_subject_id, linked_at DESC);
CREATE INDEX IF NOT EXISTS subject_consent_documents_version_idx
  ON public.subject_consent_documents(consent_version_id);

CREATE TABLE IF NOT EXISTS public.subject_consent_optional_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  study_id uuid NOT NULL REFERENCES public.studies(id) ON DELETE CASCADE,
  study_subject_id uuid NOT NULL REFERENCES public.study_subjects(id) ON DELETE CASCADE,
  consent_version_id uuid REFERENCES public.subject_consent_versions(id) ON DELETE SET NULL,
  permission_type text NOT NULL,
  permission_status text NOT NULL DEFAULT 'not_asked',
  effective_at timestamptz,
  changed_reason text,
  signature_request_id uuid REFERENCES public.operational_signature_requests(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT subject_consent_optional_permissions_type_check CHECK (
    permission_type IN ('future_use_samples', 'genetic_testing', 'optional_specimen', 'contact_for_future_research', 'data_sharing')
  ),
  CONSTRAINT subject_consent_optional_permissions_status_check CHECK (
    permission_status IN ('not_asked', 'granted', 'declined', 'withdrawn')
  ),
  CONSTRAINT subject_consent_optional_permissions_unique UNIQUE (study_subject_id, permission_type),
  CONSTRAINT subject_consent_optional_permissions_metadata_object CHECK (jsonb_typeof(metadata) = 'object')
);

CREATE INDEX IF NOT EXISTS subject_consent_optional_permissions_subject_idx
  ON public.subject_consent_optional_permissions(study_subject_id, permission_type);

CREATE TABLE IF NOT EXISTS public.subject_consent_withdrawals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  study_id uuid NOT NULL REFERENCES public.studies(id) ON DELETE CASCADE,
  study_subject_id uuid NOT NULL REFERENCES public.study_subjects(id) ON DELETE CASCADE,
  consent_version_id uuid REFERENCES public.subject_consent_versions(id) ON DELETE SET NULL,
  withdrawal_scope text NOT NULL,
  reason text NOT NULL,
  withdrawn_at timestamptz NOT NULL DEFAULT now(),
  acknowledgment_signature_request_id uuid REFERENCES public.operational_signature_requests(id) ON DELETE SET NULL,
  acknowledged_at timestamptz,
  locked_at timestamptz,
  locked_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT subject_consent_withdrawals_scope_check CHECK (
    withdrawal_scope IN ('all_study', 'study_treatment', 'optional_samples', 'future_use', 'hipaa', 'genetic')
  ),
  CONSTRAINT subject_consent_withdrawals_reason_required CHECK (length(trim(reason)) > 0),
  CONSTRAINT subject_consent_withdrawals_metadata_object CHECK (jsonb_typeof(metadata) = 'object')
);

CREATE INDEX IF NOT EXISTS subject_consent_withdrawals_subject_idx
  ON public.subject_consent_withdrawals(study_subject_id, withdrawn_at DESC);
CREATE INDEX IF NOT EXISTS subject_consent_withdrawals_sig_idx
  ON public.subject_consent_withdrawals(acknowledgment_signature_request_id);

CREATE TABLE IF NOT EXISTS public.subject_consent_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  study_id uuid NOT NULL REFERENCES public.studies(id) ON DELETE CASCADE,
  study_subject_id uuid NOT NULL REFERENCES public.study_subjects(id) ON DELETE CASCADE,
  action text NOT NULL,
  previous_status text,
  new_status text,
  reason text,
  consent_version_id uuid REFERENCES public.subject_consent_versions(id) ON DELETE SET NULL,
  consent_event_id uuid REFERENCES public.subject_consent_events(id) ON DELETE SET NULL,
  document_id uuid REFERENCES public.subject_consent_documents(id) ON DELETE SET NULL,
  signature_request_id uuid REFERENCES public.operational_signature_requests(id) ON DELETE SET NULL,
  actor_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  event_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT subject_consent_audit_payload_object CHECK (jsonb_typeof(event_payload) = 'object')
);

CREATE INDEX IF NOT EXISTS subject_consent_audit_subject_idx
  ON public.subject_consent_audit(study_subject_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS subject_consent_audit_version_idx
  ON public.subject_consent_audit(consent_version_id, occurred_at DESC);

CREATE OR REPLACE FUNCTION public.subject_consent_touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS subject_consent_versions_touch_updated_at
  ON public.subject_consent_versions;
CREATE TRIGGER subject_consent_versions_touch_updated_at
BEFORE UPDATE ON public.subject_consent_versions
FOR EACH ROW EXECUTE FUNCTION public.subject_consent_touch_updated_at();

CREATE OR REPLACE FUNCTION public.subject_consent_prevent_locked_version_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.locked_at IS NOT NULL
     AND to_jsonb(NEW) - 'updated_at' IS DISTINCT FROM to_jsonb(OLD) - 'updated_at' THEN
    RAISE EXCEPTION 'Locked consent versions cannot be mutated directly; create a consent event/amendment.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS subject_consent_versions_prevent_locked_update
  ON public.subject_consent_versions;
CREATE TRIGGER subject_consent_versions_prevent_locked_update
BEFORE UPDATE ON public.subject_consent_versions
FOR EACH ROW
WHEN (OLD.locked_at IS NOT NULL AND NEW.status NOT IN ('superseded', 'withdrawn', 'expired', 'invalidated'))
EXECUTE FUNCTION public.subject_consent_prevent_locked_version_mutation();

ALTER TABLE public.subject_consent_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subject_consent_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subject_consent_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subject_consent_optional_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subject_consent_withdrawals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subject_consent_audit ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS subject_consent_versions_select ON public.subject_consent_versions;
CREATE POLICY subject_consent_versions_select ON public.subject_consent_versions
  FOR SELECT USING (organization_id IN (SELECT public.user_organization_ids()) AND public.user_has_study_access(study_id));
DROP POLICY IF EXISTS subject_consent_versions_insert ON public.subject_consent_versions;
CREATE POLICY subject_consent_versions_insert ON public.subject_consent_versions
  FOR INSERT WITH CHECK (organization_id IN (SELECT public.user_organization_ids()) AND public.user_has_study_access(study_id));
DROP POLICY IF EXISTS subject_consent_versions_update ON public.subject_consent_versions;
CREATE POLICY subject_consent_versions_update ON public.subject_consent_versions
  FOR UPDATE USING (organization_id IN (SELECT public.user_organization_ids()) AND public.user_has_study_access(study_id));

DROP POLICY IF EXISTS subject_consent_events_select ON public.subject_consent_events;
CREATE POLICY subject_consent_events_select ON public.subject_consent_events
  FOR SELECT USING (organization_id IN (SELECT public.user_organization_ids()) AND public.user_has_study_access(study_id));
DROP POLICY IF EXISTS subject_consent_events_insert ON public.subject_consent_events;
CREATE POLICY subject_consent_events_insert ON public.subject_consent_events
  FOR INSERT WITH CHECK (organization_id IN (SELECT public.user_organization_ids()) AND public.user_has_study_access(study_id));

DROP POLICY IF EXISTS subject_consent_documents_select ON public.subject_consent_documents;
CREATE POLICY subject_consent_documents_select ON public.subject_consent_documents
  FOR SELECT USING (organization_id IN (SELECT public.user_organization_ids()) AND public.user_has_study_access(study_id));
DROP POLICY IF EXISTS subject_consent_documents_insert ON public.subject_consent_documents;
CREATE POLICY subject_consent_documents_insert ON public.subject_consent_documents
  FOR INSERT WITH CHECK (organization_id IN (SELECT public.user_organization_ids()) AND public.user_has_study_access(study_id));

DROP POLICY IF EXISTS subject_consent_optional_permissions_select ON public.subject_consent_optional_permissions;
CREATE POLICY subject_consent_optional_permissions_select ON public.subject_consent_optional_permissions
  FOR SELECT USING (organization_id IN (SELECT public.user_organization_ids()) AND public.user_has_study_access(study_id));
DROP POLICY IF EXISTS subject_consent_optional_permissions_insert ON public.subject_consent_optional_permissions;
CREATE POLICY subject_consent_optional_permissions_insert ON public.subject_consent_optional_permissions
  FOR INSERT WITH CHECK (organization_id IN (SELECT public.user_organization_ids()) AND public.user_has_study_access(study_id));
DROP POLICY IF EXISTS subject_consent_optional_permissions_update ON public.subject_consent_optional_permissions;
CREATE POLICY subject_consent_optional_permissions_update ON public.subject_consent_optional_permissions
  FOR UPDATE USING (organization_id IN (SELECT public.user_organization_ids()) AND public.user_has_study_access(study_id));

DROP POLICY IF EXISTS subject_consent_withdrawals_select ON public.subject_consent_withdrawals;
CREATE POLICY subject_consent_withdrawals_select ON public.subject_consent_withdrawals
  FOR SELECT USING (organization_id IN (SELECT public.user_organization_ids()) AND public.user_has_study_access(study_id));
DROP POLICY IF EXISTS subject_consent_withdrawals_insert ON public.subject_consent_withdrawals;
CREATE POLICY subject_consent_withdrawals_insert ON public.subject_consent_withdrawals
  FOR INSERT WITH CHECK (organization_id IN (SELECT public.user_organization_ids()) AND public.user_has_study_access(study_id));
DROP POLICY IF EXISTS subject_consent_withdrawals_update ON public.subject_consent_withdrawals;
CREATE POLICY subject_consent_withdrawals_update ON public.subject_consent_withdrawals
  FOR UPDATE USING (organization_id IN (SELECT public.user_organization_ids()) AND public.user_has_study_access(study_id));

DROP POLICY IF EXISTS subject_consent_audit_select ON public.subject_consent_audit;
CREATE POLICY subject_consent_audit_select ON public.subject_consent_audit
  FOR SELECT USING (organization_id IN (SELECT public.user_organization_ids()) AND public.user_has_study_access(study_id));
DROP POLICY IF EXISTS subject_consent_audit_insert ON public.subject_consent_audit;
CREATE POLICY subject_consent_audit_insert ON public.subject_consent_audit
  FOR INSERT WITH CHECK (organization_id IN (SELECT public.user_organization_ids()) AND public.user_has_study_access(study_id));

COMMENT ON TABLE public.subject_consent_versions IS
  'Subject Consent Runtime version state. Operational signatures live in operational_signature_requests/signatures.';
