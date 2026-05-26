-- Phase 1D: Document expiration coordinator alerts

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
      'obligation_cancelled',
      'expiration_alert_created',
      'expiration_alert_resolved',
      'document_marked_expiring_soon',
      'document_marked_expired'
    )
  );

CREATE TABLE compliance_expiration_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  document_id uuid NOT NULL REFERENCES compliance_runtime_documents(id),
  alert_type text NOT NULL,
  alert_date timestamptz NOT NULL DEFAULT now(),
  days_before_expiration integer NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  assigned_role text NULL DEFAULT 'crc',
  assigned_user_id uuid NULL,
  resolved_by uuid NULL,
  resolved_at timestamptz NULL,
  resolution_note text NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT compliance_expiration_alerts_type_check CHECK (
    alert_type IN ('expiration_warning', 'expired')
  ),
  CONSTRAINT compliance_expiration_alerts_status_check CHECK (
    status IN ('pending', 'resolved', 'dismissed', 'escalated')
  ),
  CONSTRAINT compliance_expiration_alerts_days_check CHECK (
    days_before_expiration IN (30, 14, 7, 1, 0)
  ),
  CONSTRAINT compliance_expiration_alerts_document_threshold_unique UNIQUE (
    document_id,
    days_before_expiration
  )
);

CREATE INDEX idx_compliance_expiration_alerts_org ON compliance_expiration_alerts(organization_id);
CREATE INDEX idx_compliance_expiration_alerts_doc ON compliance_expiration_alerts(document_id);
CREATE INDEX idx_compliance_expiration_alerts_type ON compliance_expiration_alerts(alert_type);
CREATE INDEX idx_compliance_expiration_alerts_status ON compliance_expiration_alerts(status);
CREATE INDEX idx_compliance_expiration_alerts_days ON compliance_expiration_alerts(days_before_expiration);
CREATE INDEX idx_compliance_expiration_alerts_assigned_role ON compliance_expiration_alerts(assigned_role);
CREATE INDEX idx_compliance_expiration_alerts_assigned_user ON compliance_expiration_alerts(assigned_user_id);

ALTER TABLE compliance_expiration_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "compliance_expiration_alerts_select_org" ON compliance_expiration_alerts
  FOR SELECT USING (
    organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "compliance_expiration_alerts_insert_org" ON compliance_expiration_alerts
  FOR INSERT WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "compliance_expiration_alerts_update_org" ON compliance_expiration_alerts
  FOR UPDATE USING (
    organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  );
