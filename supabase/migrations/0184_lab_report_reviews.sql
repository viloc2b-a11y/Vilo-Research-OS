-- Migration 0184: Lab Report Reviews
--
-- Medical review foundation for lab reports, supporting both:
--   A. Extractable PDFs with structured values in longitudinal_lab_results
--   B. Scanned PDFs requiring manual PI/Sub-I review without extraction
--
-- Reuses existing operational_signature_requests for PI/Sub-I signoff.
-- Does NOT require OCR success for medical review to proceed.
--
-- Status: LAB_REPORT_REVIEW_FOUNDATION

-- ---------------------------------------------------------------------------
-- 1. lab_report_reviews
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS lab_report_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  study_id uuid NOT NULL REFERENCES studies(id) ON DELETE CASCADE,
  subject_id uuid NOT NULL REFERENCES study_subjects(id) ON DELETE CASCADE,
  visit_id uuid REFERENCES visit_runtime_instances(id) ON DELETE SET NULL,

  -- Document linkage (source PDF must remain available)
  compliance_document_id uuid NOT NULL REFERENCES compliance_runtime_documents(id) ON DELETE CASCADE,
  longitudinal_result_id uuid REFERENCES longitudinal_lab_results(id) ON DELETE SET NULL,

  -- Report classification
  report_type text NOT NULL DEFAULT 'scanned'
    CHECK (report_type IN ('extractable', 'scanned')),
  review_scope text NOT NULL DEFAULT 'report'
    CHECK (review_scope IN ('report', 'test')),
  lab_test_code text,
  lab_test_name text,

  -- Review lifecycle
  review_status text NOT NULL DEFAULT 'pending_review'
    CHECK (review_status IN ('pending_review', 'under_review', 'reviewed', 'rejected')),
  reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  review_notes text,

  -- PI/Sub-I medical classification
  pi_classification text
    CHECK (pi_classification IN ('cs', 'ncs', 'follow_up_required')),
  pi_classified_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  pi_classified_at timestamptz,

  -- Signature linkage (reuses operational signatures)
  signature_request_id uuid REFERENCES operational_signature_requests(id) ON DELETE SET NULL,

  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_lab_report_reviews_org
  ON lab_report_reviews(organization_id);
CREATE INDEX IF NOT EXISTS idx_lab_report_reviews_study
  ON lab_report_reviews(study_id);
CREATE INDEX IF NOT EXISTS idx_lab_report_reviews_subject
  ON lab_report_reviews(subject_id);
CREATE INDEX IF NOT EXISTS idx_lab_report_reviews_document
  ON lab_report_reviews(compliance_document_id);
CREATE INDEX IF NOT EXISTS idx_lab_report_reviews_status
  ON lab_report_reviews(review_status);
CREATE INDEX IF NOT EXISTS idx_lab_report_reviews_pi_class
  ON lab_report_reviews(pi_classification);

-- ---------------------------------------------------------------------------
-- 2. RLS
-- ---------------------------------------------------------------------------

ALTER TABLE lab_report_reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS lab_report_reviews_select ON lab_report_reviews;
CREATE POLICY lab_report_reviews_select ON lab_report_reviews
  FOR SELECT USING (
    public.user_has_active_organization_membership(organization_id)
    AND public.user_has_study_access(study_id)
  );

DROP POLICY IF EXISTS lab_report_reviews_insert ON lab_report_reviews;
CREATE POLICY lab_report_reviews_insert ON lab_report_reviews
  FOR INSERT WITH CHECK (
    public.user_has_active_organization_membership(organization_id)
    AND public.user_has_study_access(study_id)
  );

DROP POLICY IF EXISTS lab_report_reviews_update ON lab_report_reviews;
CREATE POLICY lab_report_reviews_update ON lab_report_reviews
  FOR UPDATE USING (
    public.user_has_active_organization_membership(organization_id)
    AND public.user_has_study_access(study_id)
  );

-- ---------------------------------------------------------------------------
-- 3. Updated-at trigger
-- ---------------------------------------------------------------------------

DROP TRIGGER IF EXISTS lab_report_reviews_set_updated_at ON lab_report_reviews;
CREATE TRIGGER lab_report_reviews_set_updated_at
  BEFORE UPDATE ON lab_report_reviews
  FOR EACH ROW EXECUTE FUNCTION public.generic_set_updated_at();
