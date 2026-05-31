-- Consolidate PI Review with Operational Signatures

ALTER TABLE public.subject_document_review_requests
  ADD COLUMN IF NOT EXISTS signature_request_id uuid NULL REFERENCES public.operational_signature_requests(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_subj_doc_review_req_sig 
  ON public.subject_document_review_requests(signature_request_id);
