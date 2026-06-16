-- Migration 0213: AI Governance registry entries for Financial Intelligence closure.
-- Adds UC16-UC21 covering financial workflows. Fixes UC14 audit_event_table gap.
-- All inserts are idempotent (ON CONFLICT DO NOTHING or DO UPDATE).

-- =============================================================================
-- 1. Fix UC14 — set audit_event_table to audit_events
-- =============================================================================

UPDATE public.ai_human_review_registry
SET audit_event_table = 'audit_events'
WHERE id = 'a19c0400-0000-0000-0000-000000000014'
  AND audit_event_table IS NULL;

-- =============================================================================
-- 2. New use cases UC16-UC21
-- =============================================================================

INSERT INTO public.ai_use_case_registry
  (id, module, use_case_name, purpose, risk_level, workflow_area,
   human_review_required, human_reviewer_role, input_sources, output_type, owner_role)
VALUES
  -- UC16 SoA Billable Triggering
  ('a19c0100-0000-0000-0000-000000000016', 'financial_intelligence',
   'SoA Billable Triggering',
   'Automatically trigger expected billables from the Schedule of Activities when visit procedures are completed and earned.',
   'medium', 'financial_management', true, 'admin',
   ARRAY['visit_execution', 'procedure_execution', 'payment_schedule'],
   'triggered_soa_billable', 'admin'),

  -- UC17 Invoice Draft Automation
  ('a19c0100-0000-0000-0000-000000000017', 'financial_intelligence',
   'Invoice Draft Automation',
   'Automatically materialize invoice draft line items when procedures meet earn eligibility criteria.',
   'medium', 'financial_management', true, 'admin',
   ARRAY['earned_procedure_executions', 'pricing_events', 'financial_invoiceable_line_items'],
   'invoice_draft', 'admin'),

  -- UC18 Payment Dispute Workflow
  ('a19c0100-0000-0000-0000-000000000018', 'financial_intelligence',
   'Payment Dispute Workflow',
   'Rule-based detection of payment shortfalls and discrepancies that trigger dispute review for Finance or Business Office.',
   'medium', 'financial_management', true, 'admin',
   ARRAY['financial_payments', 'financial_invoices', 'payment_allocations'],
   'dispute_candidate', 'admin'),

  -- UC19 Amendment Financial Impact Estimation
  ('a19c0100-0000-0000-0000-000000000019', 'financial_intelligence',
   'Amendment Financial Impact Estimation',
   'Estimate per-amendment fee and reconsent cost exposure using site rate profiles and amendment subject impact data.',
   'low', 'financial_management', false, null,
   ARRAY['amendment_subject_impacts', 'site_rate_profiles', 'chargemaster_engine'],
   'amendment_financial_exposure_estimate', 'admin'),

  -- UC20 Budget Negotiation Chargemaster Recommendations
  ('a19c0100-0000-0000-0000-000000000020', 'financial_intelligence',
   'Budget Negotiation Chargemaster Recommendations',
   'Compute site chargemaster, ask price, BATNA floor, and scenario responses to support sponsor budget negotiation.',
   'low', 'financial_management', false, null,
   ARRAY['site_rates', 'visit_model', 'ops_model', 'study_parameters'],
   'chargemaster_recommendation', 'finance'),

  -- UC21 Revenue Risk Coaching
  ('a19c0100-0000-0000-0000-000000000021', 'financial_intelligence',
   'Revenue Risk Coaching',
   'Rule-based detection of operational actions that block earned revenue and surface them as coordinator coaching signals.',
   'low', 'financial_management', false, null,
   ARRAY['procedure_executions', 'source_response_sets', 'payment_lifecycle_status'],
   'revenue_coaching_signals', 'coordinator')

ON CONFLICT (id) DO NOTHING;

-- =============================================================================
-- 3. Validation registry — one entry per new use case
-- =============================================================================

INSERT INTO public.ai_validation_registry
  (id, use_case_id, validation_name, validation_scope, sample_type,
   expected_behavior, sme_review_required, sme_reviewer_role, validation_result, notes)
VALUES
  ('a19c0200-0000-0000-0000-000000000016',
   'a19c0100-0000-0000-0000-000000000016',
   'SoA Billable Trigger Accuracy',
   'All completed visits over 90 days with expected billables in test org',
   'retrospective_sample',
   'All completed and earned procedures have a triggered SoA billable; no unbilled earned procedures exist',
   true, 'admin', 'pending',
   'Validation requires test org with completed visits and payment schedule.'),

  ('a19c0200-0000-0000-0000-000000000017',
   'a19c0100-0000-0000-0000-000000000017',
   'Invoice Draft Materialization Accuracy',
   'All earned visits with pricing events in test org',
   'retrospective_sample',
   'Invoice draft contains exactly the earned line items matching the pricing event unit cost',
   true, 'admin', 'pending',
   'Requires pricing event seed data in test org.'),

  ('a19c0200-0000-0000-0000-000000000018',
   'a19c0100-0000-0000-0000-000000000018',
   'Payment Dispute Detection Coverage',
   'All invoices with partial payment or shortfall in test org',
   'retrospective_sample',
   'All invoices with balance_due > 0 after received_at are surfaced as dispute candidates',
   true, 'admin', 'pending',
   null),

  ('a19c0200-0000-0000-0000-000000000019',
   'a19c0100-0000-0000-0000-000000000019',
   'Amendment Exposure Estimate Reasonableness',
   'Manual spot-check against 3 known amendments with site rate profiles',
   'manual_review',
   'Exposure estimate within 15% of manually computed amendment fee for known rate profiles',
   false, null, 'pending',
   'Low-risk automation — estimate is clearly labeled as ESTIMATED.'),

  ('a19c0200-0000-0000-0000-000000000020',
   'a19c0100-0000-0000-0000-000000000020',
   'Chargemaster Computation Correctness',
   'Unit test coverage of calculateChargemaster across known input sets',
   'unit_test',
   'All 13 negotiation scenario tests pass; chargemaster outputs match manual formula verification',
   false, null, 'pending',
   'Covered by existing negotiation-engine.test.ts suite.'),

  ('a19c0200-0000-0000-0000-000000000021',
   'a19c0100-0000-0000-0000-000000000021',
   'Revenue Coaching Signal Accuracy',
   'All subjects with unsigned completed procedures in test org',
   'retrospective_sample',
   'Coaching signals appear for all subjects with is_signed=false AND execution_status=completed/verified',
   false, null, 'pending',
   null)

ON CONFLICT (id) DO NOTHING;

-- =============================================================================
-- 4. Configuration registry
-- =============================================================================

INSERT INTO public.ai_configuration_registry
  (id, use_case_id, config_type, config_name, config_version,
   change_reason, effective_date, validation_required, validation_status)
VALUES
  ('a19c0300-0000-0000-0000-000000000016',
   'a19c0100-0000-0000-0000-000000000016',
   'ruleset', 'SoA Billable Trigger Ruleset', '1.0',
   'Initial financial intelligence closure', current_date, true, 'pending'),

  ('a19c0300-0000-0000-0000-000000000017',
   'a19c0100-0000-0000-0000-000000000017',
   'ruleset', 'Invoice Draft Materialization Ruleset', '1.0',
   'Initial financial intelligence closure', current_date, true, 'pending'),

  ('a19c0300-0000-0000-0000-000000000018',
   'a19c0100-0000-0000-0000-000000000018',
   'ruleset', 'Payment Dispute Detection Ruleset', '1.0',
   'Initial financial intelligence closure', current_date, true, 'pending'),

  ('a19c0300-0000-0000-0000-000000000019',
   'a19c0100-0000-0000-0000-000000000019',
   'model', 'Amendment Financial Exposure Model', '1.0',
   'Default burden hours: PI 4h, CRC 8h per amendment; CRC 1.5h per reconsent', current_date, false, 'not_required'),

  ('a19c0300-0000-0000-0000-000000000020',
   'a19c0100-0000-0000-0000-000000000020',
   'model', 'Chargemaster Negotiation Engine', '1.0',
   'Initial chargemaster + 14 scenario advisor release', current_date, false, 'not_required'),

  ('a19c0300-0000-0000-0000-000000000021',
   'a19c0100-0000-0000-0000-000000000021',
   'ruleset', 'Revenue Coaching Signal Ruleset', '1.0',
   'Initial financial intelligence closure', current_date, false, 'not_required')

ON CONFLICT (id) DO NOTHING;

-- =============================================================================
-- 5. Human review registry — only for use cases with human_review_required=true
-- =============================================================================

INSERT INTO public.ai_human_review_registry
  (id, use_case_id, module, review_step, reviewer_role,
   is_required, decision_options, audit_event_table, evidence_location)
VALUES
  ('a19c0400-0000-0000-0000-000000000016',
   'a19c0100-0000-0000-0000-000000000016',
   'financial_intelligence',
   'Review triggered SoA billable before invoice draft is created',
   'admin', true,
   ARRAY['approve_trigger', 'reject_trigger', 'escalate_to_finance'],
   'audit_events',
   'financial_invoiceable_line_items'),

  ('a19c0400-0000-0000-0000-000000000017',
   'a19c0100-0000-0000-0000-000000000017',
   'financial_intelligence',
   'Review invoice draft before sending to sponsor',
   'admin', true,
   ARRAY['approve_and_send', 'reject_draft', 'escalate_to_finance'],
   'audit_events',
   'financial_invoices'),

  ('a19c0400-0000-0000-0000-000000000018',
   'a19c0100-0000-0000-0000-000000000018',
   'financial_intelligence',
   'Review payment dispute and determine resolution',
   'admin', true,
   ARRAY['confirm_dispute', 'dismiss_dispute', 'request_payment', 'write_off'],
   'audit_events',
   'financial_payments')

ON CONFLICT (id) DO NOTHING;
