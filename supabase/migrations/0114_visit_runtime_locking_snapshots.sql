-- Phase 6: Visit runtime locking + immutable visit snapshots

CREATE TABLE IF NOT EXISTS visit_runtime_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  study_id uuid NOT NULL REFERENCES studies(id) ON DELETE CASCADE,
  subject_id uuid NOT NULL REFERENCES study_subjects(id) ON DELETE CASCADE,
  visit_instance_id uuid NOT NULL REFERENCES visit_runtime_instances(id) ON DELETE CASCADE,
  source_package_id uuid NOT NULL REFERENCES runtime_source_packages(id),
  snapshot_status text NOT NULL DEFAULT 'locked',
  snapshot_json jsonb NOT NULL,
  snapshot_hash text NOT NULL,
  locked_by uuid NOT NULL,
  locked_at timestamptz NOT NULL DEFAULT now(),
  lock_reason text NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT visit_runtime_snapshots_status_check CHECK (
    snapshot_status IN ('locked', 'superseded', 'voided')
  ),
  CONSTRAINT visit_runtime_snapshots_visit_instance_unique UNIQUE (visit_instance_id)
);

CREATE INDEX IF NOT EXISTS idx_visit_runtime_snapshots_org ON visit_runtime_snapshots(organization_id);
CREATE INDEX IF NOT EXISTS idx_visit_runtime_snapshots_study ON visit_runtime_snapshots(study_id);
CREATE INDEX IF NOT EXISTS idx_visit_runtime_snapshots_subject ON visit_runtime_snapshots(subject_id);
CREATE INDEX IF NOT EXISTS idx_visit_runtime_snapshots_visit ON visit_runtime_snapshots(visit_instance_id);
CREATE INDEX IF NOT EXISTS idx_visit_runtime_snapshots_package ON visit_runtime_snapshots(source_package_id);
CREATE INDEX IF NOT EXISTS idx_visit_runtime_snapshots_hash ON visit_runtime_snapshots(snapshot_hash);
CREATE INDEX IF NOT EXISTS idx_visit_runtime_snapshots_locked_at ON visit_runtime_snapshots(locked_at);

DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'visit_runtime_instances' AND column_name = 'lock_status') THEN
    ALTER TABLE visit_runtime_instances
      ADD COLUMN lock_status text NOT NULL DEFAULT 'unlocked',
      ADD COLUMN locked_snapshot_id uuid NULL,
      ADD COLUMN locked_at timestamptz NULL,
      ADD COLUMN locked_by uuid NULL;
  END IF;
END $$;

DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'visit_runtime_instances_lock_status_check') THEN
    ALTER TABLE visit_runtime_instances
      ADD CONSTRAINT visit_runtime_instances_lock_status_check CHECK (
        lock_status IN ('unlocked', 'locked', 'voided')
      );
  END IF;
END $$;

DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'visit_runtime_instances_locked_snapshot_fkey') THEN
    ALTER TABLE visit_runtime_instances
      ADD CONSTRAINT visit_runtime_instances_locked_snapshot_fkey
      FOREIGN KEY (locked_snapshot_id) REFERENCES visit_runtime_snapshots(id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_visit_runtime_instances_lock_status ON visit_runtime_instances(lock_status);
CREATE INDEX IF NOT EXISTS idx_visit_runtime_instances_locked_snapshot ON visit_runtime_instances(locked_snapshot_id);

ALTER TABLE visit_runtime_events
  DROP CONSTRAINT IF EXISTS visit_runtime_events_type_check;

ALTER TABLE visit_runtime_events
  ADD CONSTRAINT visit_runtime_events_type_check CHECK (
    event_type IN (
      'visit_instance_created',
      'visit_started',
      'visit_completed',
      'procedure_started',
      'procedure_completed',
      'procedure_skipped',
      'field_values_saved',
      'visit_locked',
      'visit_snapshot_created',
      'visit_lock_attempt_failed'
    )
  );

ALTER TABLE visit_runtime_snapshots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS visit_runtime_snapshots_select ON visit_runtime_snapshots;
CREATE POLICY visit_runtime_snapshots_select ON visit_runtime_snapshots
  FOR SELECT USING (
    public.user_has_active_organization_membership(organization_id)
    AND public.user_has_study_access(study_id)
  );

DROP POLICY IF EXISTS visit_runtime_snapshots_insert ON visit_runtime_snapshots;
CREATE POLICY visit_runtime_snapshots_insert ON visit_runtime_snapshots
  FOR INSERT WITH CHECK (
    public.user_has_active_organization_membership(organization_id)
    AND public.user_has_study_access(study_id)
  );
