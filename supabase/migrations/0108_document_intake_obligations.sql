-- Phase 1C: Compliance obligations (signature / acknowledgement requests)

-- Extend audit ledger event types for obligation lifecycle
ALTER TABLE compliance_audit_ledger
  DROP CONSTRAINT IF EXISTS compliance_audit_ledger_event_check;

ALTER TABLE compliance_audit_ledger
  ADD CONSTRAINT compliance_audit_ledger_event_check CHECK (
    event_type IN (
      'document_ingested',
      'certified_copy_attested',
      'document_updated',
      'document_superseded',
      'document_archived',
      'expiration_metadata_set',
      'obligation_created',
      'obligation_completed',
      'obligation_cancelled'
    )
  );

CREATE TABLE compliance_obligations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  document_id uuid NOT NULL REFERENCES compliance_runtime_documents(id),
  obligation_type text NOT NULL,
  acknowledgement_type text NULL,
  signature_meaning text NULL,
  assigned_role text NULL,
  assigned_user_id uuid NULL,
  requested_by uuid NOT NULL,
  requested_at timestamptz NOT NULL DEFAULT now(),
  due_date timestamptz NULL,
  status text NOT NULL DEFAULT 'pending',
  completed_by uuid NULL,
  completed_at timestamptz NULL,
  completion_meaning text NULL,
  reminder_policy jsonb NOT NULL DEFAULT '{}'::jsonb,
  escalation_policy jsonb NOT NULL DEFAULT '{}'::jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT compliance_obligations_type_check CHECK (
    obligation_type IN ('signature', 'acknowledgement')
  ),
  CONSTRAINT compliance_obligations_ack_type_check CHECK (
    acknowledgement_type IS NULL
    OR acknowledgement_type IN ('passive', 'operational', 'training', 'amendment')
  ),
  CONSTRAINT compliance_obligations_signature_meaning_check CHECK (
    signature_meaning IS NULL
    OR signature_meaning IN ('reviewed', 'approved', 'performed', 'certified', 'delegated', 'acknowledged')
  ),
  CONSTRAINT compliance_obligations_status_check CHECK (
    status IN ('pending', 'completed', 'cancelled', 'escalated', 'overdue')
  ),
  CONSTRAINT compliance_obligations_assignee_check CHECK (
    assigned_user_id IS NOT NULL OR assigned_role IS NOT NULL
  )
);

CREATE INDEX idx_compliance_obligations_org ON compliance_obligations(organization_id);
CREATE INDEX idx_compliance_obligations_doc ON compliance_obligations(document_id);
CREATE INDEX idx_compliance_obligations_type ON compliance_obligations(obligation_type);
CREATE INDEX idx_compliance_obligations_status ON compliance_obligations(status);
CREATE INDEX idx_compliance_obligations_assigned_user ON compliance_obligations(assigned_user_id);
CREATE INDEX idx_compliance_obligations_assigned_role ON compliance_obligations(assigned_role);
CREATE INDEX idx_compliance_obligations_due_date ON compliance_obligations(due_date);
CREATE INDEX idx_compliance_obligations_requested_by ON compliance_obligations(requested_by);

ALTER TABLE compliance_obligations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "compliance_obligations_select_org" ON compliance_obligations
  FOR SELECT USING (
    organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "compliance_obligations_insert_org" ON compliance_obligations
  FOR INSERT WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "compliance_obligations_update_org" ON compliance_obligations
  FOR UPDATE USING (
    organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  );
