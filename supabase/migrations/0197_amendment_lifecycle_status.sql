-- Sprint G6: Amendment lifecycle status tracking
-- One record per protocol version; tracks the amendment through its pre-activation lifecycle.

CREATE TABLE IF NOT EXISTS public.study_amendment_statuses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  study_id UUID NOT NULL REFERENCES public.studies(id) ON DELETE CASCADE,
  protocol_version_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'submitted', 'irb_review', 'approved', 'activated')),
  submitted_at TIMESTAMPTZ,
  irb_review_at TIMESTAMPTZ,
  approved_at TIMESTAMPTZ,
  activated_at TIMESTAMPTZ,
  activated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT study_amendment_statuses_version_unique UNIQUE (protocol_version_id)
);

CREATE INDEX study_amendment_statuses_study_idx
  ON public.study_amendment_statuses(study_id, status);
