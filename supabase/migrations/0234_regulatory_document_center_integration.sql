-- Migration 0234: Regulatory Master Documents — Document Center Integration
-- Adds optional FK to compliance_runtime_documents so Regulatory Center
-- consumes Document Center documents as the single source of truth.
--
-- Document Center owns files.
-- Regulatory Center owns regulatory metadata.
-- Study Regulatory owns study associations.
-- No duplicate uploads, files, or storage.

ALTER TABLE regulatory_master_documents
  ADD COLUMN IF NOT EXISTS document_center_id uuid
  REFERENCES compliance_runtime_documents(id)
  ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_reg_docs_dc_id
  ON regulatory_master_documents(document_center_id);
