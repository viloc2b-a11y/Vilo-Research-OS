-- Migration 0231: Regulatory Master Documents
-- Reusable master regulatory documents tied to personnel, organization, or facility.
-- Documents are metadata-first — file URLs/references can be added later.
-- Do NOT duplicate Document Center. This is the Regulatory Center's master document registry.

CREATE TABLE IF NOT EXISTS regulatory_master_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  owner_type text NOT NULL,
  owner_personnel_id uuid REFERENCES regulatory_personnel(id) ON DELETE SET NULL,
  document_type text NOT NULL,
  document_title text NOT NULL,
  document_reference text,
  version text,
  effective_date date,
  expiration_date date,
  status text NOT NULL DEFAULT 'active',
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT doc_owner_type_check CHECK (
    owner_type IN ('person', 'organization', 'facility')
  ),
  CONSTRAINT doc_type_check CHECK (
    document_type IN (
      'CV', 'Medical License', 'DEA', 'GCP', 'IATA', 'HSP',
      'Financial Disclosure', 'CLIA', 'CAP', 'Insurance', 'W9',
      'Business License', 'SOP', 'Lab Certification', 'Other'
    )
  ),
  CONSTRAINT doc_status_check CHECK (
    status IN ('active', 'inactive', 'needs_review', 'expired')
  )
);

-- =============================================================================
-- Indexes
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_reg_docs_org ON regulatory_master_documents(organization_id);
CREATE INDEX IF NOT EXISTS idx_reg_docs_type ON regulatory_master_documents(document_type);
CREATE INDEX IF NOT EXISTS idx_reg_docs_status ON regulatory_master_documents(status);
CREATE INDEX IF NOT EXISTS idx_reg_docs_owner ON regulatory_master_documents(owner_personnel_id);
CREATE INDEX IF NOT EXISTS idx_reg_docs_expiration ON regulatory_master_documents(expiration_date);

-- =============================================================================
-- Updated-at trigger
-- =============================================================================

DROP TRIGGER IF EXISTS trg_reg_docs_updated_at ON regulatory_master_documents;
CREATE TRIGGER trg_reg_docs_updated_at
  BEFORE UPDATE ON regulatory_master_documents
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- =============================================================================
-- RLS — org-scoped using standard membership pattern
-- =============================================================================

ALTER TABLE regulatory_master_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS reg_docs_select ON regulatory_master_documents;
CREATE POLICY reg_docs_select ON regulatory_master_documents
  FOR SELECT
  USING (public.user_has_active_organization_membership(organization_id));

DROP POLICY IF EXISTS reg_docs_insert ON regulatory_master_documents;
CREATE POLICY reg_docs_insert ON regulatory_master_documents
  FOR INSERT
  WITH CHECK (public.user_has_active_organization_membership(organization_id));

DROP POLICY IF EXISTS reg_docs_update ON regulatory_master_documents;
CREATE POLICY reg_docs_update ON regulatory_master_documents
  FOR UPDATE
  USING (public.user_has_active_organization_membership(organization_id));

DROP POLICY IF EXISTS reg_docs_delete ON regulatory_master_documents;
CREATE POLICY reg_docs_delete ON regulatory_master_documents
  FOR DELETE
  USING (public.user_has_active_organization_membership(organization_id));

-- =============================================================================
-- Grants
-- =============================================================================

GRANT SELECT, INSERT, UPDATE, DELETE ON regulatory_master_documents TO authenticated;
