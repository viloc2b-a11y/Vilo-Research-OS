-- Drop the existing constraint
ALTER TABLE public.studies DROP CONSTRAINT IF EXISTS studies_status_check;

-- Recreate it with 'archived' included
ALTER TABLE public.studies ADD CONSTRAINT studies_status_check CHECK (status IN ('draft', 'setup_in_progress', 'ready_for_activation', 'active', 'paused', 'closed', 'archived'));
