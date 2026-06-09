-- Phase 1: Operational Signatures for Visit Closeout
-- This adds the signature_request_id foreign keys to visit_progress_notes.

ALTER TABLE public.visit_progress_notes
  ADD COLUMN IF NOT EXISTS coordinator_signature_request_id uuid REFERENCES public.operational_signature_requests(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS investigator_signature_request_id uuid REFERENCES public.operational_signature_requests(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_vpn_coord_sig_req ON public.visit_progress_notes(coordinator_signature_request_id);
CREATE INDEX IF NOT EXISTS idx_vpn_inv_sig_req ON public.visit_progress_notes(investigator_signature_request_id);
