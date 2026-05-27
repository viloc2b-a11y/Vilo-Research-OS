-- Phase 7: Operational review + query runtime on locked visit snapshots

CREATE TABLE visit_snapshot_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  study_id uuid NOT NULL REFERENCES studies(id) ON DELETE CASCADE,
  subject_id uuid NOT NULL REFERENCES study_subjects(id) ON DELETE CASCADE,
  snapshot_id uuid NOT NULL REFERENCES visit_runtime_snapshots(id),
  visit_instance_id uuid NOT NULL,
  review_type text NOT NULL DEFAULT 'operational',
  review_status text NOT NULL DEFAULT 'not_started',
  reviewer_role text NULL,
  reviewer_user_id uuid NULL,
  started_at timestamptz NULL,
  completed_at timestamptz NULL,
  completed_by uuid NULL,
  review_notes text NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT visit_snapshot_reviews_type_check CHECK (
    review_type IN ('operational', 'pi_review', 'quality_review', 'monitor_prep')
  ),
  CONSTRAINT visit_snapshot_reviews_status_check CHECK (
    review_status IN ('not_started', 'in_review', 'queries_open', 'completed', 'cancelled')
  ),
  CONSTRAINT visit_snapshot_reviews_snapshot_type_unique UNIQUE (snapshot_id, review_type)
);

CREATE INDEX idx_visit_snapshot_reviews_org ON visit_snapshot_reviews(organization_id);
CREATE INDEX idx_visit_snapshot_reviews_study ON visit_snapshot_reviews(study_id);
CREATE INDEX idx_visit_snapshot_reviews_subject ON visit_snapshot_reviews(subject_id);
CREATE INDEX idx_visit_snapshot_reviews_snapshot ON visit_snapshot_reviews(snapshot_id);
CREATE INDEX idx_visit_snapshot_reviews_visit ON visit_snapshot_reviews(visit_instance_id);
CREATE INDEX idx_visit_snapshot_reviews_status ON visit_snapshot_reviews(review_status);
CREATE INDEX idx_visit_snapshot_reviews_type ON visit_snapshot_reviews(review_type);

CREATE TABLE visit_snapshot_queries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  study_id uuid NOT NULL REFERENCES studies(id) ON DELETE CASCADE,
  subject_id uuid NOT NULL REFERENCES study_subjects(id) ON DELETE CASCADE,
  snapshot_id uuid NOT NULL REFERENCES visit_runtime_snapshots(id),
  review_id uuid NULL REFERENCES visit_snapshot_reviews(id),
  query_scope text NOT NULL,
  procedure_instance_id uuid NULL,
  procedure_code text NULL,
  field_id text NULL,
  field_label text NULL,
  query_text text NOT NULL,
  query_status text NOT NULL DEFAULT 'open',
  priority text NOT NULL DEFAULT 'normal',
  assigned_role text NULL DEFAULT 'crc',
  assigned_user_id uuid NULL,
  opened_by uuid NOT NULL,
  opened_at timestamptz NOT NULL DEFAULT now(),
  resolved_by uuid NULL,
  resolved_at timestamptz NULL,
  resolution_text text NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT visit_snapshot_queries_scope_check CHECK (
    query_scope IN ('visit', 'procedure', 'field', 'source_section')
  ),
  CONSTRAINT visit_snapshot_queries_status_check CHECK (
    query_status IN ('open', 'answered', 'resolved', 'cancelled')
  ),
  CONSTRAINT visit_snapshot_queries_priority_check CHECK (
    priority IN ('low', 'normal', 'high', 'critical')
  ),
  CONSTRAINT visit_snapshot_queries_text_check CHECK (query_text <> '')
);

CREATE INDEX idx_visit_snapshot_queries_org ON visit_snapshot_queries(organization_id);
CREATE INDEX idx_visit_snapshot_queries_study ON visit_snapshot_queries(study_id);
CREATE INDEX idx_visit_snapshot_queries_subject ON visit_snapshot_queries(subject_id);
CREATE INDEX idx_visit_snapshot_queries_snapshot ON visit_snapshot_queries(snapshot_id);
CREATE INDEX idx_visit_snapshot_queries_review ON visit_snapshot_queries(review_id);
CREATE INDEX idx_visit_snapshot_queries_scope ON visit_snapshot_queries(query_scope);
CREATE INDEX idx_visit_snapshot_queries_status ON visit_snapshot_queries(query_status);
CREATE INDEX idx_visit_snapshot_queries_priority ON visit_snapshot_queries(priority);
CREATE INDEX idx_visit_snapshot_queries_assigned_user ON visit_snapshot_queries(assigned_user_id);
CREATE INDEX idx_visit_snapshot_queries_assigned_role ON visit_snapshot_queries(assigned_role);
CREATE INDEX idx_visit_snapshot_queries_opened_at ON visit_snapshot_queries(opened_at);

CREATE TABLE visit_snapshot_query_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  study_id uuid NOT NULL REFERENCES studies(id) ON DELETE CASCADE,
  subject_id uuid NOT NULL REFERENCES study_subjects(id) ON DELETE CASCADE,
  snapshot_id uuid NOT NULL REFERENCES visit_runtime_snapshots(id),
  query_id uuid NOT NULL REFERENCES visit_snapshot_queries(id),
  event_type text NOT NULL,
  actor_id uuid NULL,
  event_timestamp timestamptz NOT NULL DEFAULT now(),
  event_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  state_hash text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,

  CONSTRAINT visit_snapshot_query_events_type_check CHECK (
    event_type IN (
      'query_opened',
      'query_answered',
      'query_resolved',
      'query_cancelled',
      'query_reassigned',
      'review_started',
      'review_completed'
    )
  )
);

CREATE INDEX idx_visit_snapshot_query_events_org ON visit_snapshot_query_events(organization_id);
CREATE INDEX idx_visit_snapshot_query_events_study ON visit_snapshot_query_events(study_id);
CREATE INDEX idx_visit_snapshot_query_events_subject ON visit_snapshot_query_events(subject_id);
CREATE INDEX idx_visit_snapshot_query_events_snapshot ON visit_snapshot_query_events(snapshot_id);
CREATE INDEX idx_visit_snapshot_query_events_query ON visit_snapshot_query_events(query_id);
CREATE INDEX idx_visit_snapshot_query_events_type ON visit_snapshot_query_events(event_type);
CREATE INDEX idx_visit_snapshot_query_events_timestamp ON visit_snapshot_query_events(event_timestamp);

CREATE OR REPLACE FUNCTION public.visit_snapshot_query_events_deny_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'visit_snapshot_query_events is append-only';
END;
$$;

DROP TRIGGER IF EXISTS visit_snapshot_query_events_deny_update
  ON public.visit_snapshot_query_events;
CREATE TRIGGER visit_snapshot_query_events_deny_update
BEFORE UPDATE OR DELETE ON public.visit_snapshot_query_events
FOR EACH ROW EXECUTE FUNCTION public.visit_snapshot_query_events_deny_mutation();

ALTER TABLE visit_snapshot_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE visit_snapshot_queries ENABLE ROW LEVEL SECURITY;
ALTER TABLE visit_snapshot_query_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY visit_snapshot_reviews_select ON visit_snapshot_reviews
  FOR SELECT USING (
    public.user_has_active_organization_membership(organization_id)
    AND public.user_has_study_access(study_id)
  );

CREATE POLICY visit_snapshot_reviews_insert ON visit_snapshot_reviews
  FOR INSERT WITH CHECK (
    public.user_has_active_organization_membership(organization_id)
    AND public.user_has_study_access(study_id)
  );

CREATE POLICY visit_snapshot_reviews_update ON visit_snapshot_reviews
  FOR UPDATE USING (
    public.user_has_active_organization_membership(organization_id)
    AND public.user_has_study_access(study_id)
  );

CREATE POLICY visit_snapshot_queries_select ON visit_snapshot_queries
  FOR SELECT USING (
    public.user_has_active_organization_membership(organization_id)
    AND public.user_has_study_access(study_id)
  );

CREATE POLICY visit_snapshot_queries_insert ON visit_snapshot_queries
  FOR INSERT WITH CHECK (
    public.user_has_active_organization_membership(organization_id)
    AND public.user_has_study_access(study_id)
  );

CREATE POLICY visit_snapshot_queries_update ON visit_snapshot_queries
  FOR UPDATE USING (
    public.user_has_active_organization_membership(organization_id)
    AND public.user_has_study_access(study_id)
  );

CREATE POLICY visit_snapshot_query_events_select ON visit_snapshot_query_events
  FOR SELECT USING (
    public.user_has_active_organization_membership(organization_id)
    AND public.user_has_study_access(study_id)
  );

CREATE POLICY visit_snapshot_query_events_insert ON visit_snapshot_query_events
  FOR INSERT WITH CHECK (
    public.user_has_active_organization_membership(organization_id)
    AND public.user_has_study_access(study_id)
  );
