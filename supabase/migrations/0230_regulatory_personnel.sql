-- Migration 0230: Regulatory Personnel Registry
-- Reusable organizational staff/investigator registry for the Regulatory Center.
-- Not study-specific — personnel are shared across studies via future study_regulatory_links.
-- Not a duplicate of organization_members — this tracks regulatory credentials, not auth/RLS membership.

CREATE TABLE IF NOT EXISTS regulatory_personnel (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  role text NOT NULL,
  email text,
  phone text,
  npi text,
  license_number text,
  dea_number text,
  status text NOT NULL DEFAULT 'active',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT regulatory_personnel_role_check CHECK (
    role IN ('PI', 'Sub-I', 'Coordinator', 'Regulatory Specialist', 'Pharmacist', 'Lab Director', 'Other')
  ),
  CONSTRAINT regulatory_personnel_status_check CHECK (
    status IN ('active', 'inactive', 'needs_review')
  )
);

-- =============================================================================
-- Indexes
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_reg_personnel_org ON regulatory_personnel(organization_id);
CREATE INDEX IF NOT EXISTS idx_reg_personnel_role ON regulatory_personnel(role);
CREATE INDEX IF NOT EXISTS idx_reg_personnel_status ON regulatory_personnel(status);

-- =============================================================================
-- Updated-at trigger
-- =============================================================================

DROP TRIGGER IF EXISTS trg_regulatory_personnel_updated_at ON regulatory_personnel;
CREATE TRIGGER trg_regulatory_personnel_updated_at
  BEFORE UPDATE ON regulatory_personnel
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- =============================================================================
-- RLS — org-scoped using standard membership pattern
-- =============================================================================

ALTER TABLE regulatory_personnel ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS regulatory_personnel_select ON regulatory_personnel;
CREATE POLICY regulatory_personnel_select ON regulatory_personnel
  FOR SELECT
  USING (public.user_has_active_organization_membership(organization_id));

DROP POLICY IF EXISTS regulatory_personnel_insert ON regulatory_personnel;
CREATE POLICY regulatory_personnel_insert ON regulatory_personnel
  FOR INSERT
  WITH CHECK (public.user_has_active_organization_membership(organization_id));

DROP POLICY IF EXISTS regulatory_personnel_update ON regulatory_personnel;
CREATE POLICY regulatory_personnel_update ON regulatory_personnel
  FOR UPDATE
  USING (public.user_has_active_organization_membership(organization_id));

DROP POLICY IF EXISTS regulatory_personnel_delete ON regulatory_personnel;
CREATE POLICY regulatory_personnel_delete ON regulatory_personnel
  FOR DELETE
  USING (public.user_has_active_organization_membership(organization_id));

-- =============================================================================
-- Grants
-- =============================================================================

GRANT SELECT, INSERT, UPDATE, DELETE ON regulatory_personnel TO authenticated;
