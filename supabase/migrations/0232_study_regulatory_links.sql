-- Migration 0232: Study Regulatory Links
-- Links studies to central regulatory personnel and master documents.
-- No file duplication — links only reference regulatory_personnel and regulatory_master_documents.
-- Study-specific regulatory execution is separate.

CREATE TABLE IF NOT EXISTS study_regulatory_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  study_id uuid NOT NULL REFERENCES studies(id) ON DELETE CASCADE,
  link_type text NOT NULL,
  personnel_id uuid REFERENCES regulatory_personnel(id) ON DELETE SET NULL,
  master_document_id uuid REFERENCES regulatory_master_documents(id) ON DELETE SET NULL,
  required boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'active',
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT link_type_check CHECK (link_type IN ('personnel', 'document')),
  CONSTRAINT link_status_check CHECK (status IN ('active', 'inactive', 'needs_review')),
  CONSTRAINT link_has_target CHECK (
    (link_type = 'personnel' AND personnel_id IS NOT NULL AND master_document_id IS NULL)
    OR
    (link_type = 'document' AND master_document_id IS NOT NULL AND personnel_id IS NULL)
  )
);

-- =============================================================================
-- Unique constraints: one active link per study/personnel, per study/document
-- =============================================================================

CREATE UNIQUE INDEX IF NOT EXISTS idx_study_reg_links_personnel
  ON study_regulatory_links(study_id, personnel_id) WHERE link_type = 'personnel' AND status = 'active';

CREATE UNIQUE INDEX IF NOT EXISTS idx_study_reg_links_document
  ON study_regulatory_links(study_id, master_document_id) WHERE link_type = 'document' AND status = 'active';

-- =============================================================================
-- Indexes
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_study_reg_links_study ON study_regulatory_links(study_id);
CREATE INDEX IF NOT EXISTS idx_study_reg_links_type ON study_regulatory_links(link_type);
CREATE INDEX IF NOT EXISTS idx_study_reg_links_personnel_id ON study_regulatory_links(personnel_id);
CREATE INDEX IF NOT EXISTS idx_study_reg_links_doc_id ON study_regulatory_links(master_document_id);

-- =============================================================================
-- Updated-at trigger
-- =============================================================================

DROP TRIGGER IF EXISTS trg_study_reg_links_updated_at ON study_regulatory_links;
CREATE TRIGGER trg_study_reg_links_updated_at
  BEFORE UPDATE ON study_regulatory_links
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- =============================================================================
-- RLS — study-scoped using standard membership pattern via studies table
-- =============================================================================

ALTER TABLE study_regulatory_links ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS study_reg_links_select ON study_regulatory_links;
CREATE POLICY study_reg_links_select ON study_regulatory_links
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM studies s
      WHERE s.id = study_regulatory_links.study_id
        AND public.user_has_active_organization_membership(s.organization_id)
    )
  );

DROP POLICY IF EXISTS study_reg_links_insert ON study_regulatory_links;
CREATE POLICY study_reg_links_insert ON study_regulatory_links
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM studies s
      WHERE s.id = study_regulatory_links.study_id
        AND public.user_has_active_organization_membership(s.organization_id)
    )
  );

DROP POLICY IF EXISTS study_reg_links_update ON study_regulatory_links;
CREATE POLICY study_reg_links_update ON study_regulatory_links
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM studies s
      WHERE s.id = study_regulatory_links.study_id
        AND public.user_has_active_organization_membership(s.organization_id)
    )
  );

DROP POLICY IF EXISTS study_reg_links_delete ON study_regulatory_links;
CREATE POLICY study_reg_links_delete ON study_regulatory_links
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM studies s
      WHERE s.id = study_regulatory_links.study_id
        AND public.user_has_active_organization_membership(s.organization_id)
    )
  );

-- =============================================================================
-- Grants
-- =============================================================================

GRANT SELECT, INSERT, UPDATE, DELETE ON study_regulatory_links TO authenticated;
