-- Migration 0209: AI Governance Registry Seed Data — 15 AI/automation use cases.
--
-- Covers every AI-assisted or automation-supported workflow in Vilo OS.
-- UUID prefix convention:
--   a19c0100-...  use case registry
--   a19c0200-...  validation registry
--   a19c0300-...  configuration registry
--   a19c0400-...  human review registry
-- All inserts are idempotent (ON CONFLICT (id) DO NOTHING).

-- =============================================================================
-- 1. AI USE CASE REGISTRY (15 records)
-- =============================================================================

INSERT INTO public.ai_use_case_registry
  (id, module, use_case_name, purpose, risk_level, workflow_area,
   human_review_required, human_reviewer_role, input_sources, output_type, owner_role)
VALUES
  -- UC01 Document Classification and Ingestion
  ('a19c0100-0000-0000-0000-000000000001', 'document_intelligence',
   'Document Classification and Ingestion',
   'Automatically classify incoming documents by type (protocol, amendment, IRB, consent) and extract metadata for indexing.',
   'high', 'document_management', true, 'coordinator',
   ARRAY['raw_document', 'document_metadata'],
   'classified_document_record', 'coordinator'),

  -- UC02 Protocol Field Extraction
  ('a19c0100-0000-0000-0000-000000000002', 'protocol_intake',
   'Protocol Field Extraction',
   'Parse protocol PDF to extract structured fields (arms, visits, procedures, eligibility criteria) for runtime generation.',
   'high', 'protocol_management', true, 'coordinator',
   ARRAY['protocol_pdf', 'document_intelligence_output'],
   'structured_protocol_fields', 'coordinator'),

  -- UC03 Protocol Data Reconciliation
  ('a19c0100-0000-0000-0000-000000000003', 'protocol_intake',
   'Protocol Data Reconciliation',
   'Reconcile extracted protocol fields against the existing protocol runtime to surface deltas requiring coordinator review.',
   'high', 'protocol_management', true, 'coordinator',
   ARRAY['extracted_fields', 'existing_protocol_runtime'],
   'reconciliation_decision', 'coordinator'),

  -- UC04 Visit Runtime Generation
  ('a19c0100-0000-0000-0000-000000000004', 'study_runtime',
   'Visit Runtime Generation',
   'Generate the full visit schedule and procedure checklist from approved protocol runtime fields.',
   'critical', 'visit_execution', true, 'pi_sub_i',
   ARRAY['protocol_runtime_version', 'visit_definitions'],
   'study_runtime_schedule', 'pi_sub_i'),

  -- UC05 Source Data Template Generation
  ('a19c0100-0000-0000-0000-000000000005', 'source_capture',
   'Source Data Template Generation',
   'Auto-generate source response templates from procedure definitions to reduce manual data entry setup.',
   'medium', 'source_data', true, 'coordinator',
   ARRAY['procedure_definitions', 'protocol_fields'],
   'source_response_templates', 'coordinator'),

  -- UC06 Safety Signal Detection
  ('a19c0100-0000-0000-0000-000000000006', 'safety',
   'Safety Signal Detection',
   'Detect adverse events and lab value deviations that meet SAE criteria for immediate PI review and expedited reporting.',
   'critical', 'safety_reporting', true, 'pi_sub_i',
   ARRAY['lab_results', 'adverse_events', 'subject_data'],
   'safety_event_flags', 'pi_sub_i'),

  -- UC07 Protocol Deviation Candidate Detection
  ('a19c0100-0000-0000-0000-000000000007', 'protocol_deviations',
   'Protocol Deviation Candidate Detection',
   'Compare visit execution data against protocol eligibility and procedure rules to surface deviation candidates.',
   'high', 'compliance', true, 'coordinator',
   ARRAY['visit_data', 'protocol_rules', 'eligibility_criteria'],
   'deviation_candidate_list', 'coordinator'),

  -- UC08 CAPA Risk Signal Scoring
  ('a19c0100-0000-0000-0000-000000000008', 'capa',
   'CAPA Risk Signal Scoring',
   'Score CAPA actions by root cause severity, recurrence potential, and impact scope for prioritization.',
   'medium', 'quality_management', true, 'quality',
   ARRAY['capa_actions', 'deviation_history', 'safety_events'],
   'risk_scored_capa_list', 'quality'),

  -- UC09 Amendment Impact Assessment Generation
  ('a19c0100-0000-0000-0000-000000000009', 'amendments',
   'Amendment Impact Assessment Generation',
   'Generate an amendment impact assessment mapping protocol changes to affected subjects, visits, and consent versions.',
   'high', 'protocol_management', true, 'pi_sub_i',
   ARRAY['amendment_document', 'current_protocol_runtime'],
   'amendment_impact_assessment', 'pi_sub_i'),

  -- UC10 Consent Reconsent Requirement Triggering
  ('a19c0100-0000-0000-0000-000000000010', 'consent',
   'Consent Reconsent Requirement Triggering',
   'Automatically determine which subjects require reconsent following an approved amendment to protocol or consent form.',
   'critical', 'consent_management', true, 'coordinator',
   ARRAY['amendment_events', 'protocol_version', 'subject_consent_records'],
   'reconsent_requirements', 'coordinator'),

  -- UC11 Regulatory Document Expiry Alerts
  ('a19c0100-0000-0000-0000-000000000011', 'regulatory_intelligence',
   'Regulatory Document Expiry Alerts',
   'Monitor IRB approvals and investigator credentials to surface expiring or expired documents 30 days in advance.',
   'medium', 'regulatory_compliance', false, null,
   ARRAY['irb_approvals', 'investigator_credentials'],
   'regulatory_alert_list', 'admin'),

  -- UC12 Workflow Action Escalation
  ('a19c0100-0000-0000-0000-000000000012', 'workflow_backbone',
   'Workflow Action Escalation',
   'Escalate overdue or stalled workflow actions to the configured authority based on SLA and escalation rules.',
   'medium', 'workflow_management', false, null,
   ARRAY['workflow_actions', 'sla_rules', 'escalation_config'],
   'escalated_workflow_action', 'coordinator'),

  -- UC13 Query Burden Analytics and Projection
  ('a19c0100-0000-0000-0000-000000000013', 'query_management',
   'Query Burden Analytics and Projection',
   'Aggregate open query counts per subject and visit to surface data quality burden trends across the portfolio.',
   'low', 'data_quality', false, null,
   ARRAY['subject_workflow_actions', 'visit_snapshot_queries'],
   'query_burden_projection', 'coordinator'),

  -- UC14 Financial Leakage Detection
  ('a19c0100-0000-0000-0000-000000000014', 'financial_intelligence',
   'Financial Leakage Detection',
   'Detect unbilled or under-billed procedure executions by comparing protocol payment schedules against executed visits.',
   'medium', 'financial_management', true, 'admin',
   ARRAY['visit_billing', 'protocol_payment_schedule', 'visit_execution'],
   'financial_leakage_flags', 'admin'),

  -- UC15 Inspection Readiness Scoring
  ('a19c0100-0000-0000-0000-000000000015', 'inspection_readiness',
   'Inspection Readiness Scoring',
   'Compute a multi-dimension inspection readiness score and generate audit-style findings for site preparation.',
   'medium', 'audit_readiness', false, null,
   ARRAY['source_completeness', 'capa_status', 'deviation_status', 'safety_events', 'training_assignments'],
   'readiness_score_and_findings', 'coordinator')

ON CONFLICT (id) DO NOTHING;

-- =============================================================================
-- 2. AI VALIDATION REGISTRY (1 initial record per use case)
-- =============================================================================

INSERT INTO public.ai_validation_registry
  (id, use_case_id, validation_name, validation_scope, sample_type,
   expected_behavior, sme_review_required, sme_reviewer_role, validation_result, notes)
VALUES
  ('a19c0200-0000-0000-0000-000000000001',
   'a19c0100-0000-0000-0000-000000000001',
   'Document Classification Accuracy Test',
   'Representative sample of 50 documents across 5 document types',
   'retrospective_sample',
   'Classification accuracy >= 95% across all document types with zero mis-classifications of IRB documents',
   true, 'coordinator', 'pending',
   'Initial validation plan. Requires 50-document labeled sample from production corpus.'),

  ('a19c0200-0000-0000-0000-000000000002',
   'a19c0100-0000-0000-0000-000000000002',
   'Protocol Field Extraction Fidelity Test',
   'Structured fields extracted from 10 sponsor protocols across 3 therapeutic areas',
   'prospective_challenge',
   'Field extraction fidelity >= 98% for mandatory fields; zero missed eligibility criteria',
   true, 'coordinator', 'pending',
   'Requires side-by-side comparison of extracted fields vs. manual extraction by trained coordinator.'),

  ('a19c0200-0000-0000-0000-000000000003',
   'a19c0100-0000-0000-0000-000000000003',
   'Reconciliation Delta Accuracy Test',
   'Protocol amendment pairs with known delta sets',
   'retrospective_sample',
   'All material deltas (arms, eligibility, visit windows) surfaced with zero missed critical changes',
   true, 'coordinator', 'pending',
   'Requires amendment pairs where ground-truth deltas are known.'),

  ('a19c0200-0000-0000-0000-000000000004',
   'a19c0100-0000-0000-0000-000000000004',
   'Visit Runtime Generation Completeness Test',
   'Full visit schedule for 3 studies across different study designs',
   'retrospective_sample',
   'Generated schedule matches PI-approved paper schedule 100% for required visits; no missing mandatory procedures',
   true, 'pi_sub_i', 'pending',
   'Requires PI review of generated schedule against protocol appendix.'),

  ('a19c0200-0000-0000-0000-000000000005',
   'a19c0100-0000-0000-0000-000000000005',
   'Source Template Completeness Test',
   'Generated templates for 5 procedure types across 2 studies',
   'prospective_challenge',
   'All required CRF fields present; no orphaned fields; template passes coordinator QC review',
   false, null, 'pending',
   'Coordinator QC review sufficient for this risk level.'),

  ('a19c0200-0000-0000-0000-000000000006',
   'a19c0100-0000-0000-0000-000000000006',
   'Safety Signal Detection Sensitivity and Specificity Test',
   'Retrospective cohort of 100 subject-visits with known SAE outcomes',
   'retrospective_labeled',
   'Sensitivity >= 99% for SAE detection; specificity >= 80%; zero missed Grade 4+ events',
   true, 'pi_sub_i', 'pending',
   'Critical use case. Requires physician-labeled ground truth dataset. SME review by PI mandatory.'),

  ('a19c0200-0000-0000-0000-000000000007',
   'a19c0100-0000-0000-0000-000000000007',
   'Deviation Candidate Precision and Recall Test',
   'Visit execution records for 50 visits with known deviation outcomes',
   'retrospective_labeled',
   'Recall >= 95% for protocol-defined deviations; precision >= 85% to minimize false positives',
   true, 'coordinator', 'pending',
   'Requires labeled dataset of visits with confirmed/confirmed-not deviations.'),

  ('a19c0200-0000-0000-0000-000000000008',
   'a19c0100-0000-0000-0000-000000000008',
   'CAPA Risk Score Calibration Test',
   'CAPA action set from last 24 months with known outcomes',
   'retrospective_sample',
   'High-risk scores correlate with repeat deviations or safety events at >= 80% rate',
   true, 'quality', 'pending',
   'Quality SME to review scoring thresholds and calibrate against historical outcomes.'),

  ('a19c0200-0000-0000-0000-000000000009',
   'a19c0100-0000-0000-0000-000000000009',
   'Amendment Impact Completeness Test',
   '5 historical amendments with known downstream impact sets',
   'retrospective_sample',
   'All affected subject-consent pairs and visit changes identified; zero missed reconsent triggers',
   true, 'pi_sub_i', 'pending',
   'PI review required to confirm impact assessment completeness against regulatory expectation.'),

  ('a19c0200-0000-0000-0000-000000000010',
   'a19c0100-0000-0000-0000-000000000010',
   'Reconsent Trigger Accuracy Test',
   '3 historical amendments that required subject reconsent',
   'retrospective_sample',
   'All subjects requiring reconsent identified with zero missed subjects; coordinator notified within 24h',
   true, 'coordinator', 'pending',
   'Critical. Cross-reference triggered subjects against IRB-defined reconsent population.'),

  ('a19c0200-0000-0000-0000-000000000011',
   'a19c0100-0000-0000-0000-000000000011',
   'Expiry Alert Lead-Time Accuracy Test',
   '12 months of historical IRB approval renewal events',
   'retrospective_sample',
   'Alerts generated >= 30 days before actual expiry with zero missed expirations',
   false, null, 'pending',
   'Rule-based alert; no SME review required.'),

  ('a19c0200-0000-0000-0000-000000000012',
   'a19c0100-0000-0000-0000-000000000012',
   'Escalation Rule Correctness Test',
   'All escalation rule configurations across study portfolio',
   'configuration_audit',
   'Every overdue action meeting escalation criteria reaches the correct authority role within the configured SLA',
   false, null, 'pending',
   'Configuration-based escalation. Validated by checking escalation log against rule definitions.'),

  ('a19c0200-0000-0000-0000-000000000013',
   'a19c0100-0000-0000-0000-000000000013',
   'Query Burden Aggregation Accuracy Test',
   'Full query log for 3 active studies',
   'retrospective_sample',
   'Aggregated query counts match manual count within 0% variance; projections within 10% of actuals',
   false, null, 'pending',
   'Deterministic aggregation. Validated by comparing against raw query log counts.'),

  ('a19c0200-0000-0000-0000-000000000014',
   'a19c0100-0000-0000-0000-000000000014',
   'Financial Leakage Detection Completeness Test',
   '6 months of executed visits with known billing outcomes',
   'retrospective_labeled',
   'All unbilled procedure executions flagged with zero missed leakage events > $500 threshold',
   true, 'admin', 'pending',
   'Admin review required before billing corrections are submitted.'),

  ('a19c0200-0000-0000-0000-000000000015',
   'a19c0100-0000-0000-0000-000000000015',
   'Inspection Readiness Score Calibration Test',
   '2 studies with known inspection outcomes (passed/findings)',
   'retrospective_labeled',
   'Studies with inspection findings score <= 70; studies that passed score >= 85',
   false, null, 'pending',
   'Score calibration against historical inspection outcomes. No SME review required at initial deployment.')

ON CONFLICT (id) DO NOTHING;

-- =============================================================================
-- 3. AI CONFIGURATION REGISTRY (v1.0 baseline per use case)
-- =============================================================================

INSERT INTO public.ai_configuration_registry
  (id, use_case_id, config_type, config_name, config_version, change_reason,
   effective_date, validation_required, validation_status)
VALUES
  ('a19c0300-0000-0000-0000-000000000001',
   'a19c0100-0000-0000-0000-000000000001',
   'parser', 'Document Classification Parser', '1.0',
   'Initial deployment — baseline document type classifier.',
   '2025-01-01', true, 'pending'),

  ('a19c0300-0000-0000-0000-000000000002',
   'a19c0100-0000-0000-0000-000000000002',
   'extractor', 'Protocol Field Extractor', '1.0',
   'Initial deployment — structured field extraction from protocol PDF.',
   '2025-01-01', true, 'pending'),

  ('a19c0300-0000-0000-0000-000000000003',
   'a19c0100-0000-0000-0000-000000000003',
   'ruleset', 'Protocol Reconciliation Ruleset', '1.0',
   'Initial deployment — delta computation rules for protocol reconciliation.',
   '2025-01-01', true, 'pending'),

  ('a19c0300-0000-0000-0000-000000000004',
   'a19c0100-0000-0000-0000-000000000004',
   'automation_rule', 'Visit Runtime Generation Rules', '1.0',
   'Initial deployment — visit schedule generation from protocol arms and visit definitions.',
   '2025-01-01', true, 'pending'),

  ('a19c0300-0000-0000-0000-000000000005',
   'a19c0100-0000-0000-0000-000000000005',
   'automation_rule', 'Source Template Generation Rules', '1.0',
   'Initial deployment — source response template generation from procedure definitions.',
   '2025-01-01', false, 'not_required'),

  ('a19c0300-0000-0000-0000-000000000006',
   'a19c0100-0000-0000-0000-000000000006',
   'ruleset', 'Safety Signal Detection Ruleset', '1.0',
   'Initial deployment — SAE criteria and lab value deviation thresholds per ICH E6.',
   '2025-01-01', true, 'pending'),

  ('a19c0300-0000-0000-0000-000000000007',
   'a19c0100-0000-0000-0000-000000000007',
   'ruleset', 'Protocol Deviation Detection Ruleset', '1.0',
   'Initial deployment — protocol eligibility and procedure window deviation rules.',
   '2025-01-01', true, 'pending'),

  ('a19c0300-0000-0000-0000-000000000008',
   'a19c0100-0000-0000-0000-000000000008',
   'threshold', 'CAPA Risk Scoring Thresholds', '1.0',
   'Initial deployment — risk tier thresholds: low/medium/high/critical scoring weights.',
   '2025-01-01', true, 'pending'),

  ('a19c0300-0000-0000-0000-000000000009',
   'a19c0100-0000-0000-0000-000000000009',
   'automation_rule', 'Amendment Impact Assessment Rules', '1.0',
   'Initial deployment — rules mapping amendment change types to affected study entities.',
   '2025-01-01', true, 'pending'),

  ('a19c0300-0000-0000-0000-000000000010',
   'a19c0100-0000-0000-0000-000000000010',
   'ruleset', 'Consent Reconsent Triggering Ruleset', '1.0',
   'Initial deployment — rules determining reconsent requirement by amendment change type and subject status.',
   '2025-01-01', true, 'pending'),

  ('a19c0300-0000-0000-0000-000000000011',
   'a19c0100-0000-0000-0000-000000000011',
   'automation_rule', 'Regulatory Expiry Alert Rules', '1.0',
   'Initial deployment — 30-day lead-time alert rules for IRB approvals and credentials.',
   '2025-01-01', false, 'not_required'),

  ('a19c0300-0000-0000-0000-000000000012',
   'a19c0100-0000-0000-0000-000000000012',
   'automation_rule', 'Workflow Escalation Rules', '1.0',
   'Initial deployment — SLA-based escalation routing to authority roles.',
   '2025-01-01', false, 'not_required'),

  ('a19c0300-0000-0000-0000-000000000013',
   'a19c0100-0000-0000-0000-000000000013',
   'automation_rule', 'Query Burden Analytics Rules', '1.0',
   'Initial deployment — query aggregation and projection formulas.',
   '2025-01-01', false, 'not_required'),

  ('a19c0300-0000-0000-0000-000000000014',
   'a19c0100-0000-0000-0000-000000000014',
   'ruleset', 'Financial Leakage Detection Ruleset', '1.0',
   'Initial deployment — billing comparison rules against protocol payment schedule.',
   '2025-01-01', true, 'pending'),

  ('a19c0300-0000-0000-0000-000000000015',
   'a19c0100-0000-0000-0000-000000000015',
   'automation_rule', 'Inspection Readiness Scoring Rules', '1.0',
   'Initial deployment — 8-dimension readiness scoring weights and thresholds.',
   '2025-01-01', false, 'not_required')

ON CONFLICT (id) DO NOTHING;

-- =============================================================================
-- 4. AI HUMAN REVIEW REGISTRY (only for human_review_required = true use cases)
-- =============================================================================

INSERT INTO public.ai_human_review_registry
  (id, use_case_id, module, review_step, reviewer_role, is_required,
   decision_options, audit_event_table, evidence_location)
VALUES
  -- UC01 Document Classification
  ('a19c0400-0000-0000-0000-000000000001',
   'a19c0100-0000-0000-0000-000000000001',
   'document_intelligence',
   'Confirm document classification before indexing',
   'coordinator', true,
   ARRAY['confirm_classification', 'reclassify', 'reject_document'],
   'document_audit_events',
   'document_intelligence_classifications'),

  -- UC02 Protocol Field Extraction
  ('a19c0400-0000-0000-0000-000000000002',
   'a19c0100-0000-0000-0000-000000000002',
   'protocol_intake',
   'Review extracted protocol fields before protocol runtime creation',
   'coordinator', true,
   ARRAY['approve_extraction', 'edit_fields', 'reject_and_retry'],
   'protocol_audit_events',
   'protocol_field_extractions'),

  -- UC03 Protocol Reconciliation
  ('a19c0400-0000-0000-0000-000000000003',
   'a19c0100-0000-0000-0000-000000000003',
   'protocol_intake',
   'Approve reconciliation decision before applying delta to runtime',
   'coordinator', true,
   ARRAY['apply_reconciliation', 'modify_and_apply', 'discard_changes'],
   'protocol_audit_events',
   'protocol_reconciliation_decisions'),

  -- UC04 Visit Runtime Generation
  ('a19c0400-0000-0000-0000-000000000004',
   'a19c0100-0000-0000-0000-000000000004',
   'study_runtime',
   'Approve generated visit schedule before study activation',
   'pi_sub_i', true,
   ARRAY['approve_schedule', 'request_revision', 'reject_generation'],
   'study_runtime_audit_events',
   'study_runtime_schedules'),

  -- UC05 Source Template Generation
  ('a19c0400-0000-0000-0000-000000000005',
   'a19c0100-0000-0000-0000-000000000005',
   'source_capture',
   'Review generated source templates before activation',
   'coordinator', true,
   ARRAY['activate_template', 'edit_and_activate', 'discard_template'],
   'source_capture_audit_events',
   'source_response_templates'),

  -- UC06 Safety Signal Detection
  ('a19c0400-0000-0000-0000-000000000006',
   'a19c0100-0000-0000-0000-000000000006',
   'safety',
   'Confirm safety signal and initiate SAE reporting if required',
   'pi_sub_i', true,
   ARRAY['confirm_sae', 'downgrade_to_ae', 'dismiss_signal'],
   'safety_audit_events',
   'safety_events'),

  -- UC07 Deviation Candidate Detection
  ('a19c0400-0000-0000-0000-000000000007',
   'a19c0100-0000-0000-0000-000000000007',
   'protocol_deviations',
   'Confirm deviation candidate before creating formal deviation record',
   'coordinator', true,
   ARRAY['confirm_deviation', 'dismiss_candidate', 'escalate_to_pi'],
   'deviation_audit_events',
   'protocol_deviations'),

  -- UC08 CAPA Risk Scoring
  ('a19c0400-0000-0000-0000-000000000008',
   'a19c0100-0000-0000-0000-000000000008',
   'capa',
   'Confirm risk score and prioritize CAPA remediation',
   'quality', true,
   ARRAY['confirm_risk_score', 'adjust_score', 'override_priority'],
   'capa_audit_events',
   'capa_actions'),

  -- UC09 Amendment Impact Assessment
  ('a19c0400-0000-0000-0000-000000000009',
   'a19c0100-0000-0000-0000-000000000009',
   'amendments',
   'Review amendment impact assessment before downstream actions are triggered',
   'pi_sub_i', true,
   ARRAY['approve_impact_assessment', 'modify_scope', 'escalate_to_irb'],
   'amendment_audit_events',
   'amendment_impact_assessments'),

  -- UC10 Consent Reconsent Triggering
  ('a19c0400-0000-0000-0000-000000000010',
   'a19c0100-0000-0000-0000-000000000010',
   'consent',
   'Confirm reconsent requirements before subjects are notified',
   'coordinator', true,
   ARRAY['confirm_and_notify', 'modify_subject_list', 'defer_pending_pi_review'],
   'consent_audit_events',
   'consent_reconsent_requirements'),

  -- UC14 Financial Leakage Detection
  ('a19c0400-0000-0000-0000-000000000014',
   'a19c0100-0000-0000-0000-000000000014',
   'financial_intelligence',
   'Review financial leakage flags before billing correction is submitted',
   'admin', true,
   ARRAY['approve_billing_correction', 'dispute_finding', 'escalate_to_sponsor'],
   null,
   'financial_leakage_flags')

ON CONFLICT (id) DO NOTHING;
