-- Migration 0106: Document Intake & Compliance Runtime Layer
-- Establishes immutable, Part-11 ready audit ledger and runtime documents.

CREATE TABLE compliance_runtime_documents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  study_id uuid null,
  subject_id uuid null,
  visit_id uuid null,
  procedure_execution_id uuid null,
  document_classification text not null,
  destination_domain text not null,
  destination_entity_type text not null,
  destination_entity_id uuid null,
  original_filename text not null,
  operational_display_name text not null,
  mime_type text not null,
  storage_bucket text not null,
  storage_path text not null,
  cryptographic_hash text not null,
  file_size_bytes bigint null,
  expiration_date timestamptz null,
  status text not null default 'active',
  supersedes_document_id uuid null references compliance_runtime_documents(id),
  certified_copy_required boolean not null default false,
  certified_copy_attested boolean not null default false,
  certified_copy_attested_by uuid null,
  certified_copy_attested_at timestamptz null,
  certified_copy_attestation_text text null,
  tags text[] not null default '{}',
  operational_notes text null,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint compliance_runtime_documents_status_check check (status in ('active', 'expiring_soon', 'expired', 'renewal_requested', 'renewed', 'superseded', 'archived')),
  constraint compliance_runtime_documents_classification_check check (length(document_classification) > 0),
  constraint compliance_runtime_documents_domain_check check (length(destination_domain) > 0),
  constraint compliance_runtime_documents_entity_type_check check (length(destination_entity_type) > 0),
  constraint compliance_runtime_documents_hash_check check (length(cryptographic_hash) > 0)
);

CREATE INDEX idx_compliance_docs_org ON compliance_runtime_documents(organization_id);
CREATE INDEX idx_compliance_docs_study ON compliance_runtime_documents(study_id);
CREATE INDEX idx_compliance_docs_subject ON compliance_runtime_documents(subject_id);
CREATE INDEX idx_compliance_docs_visit ON compliance_runtime_documents(visit_id);
CREATE INDEX idx_compliance_docs_procedure ON compliance_runtime_documents(procedure_execution_id);
CREATE INDEX idx_compliance_docs_class ON compliance_runtime_documents(document_classification);
CREATE INDEX idx_compliance_docs_status ON compliance_runtime_documents(status);
CREATE INDEX idx_compliance_docs_expiration ON compliance_runtime_documents(expiration_date);
CREATE INDEX idx_compliance_docs_hash ON compliance_runtime_documents(cryptographic_hash);
CREATE INDEX idx_compliance_docs_supersedes ON compliance_runtime_documents(supersedes_document_id);

CREATE TABLE compliance_audit_ledger (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  document_id uuid not null references compliance_runtime_documents(id),
  event_type text not null,
  actor_id uuid null,
  actor_role text null,
  event_timestamp timestamptz not null default now(),
  state_hash text not null,
  event_payload jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,

  constraint compliance_audit_ledger_event_check check (event_type in ('document_ingested', 'certified_copy_attested', 'document_updated', 'document_superseded', 'document_archived', 'expiration_metadata_set'))
);

CREATE INDEX idx_compliance_audit_ledger_doc ON compliance_audit_ledger(document_id);
CREATE INDEX idx_compliance_audit_ledger_org ON compliance_audit_ledger(organization_id);
CREATE INDEX idx_compliance_audit_ledger_event ON compliance_audit_ledger(event_type);

-- Basic RLS setup based on organization
ALTER TABLE compliance_runtime_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE compliance_audit_ledger ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable read access for organization users" ON compliance_runtime_documents
  FOR SELECT USING (organization_id IN (
    SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
  ));

CREATE POLICY "Enable insert for organization users" ON compliance_runtime_documents
  FOR INSERT WITH CHECK (organization_id IN (
    SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
  ));

CREATE POLICY "Enable update for organization users" ON compliance_runtime_documents
  FOR UPDATE USING (organization_id IN (
    SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
  ));

-- Audit ledger is append-only
CREATE POLICY "Enable read access for organization users" ON compliance_audit_ledger
  FOR SELECT USING (organization_id IN (
    SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
  ));

CREATE POLICY "Enable insert for organization users" ON compliance_audit_ledger
  FOR INSERT WITH CHECK (organization_id IN (
    SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
  ));
