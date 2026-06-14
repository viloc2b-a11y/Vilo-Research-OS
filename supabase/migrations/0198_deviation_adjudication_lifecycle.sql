-- Sprint H1/H3: Deviation adjudication lifecycle + governance signal extensions
-- Extends status from open|under_review|closed to full adjudication chain.
-- Adds superseded_by for H3 signal deduplication and reopened_at for reopen lifecycle.

ALTER TABLE public.protocol_deviations
  DROP CONSTRAINT IF EXISTS protocol_deviations_status_check;

ALTER TABLE public.protocol_deviations
  ADD CONSTRAINT protocol_deviations_status_check
  CHECK (status IN (
    'candidate',
    'pi_review',
    'confirmed',
    'capa_linked',
    'resolved',
    'open',
    'under_review',
    'closed'
  ));

ALTER TABLE public.protocol_deviations
  ADD COLUMN IF NOT EXISTS superseded_by uuid
    REFERENCES public.protocol_deviations(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS reopened_at timestamptz,
  ADD COLUMN IF NOT EXISTS adjudicated_by uuid
    REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS adjudicated_at timestamptz;

CREATE INDEX IF NOT EXISTS protocol_deviations_adjudication_idx
  ON public.protocol_deviations(study_id, status, created_at DESC);
