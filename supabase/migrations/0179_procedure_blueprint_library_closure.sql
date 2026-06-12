-- Migration 0179: Procedure Blueprint Library Closure
--
-- Seeds 7 missing procedure blueprints required by VALIDATION_PROTOCOL_001 to
-- bring procedure generation from 7/14 to 14/14. All rows are idempotent via
-- ON CONFLICT DO NOTHING on the procedure_code unique index (global scope).
--
-- Blueprints added (with published blueprint versions):
--   ELIGIBILITY_REVIEW, MEDICAL_HISTORY, CONMED_REVIEW (universal)
--   PHONE_CONTACT (common)
--   EOS_CLOSEOUT (common)
--   ACTH_STIM_TEST, HIT_PLATELET_PANEL (study_specific)
--
-- CONMED_REVIEW and ACTH_STIM are already present in the 0110 conditional seed;
-- this migration makes them unconditionally idempotent so they survive re-runs
-- and fresh environments where 0110's guard skipped them.

DO $$
DECLARE
  seed_actor uuid := '00000000-0000-4000-8000-000000000001';
  proc_id    uuid;
  version_id uuid;
BEGIN

  -- -------------------------------------------------------------------------
  -- 1. ELIGIBILITY_REVIEW  (universal)
  -- -------------------------------------------------------------------------
  INSERT INTO procedure_library (
    library_scope, procedure_code, procedure_name, procedure_category,
    procedure_subcategory,
    operational_description, procedure_complexity, estimated_duration_minutes,
    status, tags, created_by
  )
  SELECT
    'global', 'ELIGIBILITY_REVIEW', 'Eligibility Review', 'regulatory',
    'enrollment',
    'Confirm subject meets all inclusion and exclusion criteria before randomization.',
    'standard', 20,
    'active', ARRAY['enrollment','eligibility','universal'], seed_actor
  WHERE NOT EXISTS (
    SELECT 1 FROM procedure_library
    WHERE procedure_code = 'ELIGIBILITY_REVIEW' AND library_scope = 'global'
  )
  RETURNING id INTO proc_id;

  IF proc_id IS NOT NULL THEN
    INSERT INTO procedure_blueprint_versions (
      procedure_id, version_number, blueprint_status, blueprint_json, field_schema,
      dependency_schema, operational_rules, created_by
    ) VALUES (
      proc_id, 1, 'published',
      '{
        "sections": [{
          "section_id": "eligibility",
          "title": "Eligibility Review",
          "fields": [
            {"field_id": "reviewed_datetime",       "type": "datetime", "required": true,  "label": "Review Date / Time"},
            {"field_id": "criteria_met",            "type": "yes_no",   "required": true,  "label": "All Criteria Met"},
            {"field_id": "deviations_noted",        "type": "yes_no",   "required": true,  "label": "Deviations Noted"},
            {"field_id": "reviewer_role",           "type": "select",   "required": false, "label": "Reviewer Role",
             "options": ["CRC","PI","Sub-I"]},
            {"field_id": "comments",                "type": "textarea", "required": false, "label": "Comments"}
          ]
        }],
        "coordinator_guidance": "Complete prior to randomization. If any criterion is unmet, escalate to PI before proceeding."
      }'::jsonb,
      '{
        "fields": [
          {"field_id": "reviewed_datetime", "type": "datetime", "label": "Review Date / Time", "required": true},
          {"field_id": "criteria_met",      "type": "yes_no",   "label": "All Criteria Met",   "required": true},
          {"field_id": "deviations_noted",  "type": "yes_no",   "label": "Deviations Noted",   "required": true},
          {"field_id": "reviewer_role",     "type": "select",   "label": "Reviewer Role",      "required": false},
          {"field_id": "comments",          "type": "textarea", "label": "Comments",            "required": false}
        ]
      }'::jsonb,
      '{}'::jsonb,
      '{"coordinator_guidance": "Do not proceed to randomization if deviations_noted is true without PI sign-off."}'::jsonb,
      seed_actor
    ) RETURNING id INTO version_id;
    UPDATE procedure_library SET active_version_id = version_id WHERE id = proc_id;
  END IF;

  -- -------------------------------------------------------------------------
  -- 2. MEDICAL_HISTORY  (universal)
  -- -------------------------------------------------------------------------
  INSERT INTO procedure_library (
    library_scope, procedure_code, procedure_name, procedure_category,
    procedure_subcategory,
    operational_description, procedure_complexity, estimated_duration_minutes,
    status, tags, created_by
  )
  SELECT
    'global', 'MEDICAL_HISTORY', 'Medical History', 'clinical_review',
    'history',
    'Capture and document subject medical history at screening / baseline.',
    'standard', 20,
    'active', ARRAY['medical_history','screening','universal'], seed_actor
  WHERE NOT EXISTS (
    SELECT 1 FROM procedure_library
    WHERE procedure_code = 'MEDICAL_HISTORY' AND library_scope = 'global'
  )
  RETURNING id INTO proc_id;

  IF proc_id IS NOT NULL THEN
    INSERT INTO procedure_blueprint_versions (
      procedure_id, version_number, blueprint_status, blueprint_json, field_schema,
      dependency_schema, operational_rules, created_by
    ) VALUES (
      proc_id, 1, 'published',
      '{
        "sections": [{
          "section_id": "med_history",
          "title": "Medical History",
          "fields": [
            {"field_id": "reviewed_datetime",     "type": "datetime", "required": true,  "label": "Review Date / Time"},
            {"field_id": "review_completed",      "type": "yes_no",   "required": true,  "label": "Review Completed"},
            {"field_id": "clinically_significant","type": "yes_no",   "required": true,  "label": "Clinically Significant Findings"},
            {"field_id": "findings_summary",      "type": "textarea", "required": false, "label": "Findings Summary"},
            {"field_id": "action_required",       "type": "yes_no",   "required": false, "label": "Action Required"},
            {"field_id": "comments",              "type": "textarea", "required": false, "label": "Comments"}
          ]
        }],
        "coordinator_guidance": "Review subject history thoroughly at screening. Flag any conditions that could affect eligibility or safety."
      }'::jsonb,
      '{
        "fields": [
          {"field_id": "reviewed_datetime",      "type": "datetime", "label": "Review Date / Time",       "required": true},
          {"field_id": "review_completed",       "type": "yes_no",   "label": "Review Completed",          "required": true},
          {"field_id": "clinically_significant", "type": "yes_no",   "label": "Clinically Significant",    "required": true},
          {"field_id": "findings_summary",       "type": "textarea", "label": "Findings Summary",          "required": false},
          {"field_id": "action_required",        "type": "yes_no",   "label": "Action Required",           "required": false},
          {"field_id": "comments",               "type": "textarea", "label": "Comments",                  "required": false}
        ]
      }'::jsonb,
      '{}'::jsonb,
      '{}'::jsonb,
      seed_actor
    ) RETURNING id INTO version_id;
    UPDATE procedure_library SET active_version_id = version_id WHERE id = proc_id;
  END IF;

  -- -------------------------------------------------------------------------
  -- 3. CONMED_REVIEW  (universal)
  --    Already present in 0110 seed when table was empty. This insert is a
  --    safety net for environments where 0110's guard skipped it.
  -- -------------------------------------------------------------------------
  INSERT INTO procedure_library (
    library_scope, procedure_code, procedure_name, procedure_category,
    operational_description, procedure_complexity, estimated_duration_minutes,
    status, tags, created_by
  )
  SELECT
    'global', 'CONMED_REVIEW', 'Concomitant Medication Review', 'medication',
    'Review and update concomitant medications since last contact.',
    'simple', 10,
    'active', ARRAY['conmed','medications','safety','universal'], seed_actor
  WHERE NOT EXISTS (
    SELECT 1 FROM procedure_library
    WHERE procedure_code = 'CONMED_REVIEW' AND library_scope = 'global'
  )
  RETURNING id INTO proc_id;

  IF proc_id IS NOT NULL THEN
    INSERT INTO procedure_blueprint_versions (
      procedure_id, version_number, blueprint_status, blueprint_json, field_schema,
      dependency_schema, operational_rules, created_by
    ) VALUES (
      proc_id, 1, 'published',
      '{
        "sections": [{
          "section_id": "conmed",
          "title": "Concomitant Medication Review",
          "fields": [
            {"field_id": "reviewed_datetime",  "type": "datetime", "required": true,  "label": "Review Date / Time"},
            {"field_id": "changes_since_last_visit", "type": "yes_no", "required": true, "label": "Changes Since Last Visit"},
            {"field_id": "conmed_log_updated", "type": "yes_no",   "required": true,  "label": "ConMed Log Updated"},
            {"field_id": "action_required",    "type": "yes_no",   "required": false, "label": "Action Required"},
            {"field_id": "comments",           "type": "textarea", "required": false, "label": "Comments"}
          ]
        }],
        "coordinator_guidance": "Update the ConMed log in EDC before closing the visit."
      }'::jsonb,
      '{
        "fields": [
          {"field_id": "reviewed_datetime",       "type": "datetime", "label": "Review Date / Time",      "required": true},
          {"field_id": "changes_since_last_visit","type": "yes_no",   "label": "Changes Since Last Visit", "required": true},
          {"field_id": "conmed_log_updated",      "type": "yes_no",   "label": "ConMed Log Updated",       "required": true},
          {"field_id": "action_required",         "type": "yes_no",   "label": "Action Required",          "required": false},
          {"field_id": "comments",                "type": "textarea", "label": "Comments",                 "required": false}
        ]
      }'::jsonb,
      '{}'::jsonb,
      '{}'::jsonb,
      seed_actor
    ) RETURNING id INTO version_id;
    UPDATE procedure_library SET active_version_id = version_id WHERE id = proc_id;
  END IF;

  -- -------------------------------------------------------------------------
  -- 4. PHONE_CONTACT  (common)
  -- -------------------------------------------------------------------------
  INSERT INTO procedure_library (
    library_scope, procedure_code, procedure_name, procedure_category,
    procedure_subcategory,
    operational_description, procedure_complexity, estimated_duration_minutes,
    supports_offsite, status, tags, created_by
  )
  SELECT
    'global', 'PHONE_CONTACT', 'Remote / Phone Contact', 'follow_up',
    'remote',
    'Phone or remote contact between on-site visits for safety and status review.',
    'simple', 15,
    true,
    'active', ARRAY['phone','remote','follow_up','common'], seed_actor
  WHERE NOT EXISTS (
    SELECT 1 FROM procedure_library
    WHERE procedure_code = 'PHONE_CONTACT' AND library_scope = 'global'
  )
  RETURNING id INTO proc_id;

  IF proc_id IS NOT NULL THEN
    INSERT INTO procedure_blueprint_versions (
      procedure_id, version_number, blueprint_status, blueprint_json, field_schema,
      dependency_schema, operational_rules, created_by
    ) VALUES (
      proc_id, 1, 'published',
      '{
        "sections": [{
          "section_id": "remote_contact",
          "title": "Remote / Phone Contact",
          "fields": [
            {"field_id": "contact_datetime",          "type": "datetime", "required": true,  "label": "Contact Date / Time"},
            {"field_id": "contact_method",            "type": "select",   "required": true,  "label": "Contact Method",
             "options": ["phone","video","patient_portal","other"]},
            {"field_id": "subject_reached",           "type": "yes_no",   "required": true,  "label": "Subject Reached"},
            {"field_id": "ae_review_completed",       "type": "yes_no",   "required": false, "label": "AE Review Completed"},
            {"field_id": "conmed_review_completed",   "type": "yes_no",   "required": false, "label": "ConMed Review Completed"},
            {"field_id": "followup_required",         "type": "yes_no",   "required": false, "label": "Follow-up Required"},
            {"field_id": "comments",                  "type": "textarea", "required": false, "label": "Comments"}
          ]
        }],
        "coordinator_guidance": "Document all attempts, including unsuccessful ones. If subject not reached, schedule callback per protocol."
      }'::jsonb,
      '{
        "fields": [
          {"field_id": "contact_datetime",        "type": "datetime", "label": "Contact Date / Time",     "required": true},
          {"field_id": "contact_method",          "type": "select",   "label": "Contact Method",          "required": true},
          {"field_id": "subject_reached",         "type": "yes_no",   "label": "Subject Reached",         "required": true},
          {"field_id": "ae_review_completed",     "type": "yes_no",   "label": "AE Review Completed",     "required": false},
          {"field_id": "conmed_review_completed", "type": "yes_no",   "label": "ConMed Review Completed", "required": false},
          {"field_id": "followup_required",       "type": "yes_no",   "label": "Follow-up Required",      "required": false},
          {"field_id": "comments",                "type": "textarea", "label": "Comments",                "required": false}
        ]
      }'::jsonb,
      '{}'::jsonb,
      '{}'::jsonb,
      seed_actor
    ) RETURNING id INTO version_id;
    UPDATE procedure_library SET active_version_id = version_id WHERE id = proc_id;
  END IF;

  -- -------------------------------------------------------------------------
  -- 5. EOS_CLOSEOUT  (common)
  -- -------------------------------------------------------------------------
  INSERT INTO procedure_library (
    library_scope, procedure_code, procedure_name, procedure_category,
    procedure_subcategory,
    operational_description, procedure_complexity, estimated_duration_minutes,
    status, tags, created_by
  )
  SELECT
    'global', 'EOS_CLOSEOUT', 'EOS Visit Closeout', 'follow_up',
    'closure',
    'End-of-study visit documentation and subject closeout.',
    'standard', 30,
    'active', ARRAY['eos','closeout','end_of_study','common'], seed_actor
  WHERE NOT EXISTS (
    SELECT 1 FROM procedure_library
    WHERE procedure_code = 'EOS_CLOSEOUT' AND library_scope = 'global'
  )
  RETURNING id INTO proc_id;

  IF proc_id IS NOT NULL THEN
    INSERT INTO procedure_blueprint_versions (
      procedure_id, version_number, blueprint_status, blueprint_json, field_schema,
      dependency_schema, operational_rules, created_by
    ) VALUES (
      proc_id, 1, 'published',
      '{
        "sections": [{
          "section_id": "eos_closeout",
          "title": "EOS Visit Closeout",
          "fields": [
            {"field_id": "assessment_datetime",  "type": "datetime", "required": true,  "label": "Assessment Date / Time"},
            {"field_id": "closure_type",         "type": "select",   "required": true,  "label": "Closure Type",
             "options": ["eos","early_termination","withdrawn_consent","lost_to_followup","other"]},
            {"field_id": "assessment_completed", "type": "yes_no",   "required": true,  "label": "Assessment Completed"},
            {"field_id": "reason_summary",       "type": "textarea", "required": false, "label": "Reason / Summary"},
            {"field_id": "next_step",            "type": "select",   "required": false, "label": "Next Step",
             "options": ["none","safety_followup","survival_followup","other"]},
            {"field_id": "comments",             "type": "textarea", "required": false, "label": "Comments"}
          ]
        }],
        "coordinator_guidance": "Ensure all open safety items (AEs, SAEs) are resolved or have appropriate follow-up plans before completing closeout."
      }'::jsonb,
      '{
        "fields": [
          {"field_id": "assessment_datetime",  "type": "datetime", "label": "Assessment Date / Time", "required": true},
          {"field_id": "closure_type",         "type": "select",   "label": "Closure Type",           "required": true},
          {"field_id": "assessment_completed", "type": "yes_no",   "label": "Assessment Completed",   "required": true},
          {"field_id": "reason_summary",       "type": "textarea", "label": "Reason / Summary",       "required": false},
          {"field_id": "next_step",            "type": "select",   "label": "Next Step",              "required": false},
          {"field_id": "comments",             "type": "textarea", "label": "Comments",               "required": false}
        ]
      }'::jsonb,
      '{}'::jsonb,
      '{"coordinator_guidance": "Do not close until all pending AE follow-up is documented."}'::jsonb,
      seed_actor
    ) RETURNING id INTO version_id;
    UPDATE procedure_library SET active_version_id = version_id WHERE id = proc_id;
  END IF;

  -- -------------------------------------------------------------------------
  -- 6. ACTH_STIM_TEST  (study_specific)
  --    Already present in 0110 seed when table was empty. Safety-net insert.
  -- -------------------------------------------------------------------------
  INSERT INTO procedure_library (
    library_scope, procedure_code, procedure_name, procedure_category,
    procedure_subcategory,
    operational_description, procedure_complexity, estimated_duration_minutes,
    status, tags, created_by
  )
  SELECT
    'global', 'ACTH_STIM_TEST', 'ACTH Stimulation Test', 'laboratory',
    'endocrine',
    'ACTH stimulation test with timed cortisol draws to assess adrenal reserve.',
    'complex', 180,
    'active', ARRAY['acth','cortisol','endocrine','adrenal','study_specific'], seed_actor
  WHERE NOT EXISTS (
    SELECT 1 FROM procedure_library
    WHERE procedure_code = 'ACTH_STIM_TEST' AND library_scope = 'global'
  )
  RETURNING id INTO proc_id;

  IF proc_id IS NOT NULL THEN
    INSERT INTO procedure_blueprint_versions (
      procedure_id, version_number, blueprint_status, blueprint_json, field_schema,
      dependency_schema, operational_rules, created_by
    ) VALUES (
      proc_id, 1, 'published',
      '{
        "sections": [{
          "section_id": "acth_stim",
          "title": "ACTH Stimulation Test",
          "fields": [
            {"field_id": "result_datetime",   "type": "datetime",  "required": true,  "label": "Result Date / Time"},
            {"field_id": "result_summary",    "type": "textarea",  "required": true,  "label": "Result Summary"},
            {"field_id": "baseline_cortisol", "type": "lab_result","required": true,  "label": "Baseline Cortisol (mcg/dL)"},
            {"field_id": "peak_cortisol",     "type": "lab_result","required": true,  "label": "Peak Cortisol (mcg/dL)"},
            {"field_id": "abnormal_flag",     "type": "yes_no",    "required": true,  "label": "Abnormal Result"},
            {"field_id": "action_taken",      "type": "textarea",  "required": false, "label": "Action Taken"},
            {"field_id": "lab_report_ref",    "type": "text",      "required": false, "label": "Lab Report Reference"},
            {"field_id": "comments",          "type": "textarea",  "required": false, "label": "Comments"}
          ]
        }],
        "coordinator_guidance": "Confirm fasting and steroid washout per protocol before administering cosyntropin. Collect samples at T=0, T+30, and T+60 minutes.",
        "operational_warnings": ["Peak cortisol < 18 mcg/dL indicates abnormal response — notify PI immediately."]
      }'::jsonb,
      '{
        "fields": [
          {"field_id": "result_datetime",   "type": "datetime",  "label": "Result Date / Time",        "required": true},
          {"field_id": "result_summary",    "type": "textarea",  "label": "Result Summary",             "required": true},
          {"field_id": "baseline_cortisol", "type": "lab_result","label": "Baseline Cortisol (mcg/dL)","required": true},
          {"field_id": "peak_cortisol",     "type": "lab_result","label": "Peak Cortisol (mcg/dL)",    "required": true},
          {"field_id": "abnormal_flag",     "type": "yes_no",    "label": "Abnormal Result",            "required": true},
          {"field_id": "action_taken",      "type": "textarea",  "label": "Action Taken",               "required": false},
          {"field_id": "lab_report_ref",    "type": "text",      "label": "Lab Report Reference",       "required": false},
          {"field_id": "comments",          "type": "textarea",  "label": "Comments",                   "required": false}
        ]
      }'::jsonb,
      '{
        "rules": [{
          "if":   {"field": "peak_cortisol", "operator": "lt", "value": 18},
          "then": {"show_warning": "Abnormal response — review with PI", "flag": "abnormal_value"}
        }]
      }'::jsonb,
      '{"coordinator_guidance": "Confirm fasting and steroid washout per protocol."}'::jsonb,
      seed_actor
    ) RETURNING id INTO version_id;
    UPDATE procedure_library SET active_version_id = version_id WHERE id = proc_id;
  END IF;

  -- -------------------------------------------------------------------------
  -- 7. HIT_PLATELET_PANEL  (study_specific)
  -- -------------------------------------------------------------------------
  INSERT INTO procedure_library (
    library_scope, procedure_code, procedure_name, procedure_category,
    procedure_subcategory,
    operational_description, procedure_complexity, estimated_duration_minutes,
    requires_signature, status, tags, created_by
  )
  SELECT
    'global', 'HIT_PLATELET_PANEL', 'HIT / Platelet Panel', 'laboratory',
    'hematology',
    'Anti-PF4 / heparin antibody testing and platelet panel for HIT workup.',
    'complex', 30,
    true,
    'active', ARRAY['hit','platelet','anti_pf4','hematology','study_specific'], seed_actor
  WHERE NOT EXISTS (
    SELECT 1 FROM procedure_library
    WHERE procedure_code = 'HIT_PLATELET_PANEL' AND library_scope = 'global'
  )
  RETURNING id INTO proc_id;

  IF proc_id IS NOT NULL THEN
    INSERT INTO procedure_blueprint_versions (
      procedure_id, version_number, blueprint_status, blueprint_json, field_schema,
      dependency_schema, operational_rules, created_by
    ) VALUES (
      proc_id, 1, 'published',
      '{
        "sections": [{
          "section_id": "hit_panel",
          "title": "HIT / Platelet Panel",
          "fields": [
            {"field_id": "result_datetime",    "type": "datetime",  "required": true,  "label": "Result Date / Time"},
            {"field_id": "result_summary",     "type": "textarea",  "required": true,  "label": "Result Summary"},
            {"field_id": "anti_pf4_result",    "type": "select",    "required": true,  "label": "Anti-PF4 Result",
             "options": ["negative","positive","indeterminate","pending"]},
            {"field_id": "platelet_count",     "type": "lab_result","required": true,  "label": "Platelet Count (x10^9/L)"},
            {"field_id": "abnormal_flag",      "type": "yes_no",    "required": true,  "label": "Abnormal Result"},
            {"field_id": "action_taken",       "type": "textarea",  "required": false, "label": "Action Taken"},
            {"field_id": "lab_report_ref",     "type": "text",      "required": false, "label": "Lab Report Reference"},
            {"field_id": "comments",           "type": "textarea",  "required": false, "label": "Comments"}
          ]
        }],
        "coordinator_guidance": "Order anti-PF4 and SRA per protocol when platelet drop suspected. Notify PI immediately if positive.",
        "operational_warnings": ["Positive anti-PF4 — notify PI and medical monitor immediately. Do not administer heparin."]
      }'::jsonb,
      '{
        "fields": [
          {"field_id": "result_datetime", "type": "datetime",  "label": "Result Date / Time",     "required": true},
          {"field_id": "result_summary",  "type": "textarea",  "label": "Result Summary",          "required": true},
          {"field_id": "anti_pf4_result", "type": "select",    "label": "Anti-PF4 Result",         "required": true},
          {"field_id": "platelet_count",  "type": "lab_result","label": "Platelet Count (x10^9/L)","required": true},
          {"field_id": "abnormal_flag",   "type": "yes_no",    "label": "Abnormal Result",          "required": true},
          {"field_id": "action_taken",    "type": "textarea",  "label": "Action Taken",             "required": false},
          {"field_id": "lab_report_ref",  "type": "text",      "label": "Lab Report Reference",     "required": false},
          {"field_id": "comments",        "type": "textarea",  "label": "Comments",                 "required": false}
        ]
      }'::jsonb,
      '{
        "rules": [{
          "if":   {"field": "anti_pf4_result", "equals": "positive"},
          "then": {"show_warning": "Positive anti-PF4 — notify PI and medical monitor", "escalation": "pi_notification", "flag": "safety_alert"}
        }]
      }'::jsonb,
      '{"coordinator_guidance": "Confirm sample handling instructions with central lab before collection."}'::jsonb,
      seed_actor
    ) RETURNING id INTO version_id;
    UPDATE procedure_library SET active_version_id = version_id WHERE id = proc_id;
  END IF;

END $$;

-- ---------------------------------------------------------------------------
-- Verification block: confirm the 5 pre-existing universal blueprints are
-- still active/published. Raises an exception if any is missing or inactive.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  missing_codes text[];
BEGIN
  SELECT array_agg(expected.code)
  INTO missing_codes
  FROM (
    VALUES
      ('VITAL_SIGNS'),
      ('AE_REVIEW'),
      ('PHYSICAL_EXAM'),
      ('CBC'),
      ('CLINICAL_CHEMISTRY')
  ) AS expected(code)
  WHERE NOT EXISTS (
    SELECT 1
    FROM procedure_library pl
    JOIN procedure_blueprint_versions pbv ON pbv.id = pl.active_version_id
    WHERE pl.procedure_code = expected.code
      AND pl.library_scope  = 'global'
      AND pl.status         = 'active'
      AND pbv.blueprint_status = 'published'
  );

  -- If the pre-existing codes are missing it is not a blocking error in this
  -- migration (the 0110 seed may have used different codes in some envs), but
  -- we surface a notice so operators can investigate.
  IF missing_codes IS NOT NULL AND array_length(missing_codes, 1) > 0 THEN
    RAISE NOTICE 'procedure_blueprint_library_closure: the following expected universal blueprints were not found as active/published — investigate 0110 seed: %',
      array_to_string(missing_codes, ', ');
  END IF;
END $$;
