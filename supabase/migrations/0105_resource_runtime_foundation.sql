CREATE EXTENSION IF NOT EXISTS btree_gist;

CREATE TABLE IF NOT EXISTS runtime_resources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  code text NOT NULL,
  name text NOT NULL,
  status text NOT NULL DEFAULT 'ACTIVE',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(organization_id, code)
);

CREATE TABLE IF NOT EXISTS runtime_resource_blocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  study_id uuid REFERENCES studies(id),
  resource_id uuid NOT NULL REFERENCES runtime_resources(id),
  start_datetime timestamptz NOT NULL,
  end_datetime timestamptz NOT NULL,
  all_day boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'ACTIVE',
  cancelled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'no_overlapping_active_blocks'
  ) THEN
    ALTER TABLE runtime_resource_blocks ADD CONSTRAINT no_overlapping_active_blocks EXCLUDE USING gist (
      resource_id WITH =,
      tstzrange(start_datetime, end_datetime) WITH &&
    ) WHERE (status = 'ACTIVE');
  END IF;
END $$;

-- RLS for runtime_resources
ALTER TABLE runtime_resources ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view runtime_resources in their orgs" ON runtime_resources;
CREATE POLICY "Users can view runtime_resources in their orgs" ON runtime_resources
  FOR SELECT
  USING (
    organization_id IN (SELECT public.user_organization_ids())
  );

DROP POLICY IF EXISTS "Users can insert runtime_resources in their orgs" ON runtime_resources;
CREATE POLICY "Users can insert runtime_resources in their orgs" ON runtime_resources
  FOR INSERT
  WITH CHECK (
    organization_id IN (SELECT public.user_organization_ids())
  );

-- RLS for runtime_resource_blocks
ALTER TABLE runtime_resource_blocks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view runtime_resource_blocks in their orgs" ON runtime_resource_blocks;
CREATE POLICY "Users can view runtime_resource_blocks in their orgs" ON runtime_resource_blocks
  FOR SELECT
  USING (
    organization_id IN (SELECT public.user_organization_ids())
  );

DROP POLICY IF EXISTS "Users can insert runtime_resource_blocks in their orgs" ON runtime_resource_blocks;
CREATE POLICY "Users can insert runtime_resource_blocks in their orgs" ON runtime_resource_blocks
  FOR INSERT
  WITH CHECK (
    organization_id IN (SELECT public.user_organization_ids())
  );

DROP POLICY IF EXISTS "Users can update runtime_resource_blocks in their orgs" ON runtime_resource_blocks;
CREATE POLICY "Users can update runtime_resource_blocks in their orgs" ON runtime_resource_blocks
  FOR UPDATE
  USING (
    organization_id IN (SELECT public.user_organization_ids())
  );
