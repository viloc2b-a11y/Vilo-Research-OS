-- Migration 0192: Safety Event Lifecycle
--
-- Adds lifecycle columns to safety_events for regulatory reporting, sponsor
-- notification, follow-up tracking, and clinical outcome capture.
-- Also creates safety_event_tasks for auto-generated compliance task management.
--
-- Status: SAFETY_INTELLIGENCE_LIFECYCLE

-- ---------------------------------------------------------------------------
-- 1. Lifecycle columns on safety_events
-- ---------------------------------------------------------------------------

ALTER TABLE safety_events
  ADD COLUMN IF NOT EXISTS reporting_deadline_date DATE,
  ADD COLUMN IF NOT EXISTS sponsor_notified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS sponsor_notification_required BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS follow_up_due_date DATE,
  ADD COLUMN IF NOT EXISTS follow_up_completed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS outcome TEXT CHECK (outcome IN ('recovered','recovering','not_recovered','fatal','unknown','not_applicable')),
  ADD COLUMN IF NOT EXISTS resolution_description TEXT,
  ADD COLUMN IF NOT EXISTS regulatory_reporting_required BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS expedited_report_submitted_at TIMESTAMPTZ;

-- ---------------------------------------------------------------------------
-- 2. safety_event_tasks — auto-generated compliance task management
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS safety_event_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  safety_event_id UUID NOT NULL REFERENCES safety_events(id) ON DELETE CASCADE,
  task_type TEXT NOT NULL CHECK (task_type IN (
    '15_day_report',
    'followup_required',
    'sponsor_notification',
    'irb_notification',
    'resolution_documentation',
    'closeout'
  )),
  due_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'completed', 'overdue', 'waived')),
  completed_at TIMESTAMPTZ,
  completed_by UUID REFERENCES auth.users(id),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS safety_event_tasks_event_idx
  ON safety_event_tasks(safety_event_id);

CREATE INDEX IF NOT EXISTS safety_event_tasks_status_idx
  ON safety_event_tasks(organization_id, status, due_date);

-- ---------------------------------------------------------------------------
-- 3. RLS for safety_event_tasks
-- ---------------------------------------------------------------------------

ALTER TABLE safety_event_tasks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS safety_event_tasks_select ON safety_event_tasks;
CREATE POLICY safety_event_tasks_select ON safety_event_tasks
  FOR SELECT USING (
    public.user_has_active_organization_membership(organization_id)
  );

DROP POLICY IF EXISTS safety_event_tasks_insert ON safety_event_tasks;
CREATE POLICY safety_event_tasks_insert ON safety_event_tasks
  FOR INSERT WITH CHECK (
    public.user_has_active_organization_membership(organization_id)
  );

DROP POLICY IF EXISTS safety_event_tasks_update ON safety_event_tasks;
CREATE POLICY safety_event_tasks_update ON safety_event_tasks
  FOR UPDATE USING (
    public.user_has_active_organization_membership(organization_id)
  );
