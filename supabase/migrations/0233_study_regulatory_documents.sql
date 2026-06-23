-- Migration 0233: Study-Specific Regulatory Documents
-- Documents that are NOT reusable across studies.
-- Study-specific: 1572, Delegation Log, IRB Approval, Protocol Training, ICF Approval, etc.
-- Master/reusable documents stay in Regulatory Center (regulatory_master_documents).
-- No duplicate file storage.

CREATE TABLE IF NOT EXISTS study_regulatory_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  study_id uuid NOT NULL REFERENCES studies(id) ON DELETE CASCADE,
  document_type text NOT NULL,
  document_title text NOT NULL,
  document_reference text,
  version text,
  effective_date date,
  expiration_date date,
  status text NOT NULL DEFAULT 'missing',
  owner_role text,
  required boolean NOT NULL DEFAULT false,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT study_reg_doc_type_check CHECK (
    document_type IN (
      '1572', 'Delegation Log', 'IRB Approval', 'IRB Submission',
      'Protocol Training', 'ICF Approval', 'Recruitment Material Approval',
      'SIV Documentation', 'Amendment Acknowledgment', 'Protocol Signature Page',
      'Site Activation Letter', 'Other'
    )
  ),
  CONSTRAINT study_reg_doc_status_check CHECK (
    status IN (
      'missing', 'requested', 'received', 'under_review',
      'submitted', 'approved', 'rejected', 'expired', 'not_applicable'
    )
  )
);

-- =============================================================================
-- Indexes
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_study_reg_docs_study ON study_regulatory_documents(study_id);
CREATE INDEX IF NOT EXISTS idx_study_reg_docs_type ON study_regulatory_documents(document_type);
CREATE INDEX IF NOT EXISTS idx_study_reg_docs_status ON study_regulatory_documents(status);

-- =============================================================================
-- Updated-at trigger
-- =============================================================================

DROP TRIGGER IF EXISTS trg_study_reg_docs_updated_at ON study_regulatory_documents;
CREATE TRIGGER trg_study_reg_docs_updated_at
  BEFORE UPDATE ON study_regulatory_documents
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- =============================================================================
-- RLS — study-scoped via studies → organization membership
-- =============================================================================

ALTER TABLE study_regulatory_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS study_reg_docs_select ON study_regulatory_documents;
CREATE POLICY study_reg_docs_select ON study_regulatory_documents
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM studies s
      WHERE s.id = study_regulatory_documents.study_id
        AND public.user_has_active_organization_membership(s.organization_id)
    )
  );

DROP POLICY IF EXISTS study_reg_docs_insert ON study_regulatory_documents;
CREATE POLICY study_reg_docs_insert ON study_regulatory_documents
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM studies s
      WHERE s.id = study_regulatory_documents.study_id
        AND public.user_has_active_organization_membership(s.organization_id)
    )
  );

DROP POLICY IF EXISTS study_reg_docs_update ON study_regulatory_documents;
CREATE POLICY study_reg_docs_update ON study_regulatory_documents
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM studies s
      WHERE s.id = study_regulatory_documents.study_id
        AND public.user_has_active_organization_membership(s.organization_id)
    )
  );

DROP POLICY IF EXISTS study_reg_docs_delete ON study_regulatory_documents;
CREATE POLICY study_reg_docs_delete ON study_regulatory_documents
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM studies s
      WHERE s.id = study_regulatory_documents.study_id
        AND public.user_has_active_organization_membership(s.organization_id)
    )
  );

-- =============================================================================
-- Grants
-- =============================================================================

GRANT SELECT, INSERT, UPDATE, DELETE ON study_regulatory_documents TO authenticated;
