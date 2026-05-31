-- Migration 0145: Add operational signature request to procedure executions
ALTER TABLE "public"."procedure_executions" 
  ADD COLUMN IF NOT EXISTS "signature_request_id" uuid REFERENCES "public"."operational_signature_requests"("id") ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS "idx_procedure_executions_sig_req" ON "public"."procedure_executions"("signature_request_id");
