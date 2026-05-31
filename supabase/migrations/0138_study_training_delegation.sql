-- Phase 18: Protocol Training Log & Protocol Delegation Log

-- 1. Dynamic Duty Library (Organization scope, used by studies)
CREATE TABLE public.study_delegation_duties (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  duty_code text NOT NULL,
  duty_label text NOT NULL,
  duty_category text,
  requires_training boolean NOT NULL DEFAULT false,
  requires_license boolean NOT NULL DEFAULT false,
  requires_pi_approval boolean NOT NULL DEFAULT true,
  blinded_allowed boolean NOT NULL DEFAULT true,
  unblinded_required boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT duty_code_org_unique UNIQUE (organization_id, duty_code)
);

CREATE INDEX idx_study_delegation_duties_org ON public.study_delegation_duties(organization_id);

-- 2. Protocol Delegation Log
CREATE TABLE public.study_delegation_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  study_id uuid NOT NULL REFERENCES public.studies(id) ON DELETE CASCADE,
  staff_user_id uuid NOT NULL REFERENCES auth.users(id),
  staff_role text NOT NULL,
  pi_delegator_id uuid NOT NULL REFERENCES auth.users(id),
  delegation_start_date date NOT NULL,
  delegation_stop_date date,
  is_ongoing boolean NOT NULL DEFAULT true,
  delegation_status text NOT NULL DEFAULT 'Pending Staff Signature',
  
  -- Signatures
  staff_signature_required boolean NOT NULL DEFAULT true,
  staff_signed_at timestamptz,
  pi_signature_required boolean NOT NULL DEFAULT true,
  pi_signed_at timestamptz,
  
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  
  CONSTRAINT delegation_log_status_check CHECK (
    delegation_status IN ('Pending Staff Signature', 'Pending PI Signature', 'Active', 'Inactive', 'Expired', 'Revoked')
  ),
  CONSTRAINT delegation_ongoing_check CHECK (
    (is_ongoing = true AND delegation_stop_date IS NULL) OR
    (is_ongoing = false AND delegation_stop_date IS NOT NULL)
  )
);

CREATE INDEX idx_study_delegation_log_study ON public.study_delegation_log(study_id);
CREATE INDEX idx_study_delegation_log_staff ON public.study_delegation_log(staff_user_id);

CREATE TABLE public.study_delegation_log_duties (
  delegation_log_id uuid NOT NULL REFERENCES public.study_delegation_log(id) ON DELETE CASCADE,
  duty_id uuid NOT NULL REFERENCES public.study_delegation_duties(id),
  PRIMARY KEY (delegation_log_id, duty_id)
);

-- 3. Protocol-Related Staff Training Log
CREATE TABLE public.study_protocol_trainings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  study_id uuid NOT NULL REFERENCES public.studies(id) ON DELETE CASCADE,
  training_type text NOT NULL,
  training_title text NOT NULL,
  training_description text,
  related_document_id uuid, -- Reference to compliance_runtime_documents
  related_protocol_version text,
  training_method text NOT NULL,
  trainer_user_id uuid REFERENCES auth.users(id),
  effective_date date,
  expiration_date date,
  created_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  
  CONSTRAINT training_method_check CHECK (
    training_method IN ('SIV', 'In-person', 'Remote', 'Self-review', 'Recorded training', 'Sponsor portal', 'Other')
  )
);

CREATE INDEX idx_study_protocol_trainings_study ON public.study_protocol_trainings(study_id);

CREATE TABLE public.study_protocol_training_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  training_id uuid NOT NULL REFERENCES public.study_protocol_trainings(id) ON DELETE CASCADE,
  trainee_user_id uuid NOT NULL REFERENCES auth.users(id),
  trainee_role text NOT NULL,
  training_status text NOT NULL DEFAULT 'Assigned',
  training_date date,
  
  -- Signatures
  trainee_signature_required boolean NOT NULL DEFAULT true,
  trainee_signature text,
  trainee_signed_at timestamptz,
  
  trainer_signature_required boolean NOT NULL DEFAULT false,
  trainer_signature text,
  trainer_signed_at timestamptz,
  
  pi_acknowledgment_required boolean NOT NULL DEFAULT false,
  pi_signature text,
  pi_signed_at timestamptz,
  
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  
  CONSTRAINT training_status_check CHECK (
    training_status IN ('Assigned', 'Completed', 'Overdue', 'Waived', 'Re-training Required')
  ),
  CONSTRAINT unique_training_assignment UNIQUE (training_id, trainee_user_id)
);

CREATE INDEX idx_training_assignments_trainee ON public.study_protocol_training_assignments(trainee_user_id);
CREATE INDEX idx_training_assignments_training ON public.study_protocol_training_assignments(training_id);

-- RLS
ALTER TABLE public.study_delegation_duties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.study_delegation_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.study_delegation_log_duties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.study_protocol_trainings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.study_protocol_training_assignments ENABLE ROW LEVEL SECURITY;

-- Read policies for organization members
CREATE POLICY duty_select ON public.study_delegation_duties FOR SELECT USING (organization_id IN (SELECT public.user_organization_ids()));
CREATE POLICY del_log_select ON public.study_delegation_log FOR SELECT USING (organization_id IN (SELECT public.user_organization_ids()) AND public.user_has_study_access(study_id));
CREATE POLICY del_duty_select ON public.study_delegation_log_duties FOR SELECT USING (EXISTS (SELECT 1 FROM public.study_delegation_log l WHERE l.id = delegation_log_id AND l.organization_id IN (SELECT public.user_organization_ids()) AND public.user_has_study_access(l.study_id)));
CREATE POLICY ptrain_select ON public.study_protocol_trainings FOR SELECT USING (organization_id IN (SELECT public.user_organization_ids()) AND public.user_has_study_access(study_id));
CREATE POLICY passign_select ON public.study_protocol_training_assignments FOR SELECT USING (organization_id IN (SELECT public.user_organization_ids()) AND EXISTS (SELECT 1 FROM public.study_protocol_trainings t WHERE t.id = training_id AND public.user_has_study_access(t.study_id)));

-- We bypass strict INSERT/UPDATE RLS here for brevity, assume application logic enforcement via server actions.
