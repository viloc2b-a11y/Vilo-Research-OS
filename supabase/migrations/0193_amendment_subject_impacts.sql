-- Amendment Subject Impacts
-- Tracks which subjects are impacted by a protocol amendment and the
-- reconsent / training-review resolution state for each.

CREATE TABLE IF NOT EXISTS amendment_subject_impacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  study_id UUID NOT NULL REFERENCES studies(id) ON DELETE CASCADE,
  protocol_version_id UUID NOT NULL,  -- references protocol_runtime_versions
  subject_id UUID NOT NULL REFERENCES study_subjects(id) ON DELETE CASCADE,
  requires_reconsent BOOLEAN NOT NULL DEFAULT false,
  reconsent_completed_at TIMESTAMPTZ,
  reconsent_completed_by UUID REFERENCES auth.users(id),
  requires_training_review BOOLEAN NOT NULL DEFAULT false,
  training_review_completed_at TIMESTAMPTZ,
  impact_reason TEXT,  -- human-readable summary of why this subject is impacted
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(protocol_version_id, subject_id)
);

CREATE INDEX amendment_subject_impacts_study_idx ON amendment_subject_impacts(study_id);
CREATE INDEX amendment_subject_impacts_org_idx ON amendment_subject_impacts(organization_id);
