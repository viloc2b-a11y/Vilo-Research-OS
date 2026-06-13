-- Migration 0186: Safety Candidate Workflow
--
-- Adds candidate support to safety_events so lab-originated events can
-- be created unclassified and later converted to AE/SAE by medical review.
--
-- Changes:
--   event_type: NOT NULL → nullable (null = unclassified candidate)
--   event_status: adds 'candidate' to CHECK
--
-- Status: SAFETY_CANDIDATE_WORKFLOW

ALTER TABLE safety_events ALTER COLUMN event_type DROP NOT NULL;

ALTER TABLE safety_events DROP CONSTRAINT IF EXISTS safety_events_event_type_check;
ALTER TABLE safety_events ADD CONSTRAINT safety_events_event_type_check
  CHECK (event_type IS NULL OR event_type IN ('ae', 'sae'));

ALTER TABLE safety_events DROP CONSTRAINT IF EXISTS safety_events_event_status_check;
ALTER TABLE safety_events ADD CONSTRAINT safety_events_event_status_check
  CHECK (event_status IN ('candidate', 'open', 'under_review', 'closed'));
