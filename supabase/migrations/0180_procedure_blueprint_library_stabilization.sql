-- Migration 0180: Procedure Blueprint Library Stabilization
--
-- Task 1: Archive legacy ACTH_STIM (superseded by ACTH_STIM_TEST seeded in 0179)
-- Task 2: Seed CLINICAL_CHEMISTRY with LAB_CORE_V1 field schema
-- Task 3: Publish v2 blueprint versions for VITAL_SIGNS, AE_REVIEW,
--         PHYSICAL_EXAM, CONMED_REVIEW using canonical-clinical-library.v1.json
-- Task 4: Verification block (RAISE NOTICE — non-blocking)
--
-- All inserts are idempotent (WHERE NOT EXISTS or SELECT...WHERE NOT EXISTS).
-- No historical rows are deleted.
-- blueprint_status values: 'draft' | 'published' | 'archived'  (per 0110 constraint)
-- library status values:   'active' | 'inactive' | 'draft' | 'archived' (per 0110 constraint)

-- ---------------------------------------------------------------------------
-- Task 1: Archive legacy ACTH_STIM
-- ---------------------------------------------------------------------------

-- Mark the blueprint versions archived (does not touch immutable payload columns)
UPDATE procedure_blueprint_versions
SET    blueprint_status = 'archived'
WHERE  procedure_id = (
         SELECT id FROM procedure_library
         WHERE  procedure_code  = 'ACTH_STIM'
           AND  library_scope   = 'global'
       )
  AND  blueprint_status <> 'archived';

-- Mark the library row archived
UPDATE procedure_library
SET    status      = 'archived',
       updated_at  = now()
WHERE  procedure_code = 'ACTH_STIM'
  AND  library_scope  = 'global'
  AND  status        <> 'archived';

-- ---------------------------------------------------------------------------
-- Task 2: Seed CLINICAL_CHEMISTRY
-- ---------------------------------------------------------------------------

DO $$
DECLARE
  seed_actor uuid := '00000000-0000-4000-8000-000000000001';
  v_lib_id   uuid;
  v_ver_id   uuid;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM procedure_library
    WHERE  procedure_code = 'CLINICAL_CHEMISTRY'
      AND  library_scope  = 'global'
  ) THEN

    INSERT INTO procedure_library (
      library_scope,
      procedure_code,
      procedure_name,
      procedure_category,
      procedure_subcategory,
      operational_description,
      procedure_complexity,
      estimated_duration_minutes,
      status,
      tags,
      created_by
    ) VALUES (
      'global',
      'CLINICAL_CHEMISTRY',
      'Clinical Chemistry',
      'laboratory',
      'chemistry',
      'Clinical chemistry panel collection and result documentation.',
      'standard',
      15,
      'active',
      ARRAY['lab','chemistry','safety','common'],
      seed_actor
    ) RETURNING id INTO v_lib_id;

    INSERT INTO procedure_blueprint_versions (
      procedure_id,
      version_number,
      blueprint_status,
      blueprint_json,
      field_schema,
      dependency_schema,
      operational_rules,
      created_by
    ) VALUES (
      v_lib_id,
      1,
      'published',
      '{
        "sections": [{
          "section_id": "clinical_chemistry",
          "title": "Clinical Chemistry",
          "fields": [
            {"field_id": "collection_datetime",      "type": "datetime", "required": true,  "label": "Collection Date / Time"},
            {"field_id": "fasting_status",           "type": "select",   "required": false, "label": "Fasting Status",
             "options": ["fasting","non_fasting","unknown"]},
            {"field_id": "fasting_hours",            "type": "integer",  "required": false, "label": "Fasting Hours"},
            {"field_id": "specimen_type",            "type": "select",   "required": true,  "label": "Specimen Type",
             "options": ["blood","urine","other"]},
            {"field_id": "accession_number",         "type": "text",     "required": false, "label": "Accession Number"},
            {"field_id": "local_vs_central",         "type": "select",   "required": false, "label": "Local vs Central",
             "options": ["local","central"]},
            {"field_id": "processing_status",        "type": "select",   "required": false, "label": "Processing Status",
             "options": ["collected","in_transit","received","resulted","cancelled"]},
            {"field_id": "local_lab_normal_range",   "type": "text",     "required": false, "label": "Local Lab Normal Range"},
            {"field_id": "abnormal_flag",            "type": "select",   "required": false, "label": "Abnormal Flag",
             "options": ["yes","no"]},
            {"field_id": "clinically_significant",   "type": "select",   "required": false, "label": "Clinically Significant",
             "options": ["yes","no"]},
            {"field_id": "clinical_comment",         "type": "textarea", "required": false, "label": "Clinical Comment"},
            {"field_id": "repeat_required",          "type": "select",   "required": false, "label": "Repeat Required",
             "options": ["yes","no"]},
            {"field_id": "repeat_reason",            "type": "textarea", "required": false, "label": "Repeat Reason"},
            {"field_id": "repeat_scheduled_date",    "type": "date",     "required": false, "label": "Repeat Scheduled Date"},
            {"field_id": "linked_ae",                "type": "select",   "required": false, "label": "Linked to AE",
             "options": ["yes","no"]},
            {"field_id": "linked_ae_id",             "type": "text",     "required": false, "label": "Linked AE ID"},
            {"field_id": "collected_by",             "type": "text",     "required": false, "label": "Collected By"},
            {"field_id": "shipped_datetime",         "type": "datetime", "required": false, "label": "Shipped Date / Time"},
            {"field_id": "received_by_lab",          "type": "select",   "required": false, "label": "Received by Lab",
             "options": ["yes","no"]}
          ]
        }],
        "coordinator_guidance": "Confirm fasting status before collection per protocol. Record accession number from lab requisition."
      }'::jsonb,
      '{
        "fields": [
          {"field_id": "collection_datetime",    "type": "datetime", "label": "Collection Date / Time", "required": true},
          {"field_id": "fasting_status",         "type": "select",   "label": "Fasting Status",         "required": false,
           "options": ["fasting","non_fasting","unknown"]},
          {"field_id": "fasting_hours",          "type": "integer",  "label": "Fasting Hours",          "required": false},
          {"field_id": "specimen_type",          "type": "select",   "label": "Specimen Type",          "required": true,
           "options": ["blood","urine","other"]},
          {"field_id": "accession_number",       "type": "text",     "label": "Accession Number",       "required": false},
          {"field_id": "local_vs_central",       "type": "select",   "label": "Local vs Central",       "required": false,
           "options": ["local","central"]},
          {"field_id": "processing_status",      "type": "select",   "label": "Processing Status",      "required": false,
           "options": ["collected","in_transit","received","resulted","cancelled"]},
          {"field_id": "local_lab_normal_range", "type": "text",     "label": "Local Lab Normal Range", "required": false},
          {"field_id": "abnormal_flag",          "type": "select",   "label": "Abnormal Flag",          "required": false,
           "options": ["yes","no"]},
          {"field_id": "clinically_significant", "type": "select",   "label": "Clinically Significant", "required": false,
           "options": ["yes","no"]},
          {"field_id": "clinical_comment",       "type": "textarea", "label": "Clinical Comment",       "required": false},
          {"field_id": "repeat_required",        "type": "select",   "label": "Repeat Required",        "required": false,
           "options": ["yes","no"]},
          {"field_id": "repeat_reason",          "type": "textarea", "label": "Repeat Reason",          "required": false},
          {"field_id": "repeat_scheduled_date",  "type": "date",     "label": "Repeat Scheduled Date",  "required": false},
          {"field_id": "linked_ae",              "type": "select",   "label": "Linked to AE",           "required": false,
           "options": ["yes","no"]},
          {"field_id": "linked_ae_id",           "type": "text",     "label": "Linked AE ID",           "required": false},
          {"field_id": "collected_by",           "type": "text",     "label": "Collected By",           "required": false},
          {"field_id": "shipped_datetime",       "type": "datetime", "label": "Shipped Date / Time",    "required": false},
          {"field_id": "received_by_lab",        "type": "select",   "label": "Received by Lab",        "required": false,
           "options": ["yes","no"]}
        ]
      }'::jsonb,
      '{
        "rules": [
          {
            "if":   {"field": "fasting_status", "equals": "fasting"},
            "then": {"require": ["fasting_hours"]}
          },
          {
            "if":   {"field": "clinically_significant", "equals": "yes"},
            "then": {"require": ["clinical_comment"]}
          },
          {
            "if":   {"field": "repeat_required", "equals": "yes"},
            "then": {"require": ["repeat_reason", "repeat_scheduled_date"]}
          },
          {
            "if":   {"field": "linked_ae", "equals": "yes"},
            "then": {"require": ["linked_ae_id"]}
          }
        ]
      }'::jsonb,
      '{"coordinator_guidance": "Confirm fasting status before collection. Record accession number from lab requisition."}'::jsonb,
      seed_actor
    ) RETURNING id INTO v_ver_id;

    UPDATE procedure_library
    SET    active_version_id = v_ver_id
    WHERE  id = v_lib_id;

  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- Task 3a: VITAL_SIGNS v2  (VITALS_CORE_V1 canonical fields)
-- ---------------------------------------------------------------------------

DO $$
DECLARE
  seed_actor uuid := '00000000-0000-4000-8000-000000000001';
  v_lib_id   uuid;
  v_ver_id   uuid;
BEGIN
  SELECT id INTO v_lib_id
  FROM   procedure_library
  WHERE  procedure_code = 'VITAL_SIGNS'
    AND  library_scope  = 'global';

  IF v_lib_id IS NULL THEN
    RAISE NOTICE 'SKIP: VITAL_SIGNS not found — cannot publish v2';
    RETURN;
  END IF;

  -- Check whether v2 already exists
  SELECT id INTO v_ver_id
  FROM   procedure_blueprint_versions
  WHERE  procedure_id    = v_lib_id
    AND  version_number  = 2;

  IF v_ver_id IS NOT NULL THEN
    -- v2 already exists — ensure active_version_id points to it
    UPDATE procedure_library
    SET    active_version_id = v_ver_id,
           updated_at        = now()
    WHERE  id = v_lib_id
      AND  active_version_id IS DISTINCT FROM v_ver_id;
    RAISE NOTICE 'SKIP: VITAL_SIGNS v2 already exists, active_version_id confirmed';
    RETURN;
  END IF;

  INSERT INTO procedure_blueprint_versions (
    procedure_id,
    version_number,
    blueprint_status,
    blueprint_json,
    field_schema,
    dependency_schema,
    operational_rules,
    created_by
  ) VALUES (
    v_lib_id,
    2,
    'published',
    '{
      "sections": [{
        "section_id": "vital_signs",
        "title": "Vital Signs",
        "fields": [
          {"field_id": "collection_datetime",      "type": "datetime", "required": true,  "label": "Collection Date / Time"},
          {"field_id": "heart_rate",               "type": "integer",  "required": false, "label": "Heart Rate (bpm)"},
          {"field_id": "respiratory_rate",         "type": "integer",  "required": false, "label": "Respiratory Rate (/min)"},
          {"field_id": "systolic_bp",              "type": "integer",  "required": false, "label": "Systolic Blood Pressure (mmHg)"},
          {"field_id": "diastolic_bp",             "type": "integer",  "required": false, "label": "Diastolic Blood Pressure (mmHg)"},
          {"field_id": "temperature",              "type": "number",   "required": false, "label": "Temperature"},
          {"field_id": "temperature_unit",         "type": "select",   "required": false, "label": "Temperature Unit",
           "options": ["C","F"]},
          {"field_id": "temperature_method",       "type": "select",   "required": false, "label": "Temperature Method",
           "options": ["oral","tympanic","axillary","temporal"]},
          {"field_id": "weight",                   "type": "number",   "required": false, "label": "Weight"},
          {"field_id": "weight_unit",              "type": "select",   "required": false, "label": "Weight Unit",
           "options": ["kg","lb"]},
          {"field_id": "height",                   "type": "number",   "required": false, "label": "Height"},
          {"field_id": "height_unit",              "type": "select",   "required": false, "label": "Height Unit",
           "options": ["cm","in"]},
          {"field_id": "bmi",                      "type": "number",   "required": false, "label": "BMI"},
          {"field_id": "body_position",            "type": "select",   "required": false, "label": "Body Position",
           "options": ["sitting","standing","supine","semi_fowler"]},
          {"field_id": "resting_duration_minutes", "type": "integer",  "required": false, "label": "Resting Duration (minutes)"},
          {"field_id": "collection_timepoint",     "type": "text",     "required": false, "label": "Collection Timepoint"},
          {"field_id": "pre_post_ip_timing",       "type": "select",   "required": false, "label": "Pre/Post IP Timing",
           "options": ["pre_ip","post_ip","not_applicable"]},
          {"field_id": "abnormal_flag",            "type": "select",   "required": false, "label": "Abnormal Flag",
           "options": ["yes","no"]},
          {"field_id": "clinically_significant",   "type": "select",   "required": false, "label": "Clinically Significant",
           "options": ["yes","no"]},
          {"field_id": "clinical_comment",         "type": "textarea", "required": false, "label": "Clinical Comment"},
          {"field_id": "collected_by",             "type": "text",     "required": false, "label": "Collected By"},
          {"field_id": "source_origin",            "type": "select",   "required": false, "label": "Source Origin",
           "options": ["vilo_esource","external_edc","central_lab","local_lab","site_file"]}
        ]
      }],
      "coordinator_guidance": "Record all measurements per protocol. Confirm resting duration before BP measurement. Note pre- or post-IP timing."
    }'::jsonb,
    '{
      "fields": [
        {"field_id": "collection_datetime",      "type": "datetime", "label": "Collection Date / Time",   "required": true},
        {"field_id": "heart_rate",               "type": "integer",  "label": "Heart Rate (bpm)",          "required": false},
        {"field_id": "respiratory_rate",         "type": "integer",  "label": "Respiratory Rate (/min)",   "required": false},
        {"field_id": "systolic_bp",              "type": "integer",  "label": "Systolic BP (mmHg)",        "required": false},
        {"field_id": "diastolic_bp",             "type": "integer",  "label": "Diastolic BP (mmHg)",       "required": false},
        {"field_id": "temperature",              "type": "number",   "label": "Temperature",               "required": false},
        {"field_id": "temperature_unit",         "type": "select",   "label": "Temperature Unit",          "required": false,
         "options": ["C","F"]},
        {"field_id": "temperature_method",       "type": "select",   "label": "Temperature Method",        "required": false,
         "options": ["oral","tympanic","axillary","temporal"]},
        {"field_id": "weight",                   "type": "number",   "label": "Weight",                    "required": false},
        {"field_id": "weight_unit",              "type": "select",   "label": "Weight Unit",               "required": false,
         "options": ["kg","lb"]},
        {"field_id": "height",                   "type": "number",   "label": "Height",                    "required": false},
        {"field_id": "height_unit",              "type": "select",   "label": "Height Unit",               "required": false,
         "options": ["cm","in"]},
        {"field_id": "bmi",                      "type": "number",   "label": "BMI",                       "required": false},
        {"field_id": "body_position",            "type": "select",   "label": "Body Position",             "required": false,
         "options": ["sitting","standing","supine","semi_fowler"]},
        {"field_id": "resting_duration_minutes", "type": "integer",  "label": "Resting Duration (minutes)","required": false},
        {"field_id": "collection_timepoint",     "type": "text",     "label": "Collection Timepoint",      "required": false},
        {"field_id": "pre_post_ip_timing",       "type": "select",   "label": "Pre/Post IP Timing",        "required": false,
         "options": ["pre_ip","post_ip","not_applicable"]},
        {"field_id": "abnormal_flag",            "type": "select",   "label": "Abnormal Flag",             "required": false,
         "options": ["yes","no"]},
        {"field_id": "clinically_significant",   "type": "select",   "label": "Clinically Significant",    "required": false,
         "options": ["yes","no"]},
        {"field_id": "clinical_comment",         "type": "textarea", "label": "Clinical Comment",          "required": false},
        {"field_id": "collected_by",             "type": "text",     "label": "Collected By",              "required": false},
        {"field_id": "source_origin",            "type": "select",   "label": "Source Origin",             "required": false,
         "options": ["vilo_esource","external_edc","central_lab","local_lab","site_file"]}
      ]
    }'::jsonb,
    '{
      "rules": [
        {
          "if":   {"field": "clinically_significant", "equals": "yes"},
          "then": {"require": ["clinical_comment"]}
        }
      ]
    }'::jsonb,
    '{"coordinator_guidance": "Confirm resting duration before measuring blood pressure. Note pre- or post-IP timing when applicable."}'::jsonb,
    seed_actor
  ) RETURNING id INTO v_ver_id;

  UPDATE procedure_library
  SET    active_version_id = v_ver_id,
         updated_at        = now()
  WHERE  id = v_lib_id;

  RAISE NOTICE 'OK: VITAL_SIGNS v2 inserted and active_version_id updated';
END $$;

-- ---------------------------------------------------------------------------
-- Task 3b: AE_REVIEW v2  (AE_CORE_V1 canonical fields)
-- ---------------------------------------------------------------------------

DO $$
DECLARE
  seed_actor uuid := '00000000-0000-4000-8000-000000000001';
  v_lib_id   uuid;
  v_ver_id   uuid;
BEGIN
  SELECT id INTO v_lib_id
  FROM   procedure_library
  WHERE  procedure_code = 'AE_REVIEW'
    AND  library_scope  = 'global';

  IF v_lib_id IS NULL THEN
    RAISE NOTICE 'SKIP: AE_REVIEW not found — cannot publish v2';
    RETURN;
  END IF;

  SELECT id INTO v_ver_id
  FROM   procedure_blueprint_versions
  WHERE  procedure_id   = v_lib_id
    AND  version_number = 2;

  IF v_ver_id IS NOT NULL THEN
    UPDATE procedure_library
    SET    active_version_id = v_ver_id,
           updated_at        = now()
    WHERE  id = v_lib_id
      AND  active_version_id IS DISTINCT FROM v_ver_id;
    RAISE NOTICE 'SKIP: AE_REVIEW v2 already exists, active_version_id confirmed';
    RETURN;
  END IF;

  INSERT INTO procedure_blueprint_versions (
    procedure_id,
    version_number,
    blueprint_status,
    blueprint_json,
    field_schema,
    dependency_schema,
    operational_rules,
    created_by
  ) VALUES (
    v_lib_id,
    2,
    'published',
    '{
      "sections": [{
        "section_id": "ae_review",
        "title": "Adverse Event Review",
        "fields": [
          {"field_id": "ae_term",                           "type": "text",      "required": true,  "label": "AE Term (verbatim)"},
          {"field_id": "ae_onset_datetime",                 "type": "datetime",  "required": true,  "label": "AE Onset Date / Time"},
          {"field_id": "ae_resolution_datetime",            "type": "datetime",  "required": false, "label": "AE Resolution Date / Time"},
          {"field_id": "ae_ongoing",                        "type": "select",    "required": true,  "label": "AE Ongoing",
           "options": ["yes","no"]},
          {"field_id": "ae_severity",                       "type": "select",    "required": true,  "label": "AE Severity",
           "options": ["mild","moderate","severe","life_threatening","fatal"]},
          {"field_id": "ae_serious",                        "type": "select",    "required": true,  "label": "Serious AE",
           "options": ["yes","no"]},
          {"field_id": "ae_seriousness_category",           "type": "text",      "required": false, "label": "Seriousness Category"},
          {"field_id": "ae_causality",                      "type": "select",    "required": false, "label": "Causality",
           "options": ["unrelated","unlikely","possible","probable","definite"]},
          {"field_id": "ae_expectedness",                   "type": "select",    "required": false, "label": "Expectedness",
           "options": ["yes","no"]},
          {"field_id": "ae_related_to_ip",                  "type": "select",    "required": false, "label": "Related to IP",
           "options": ["yes","no"]},
          {"field_id": "ae_action_taken",                   "type": "textarea",  "required": false, "label": "Action Taken"},
          {"field_id": "ae_outcome",                        "type": "select",    "required": true,  "label": "Outcome",
           "options": ["recovered","recovering","not_recovered","sequelae","fatal","unknown"]},
          {"field_id": "ae_followup_required",              "type": "select",    "required": false, "label": "Follow-up Required",
           "options": ["yes","no"]},
          {"field_id": "ae_followup_plan",                  "type": "textarea",  "required": false, "label": "Follow-up Plan"},
          {"field_id": "requires_medical_monitor_notification","type": "select", "required": false, "label": "Medical Monitor Notification Required",
           "options": ["yes","no"]},
          {"field_id": "requires_unblinding",               "type": "select",    "required": false, "label": "Requires Unblinding",
           "options": ["yes","no"]},
          {"field_id": "unblinding_comment",                "type": "textarea",  "required": false, "label": "Unblinding Reason / Comment"},
          {"field_id": "expedited_reporting_required",      "type": "select",    "required": false, "label": "Expedited Reporting Required",
           "options": ["yes","no"]},
          {"field_id": "meddra_soc",                        "type": "text",      "required": false, "label": "MedDRA SOC"},
          {"field_id": "meddra_hlgt",                       "type": "text",      "required": false, "label": "MedDRA HLGT"},
          {"field_id": "meddra_hlt",                        "type": "text",      "required": false, "label": "MedDRA HLT"},
          {"field_id": "meddra_pt",                         "type": "text",      "required": false, "label": "MedDRA PT"},
          {"field_id": "meddra_code",                       "type": "text",      "required": false, "label": "MedDRA Code"},
          {"field_id": "reported_by",                       "type": "text",      "required": false, "label": "Reported By"},
          {"field_id": "investigator_awareness_datetime",   "type": "datetime",  "required": false, "label": "Investigator Awareness Date / Time"}
        ]
      }],
      "coordinator_guidance": "Document all adverse events since last contact. Complete all required fields before closing the visit."
    }'::jsonb,
    '{
      "fields": [
        {"field_id": "ae_term",                            "type": "text",     "label": "AE Term (verbatim)",                   "required": true},
        {"field_id": "ae_onset_datetime",                  "type": "datetime", "label": "AE Onset Date / Time",                 "required": true},
        {"field_id": "ae_resolution_datetime",             "type": "datetime", "label": "AE Resolution Date / Time",            "required": false},
        {"field_id": "ae_ongoing",                         "type": "select",   "label": "AE Ongoing",                           "required": true,
         "options": ["yes","no"]},
        {"field_id": "ae_severity",                        "type": "select",   "label": "AE Severity",                          "required": true,
         "options": ["mild","moderate","severe","life_threatening","fatal"]},
        {"field_id": "ae_serious",                         "type": "select",   "label": "Serious AE",                           "required": true,
         "options": ["yes","no"]},
        {"field_id": "ae_seriousness_category",            "type": "text",     "label": "Seriousness Category",                 "required": false},
        {"field_id": "ae_causality",                       "type": "select",   "label": "Causality",                            "required": false,
         "options": ["unrelated","unlikely","possible","probable","definite"]},
        {"field_id": "ae_expectedness",                    "type": "select",   "label": "Expectedness",                         "required": false,
         "options": ["yes","no"]},
        {"field_id": "ae_related_to_ip",                   "type": "select",   "label": "Related to IP",                        "required": false,
         "options": ["yes","no"]},
        {"field_id": "ae_action_taken",                    "type": "textarea", "label": "Action Taken",                         "required": false},
        {"field_id": "ae_outcome",                         "type": "select",   "label": "Outcome",                              "required": true,
         "options": ["recovered","recovering","not_recovered","sequelae","fatal","unknown"]},
        {"field_id": "ae_followup_required",               "type": "select",   "label": "Follow-up Required",                   "required": false,
         "options": ["yes","no"]},
        {"field_id": "ae_followup_plan",                   "type": "textarea", "label": "Follow-up Plan",                       "required": false},
        {"field_id": "requires_medical_monitor_notification","type":"select",  "label": "Medical Monitor Notification Required","required": false,
         "options": ["yes","no"]},
        {"field_id": "requires_unblinding",                "type": "select",   "label": "Requires Unblinding",                  "required": false,
         "options": ["yes","no"]},
        {"field_id": "unblinding_comment",                 "type": "textarea", "label": "Unblinding Reason / Comment",          "required": false},
        {"field_id": "expedited_reporting_required",       "type": "select",   "label": "Expedited Reporting Required",         "required": false,
         "options": ["yes","no"]},
        {"field_id": "meddra_soc",                         "type": "text",     "label": "MedDRA SOC",                           "required": false},
        {"field_id": "meddra_hlgt",                        "type": "text",     "label": "MedDRA HLGT",                          "required": false},
        {"field_id": "meddra_hlt",                         "type": "text",     "label": "MedDRA HLT",                           "required": false},
        {"field_id": "meddra_pt",                          "type": "text",     "label": "MedDRA PT",                            "required": false},
        {"field_id": "meddra_code",                        "type": "text",     "label": "MedDRA Code",                          "required": false},
        {"field_id": "reported_by",                        "type": "text",     "label": "Reported By",                          "required": false},
        {"field_id": "investigator_awareness_datetime",    "type": "datetime", "label": "Investigator Awareness Date / Time",   "required": false}
      ]
    }'::jsonb,
    '{
      "rules": [
        {
          "if":   {"field": "ae_ongoing", "equals": "no"},
          "then": {"require": ["ae_resolution_datetime"]}
        },
        {
          "if":   {"field": "ae_serious", "equals": "yes"},
          "then": {"require": ["ae_seriousness_category"]}
        },
        {
          "if":   {"field": "ae_followup_required", "equals": "yes"},
          "then": {"require": ["ae_followup_plan"]}
        },
        {
          "if":   {"field": "requires_unblinding", "equals": "yes"},
          "then": {"require": ["unblinding_comment"]}
        }
      ]
    }'::jsonb,
    '{"coordinator_guidance": "Document all AEs since last contact. Escalate SAEs per protocol reporting timelines."}'::jsonb,
    seed_actor
  ) RETURNING id INTO v_ver_id;

  UPDATE procedure_library
  SET    active_version_id = v_ver_id,
         updated_at        = now()
  WHERE  id = v_lib_id;

  RAISE NOTICE 'OK: AE_REVIEW v2 inserted and active_version_id updated';
END $$;

-- ---------------------------------------------------------------------------
-- Task 3c: PHYSICAL_EXAM v2  (PHYSICAL_EXAM_CORE_V1 canonical fields)
-- ---------------------------------------------------------------------------

DO $$
DECLARE
  seed_actor uuid := '00000000-0000-4000-8000-000000000001';
  v_lib_id   uuid;
  v_ver_id   uuid;
BEGIN
  SELECT id INTO v_lib_id
  FROM   procedure_library
  WHERE  procedure_code = 'PHYSICAL_EXAM'
    AND  library_scope  = 'global';

  IF v_lib_id IS NULL THEN
    RAISE NOTICE 'SKIP: PHYSICAL_EXAM not found — cannot publish v2';
    RETURN;
  END IF;

  SELECT id INTO v_ver_id
  FROM   procedure_blueprint_versions
  WHERE  procedure_id   = v_lib_id
    AND  version_number = 2;

  IF v_ver_id IS NOT NULL THEN
    UPDATE procedure_library
    SET    active_version_id = v_ver_id,
           updated_at        = now()
    WHERE  id = v_lib_id
      AND  active_version_id IS DISTINCT FROM v_ver_id;
    RAISE NOTICE 'SKIP: PHYSICAL_EXAM v2 already exists, active_version_id confirmed';
    RETURN;
  END IF;

  INSERT INTO procedure_blueprint_versions (
    procedure_id,
    version_number,
    blueprint_status,
    blueprint_json,
    field_schema,
    dependency_schema,
    operational_rules,
    created_by
  ) VALUES (
    v_lib_id,
    2,
    'published',
    '{
      "sections": [{
        "section_id": "physical_exam",
        "title": "Physical Examination",
        "fields": [
          {"field_id": "exam_performed",          "type": "select",   "required": true,  "label": "Physical Exam Performed",
           "options": ["yes","no"]},
          {"field_id": "exam_datetime",           "type": "datetime", "required": false, "label": "Exam Date / Time"},
          {"field_id": "overall_normal",          "type": "select",   "required": false, "label": "Overall Normal",
           "options": ["yes","no"]},
          {"field_id": "cardiovascular_review",   "type": "textarea", "required": false, "label": "Cardiovascular Review"},
          {"field_id": "respiratory_review",      "type": "textarea", "required": false, "label": "Respiratory Review"},
          {"field_id": "gi_review",               "type": "textarea", "required": false, "label": "GI Review"},
          {"field_id": "neuro_review",            "type": "textarea", "required": false, "label": "Neurologic Review"},
          {"field_id": "musculoskeletal_review",  "type": "textarea", "required": false, "label": "Musculoskeletal Review"},
          {"field_id": "skin_review",             "type": "textarea", "required": false, "label": "Skin Review"},
          {"field_id": "targeted_exam_reason",    "type": "textarea", "required": false, "label": "Targeted Exam Reason"},
          {"field_id": "abnormal_findings",       "type": "textarea", "required": false, "label": "Abnormal Findings"},
          {"field_id": "clinically_significant",  "type": "select",   "required": false, "label": "Clinically Significant",
           "options": ["yes","no"]},
          {"field_id": "investigator_comment",    "type": "textarea", "required": false, "label": "Investigator Comment"}
        ]
      }],
      "coordinator_guidance": "Document all systems reviewed. If abnormal findings present, ensure clinically significant field is completed and PI has reviewed."
    }'::jsonb,
    '{
      "fields": [
        {"field_id": "exam_performed",         "type": "select",   "label": "Physical Exam Performed", "required": true,
         "options": ["yes","no"]},
        {"field_id": "exam_datetime",          "type": "datetime", "label": "Exam Date / Time",        "required": false},
        {"field_id": "overall_normal",         "type": "select",   "label": "Overall Normal",          "required": false,
         "options": ["yes","no"]},
        {"field_id": "cardiovascular_review",  "type": "textarea", "label": "Cardiovascular Review",   "required": false},
        {"field_id": "respiratory_review",     "type": "textarea", "label": "Respiratory Review",      "required": false},
        {"field_id": "gi_review",              "type": "textarea", "label": "GI Review",               "required": false},
        {"field_id": "neuro_review",           "type": "textarea", "label": "Neurologic Review",       "required": false},
        {"field_id": "musculoskeletal_review", "type": "textarea", "label": "Musculoskeletal Review",  "required": false},
        {"field_id": "skin_review",            "type": "textarea", "label": "Skin Review",             "required": false},
        {"field_id": "targeted_exam_reason",   "type": "textarea", "label": "Targeted Exam Reason",    "required": false},
        {"field_id": "abnormal_findings",      "type": "textarea", "label": "Abnormal Findings",       "required": false},
        {"field_id": "clinically_significant", "type": "select",   "label": "Clinically Significant",  "required": false,
         "options": ["yes","no"]},
        {"field_id": "investigator_comment",   "type": "textarea", "label": "Investigator Comment",    "required": false}
      ]
    }'::jsonb,
    '{
      "rules": [
        {
          "if":   {"field": "exam_performed", "equals": "yes"},
          "then": {"require": ["exam_datetime"]}
        },
        {
          "if":   {"field": "overall_normal", "equals": "no"},
          "then": {"require": ["abnormal_findings"]}
        },
        {
          "if":   {"field": "clinically_significant", "equals": "yes"},
          "then": {"require": ["investigator_comment"]}
        }
      ]
    }'::jsonb,
    '{"coordinator_guidance": "If abnormal findings present, document in abnormal_findings and confirm clinically_significant with PI."}'::jsonb,
    seed_actor
  ) RETURNING id INTO v_ver_id;

  UPDATE procedure_library
  SET    active_version_id = v_ver_id,
         updated_at        = now()
  WHERE  id = v_lib_id;

  RAISE NOTICE 'OK: PHYSICAL_EXAM v2 inserted and active_version_id updated';
END $$;

-- ---------------------------------------------------------------------------
-- Task 3d: CONMED_REVIEW v2  (CONMED_CORE_V1 + visit-level review fields)
-- ---------------------------------------------------------------------------

DO $$
DECLARE
  seed_actor uuid := '00000000-0000-4000-8000-000000000001';
  v_lib_id   uuid;
  v_ver_id   uuid;
BEGIN
  SELECT id INTO v_lib_id
  FROM   procedure_library
  WHERE  procedure_code = 'CONMED_REVIEW'
    AND  library_scope  = 'global';

  IF v_lib_id IS NULL THEN
    RAISE NOTICE 'SKIP: CONMED_REVIEW not found — cannot publish v2';
    RETURN;
  END IF;

  SELECT id INTO v_ver_id
  FROM   procedure_blueprint_versions
  WHERE  procedure_id   = v_lib_id
    AND  version_number = 2;

  IF v_ver_id IS NOT NULL THEN
    UPDATE procedure_library
    SET    active_version_id = v_ver_id,
           updated_at        = now()
    WHERE  id = v_lib_id
      AND  active_version_id IS DISTINCT FROM v_ver_id;
    RAISE NOTICE 'SKIP: CONMED_REVIEW v2 already exists, active_version_id confirmed';
    RETURN;
  END IF;

  INSERT INTO procedure_blueprint_versions (
    procedure_id,
    version_number,
    blueprint_status,
    blueprint_json,
    field_schema,
    dependency_schema,
    operational_rules,
    created_by
  ) VALUES (
    v_lib_id,
    2,
    'published',
    '{
      "sections": [
        {
          "section_id": "conmed_review",
          "title": "Concomitant Medication Review",
          "fields": [
            {"field_id": "reviewed_datetime",          "type": "datetime", "required": true,  "label": "Review Date / Time"},
            {"field_id": "review_performed",           "type": "select",   "required": true,  "label": "Review Performed",
             "options": ["yes","no"]},
            {"field_id": "changes_since_last_visit",   "type": "select",   "required": true,  "label": "Changes Since Last Visit",
             "options": ["yes","no"]},
            {"field_id": "conmed_log_updated",         "type": "select",   "required": true,  "label": "ConMed Log Updated",
             "options": ["yes","no"]},
            {"field_id": "new_medications",            "type": "textarea", "required": false, "label": "New Medications (list if changes = yes)"},
            {"field_id": "stopped_medications",        "type": "textarea", "required": false, "label": "Stopped Medications (list if changes = yes)"},
            {"field_id": "prohibited_therapy_identified","type": "select", "required": false, "label": "Prohibited Therapy Identified",
             "options": ["yes","no"]},
            {"field_id": "prohibited_therapy_detail",  "type": "textarea", "required": false, "label": "Prohibited Therapy Detail"},
            {"field_id": "related_to_ae",              "type": "select",   "required": false, "label": "Any ConMed Related to AE",
             "options": ["yes","no"]},
            {"field_id": "linked_ae_id",               "type": "text",     "required": false, "label": "Linked AE ID"},
            {"field_id": "requires_medical_monitor_review","type":"select","required": false, "label": "Requires Medical Monitor Review",
             "options": ["yes","no"]},
            {"field_id": "verified_with_subject",      "type": "select",   "required": false, "label": "Verified with Subject",
             "options": ["yes","no"]},
            {"field_id": "action_required",            "type": "select",   "required": false, "label": "Action Required",
             "options": ["yes","no"]},
            {"field_id": "comments",                   "type": "textarea", "required": false, "label": "Comments"}
          ]
        }
      ],
      "coordinator_guidance": "Review all concomitant medications since last contact. Update EDC ConMed log before closing the visit."
    }'::jsonb,
    '{
      "fields": [
        {"field_id": "reviewed_datetime",           "type": "datetime", "label": "Review Date / Time",         "required": true},
        {"field_id": "review_performed",            "type": "select",   "label": "Review Performed",           "required": true,
         "options": ["yes","no"]},
        {"field_id": "changes_since_last_visit",    "type": "select",   "label": "Changes Since Last Visit",   "required": true,
         "options": ["yes","no"]},
        {"field_id": "conmed_log_updated",          "type": "select",   "label": "ConMed Log Updated",         "required": true,
         "options": ["yes","no"]},
        {"field_id": "new_medications",             "type": "textarea", "label": "New Medications",            "required": false},
        {"field_id": "stopped_medications",         "type": "textarea", "label": "Stopped Medications",        "required": false},
        {"field_id": "prohibited_therapy_identified","type": "select",  "label": "Prohibited Therapy Identified","required": false,
         "options": ["yes","no"]},
        {"field_id": "prohibited_therapy_detail",   "type": "textarea", "label": "Prohibited Therapy Detail",  "required": false},
        {"field_id": "related_to_ae",               "type": "select",   "label": "Any ConMed Related to AE",   "required": false,
         "options": ["yes","no"]},
        {"field_id": "linked_ae_id",                "type": "text",     "label": "Linked AE ID",               "required": false},
        {"field_id": "requires_medical_monitor_review","type": "select","label": "Requires Medical Monitor Review","required": false,
         "options": ["yes","no"]},
        {"field_id": "verified_with_subject",       "type": "select",   "label": "Verified with Subject",      "required": false,
         "options": ["yes","no"]},
        {"field_id": "action_required",             "type": "select",   "label": "Action Required",            "required": false,
         "options": ["yes","no"]},
        {"field_id": "comments",                    "type": "textarea", "label": "Comments",                   "required": false}
      ]
    }'::jsonb,
    '{
      "rules": [
        {
          "if":   {"field": "changes_since_last_visit", "equals": "yes"},
          "then": {"show": ["new_medications","stopped_medications"]}
        },
        {
          "if":   {"field": "prohibited_therapy_identified", "equals": "yes"},
          "then": {"require": ["prohibited_therapy_detail"]}
        },
        {
          "if":   {"field": "related_to_ae", "equals": "yes"},
          "then": {"require": ["linked_ae_id"]}
        }
      ]
    }'::jsonb,
    '{"coordinator_guidance": "Update ConMed log in EDC before closing the visit. Flag any prohibited therapies immediately."}'::jsonb,
    seed_actor
  ) RETURNING id INTO v_ver_id;

  UPDATE procedure_library
  SET    active_version_id = v_ver_id,
         updated_at        = now()
  WHERE  id = v_lib_id;

  RAISE NOTICE 'OK: CONMED_REVIEW v2 inserted and active_version_id updated';
END $$;

-- ---------------------------------------------------------------------------
-- Task 4: Verification block (RAISE NOTICE — non-blocking)
-- ---------------------------------------------------------------------------

DO $$
DECLARE
  v_count  int;
  v_status text;
  v_ver    int;
  v_lib_id uuid;
  v_ver_id uuid;
BEGIN

  -- 1. ACTH_STIM is archived
  SELECT status INTO v_status
  FROM   procedure_library
  WHERE  procedure_code = 'ACTH_STIM'
    AND  library_scope  = 'global';

  IF v_status IS NULL THEN
    RAISE NOTICE 'CHECK 1 SKIP: ACTH_STIM row not found (may not have been seeded in this env)';
  ELSIF v_status = 'archived' THEN
    RAISE NOTICE 'CHECK 1 OK: ACTH_STIM status = archived';
  ELSE
    RAISE NOTICE 'CHECK 1 WARN: ACTH_STIM status = % (expected archived)', v_status;
  END IF;

  -- 2. ACTH_STIM_TEST is active and published
  SELECT pl.status INTO v_status
  FROM   procedure_library pl
  JOIN   procedure_blueprint_versions pbv ON pbv.id = pl.active_version_id
  WHERE  pl.procedure_code     = 'ACTH_STIM_TEST'
    AND  pl.library_scope      = 'global'
    AND  pbv.blueprint_status  = 'published';

  IF v_status IS NULL THEN
    RAISE NOTICE 'CHECK 2 WARN: ACTH_STIM_TEST not found or active_version_id not pointing to a published version';
  ELSIF v_status = 'active' THEN
    RAISE NOTICE 'CHECK 2 OK: ACTH_STIM_TEST is active with a published blueprint';
  ELSE
    RAISE NOTICE 'CHECK 2 WARN: ACTH_STIM_TEST status = %', v_status;
  END IF;

  -- 3. CLINICAL_CHEMISTRY has active_version_id and is published
  SELECT 1 INTO v_count
  FROM   procedure_library pl
  JOIN   procedure_blueprint_versions pbv ON pbv.id = pl.active_version_id
  WHERE  pl.procedure_code    = 'CLINICAL_CHEMISTRY'
    AND  pl.library_scope     = 'global'
    AND  pbv.blueprint_status = 'published';

  IF NOT FOUND THEN
    RAISE NOTICE 'CHECK 3 WARN: CLINICAL_CHEMISTRY not found or missing active published version';
  ELSE
    RAISE NOTICE 'CHECK 3 OK: CLINICAL_CHEMISTRY has active published version';
  END IF;

  -- 4. VITAL_SIGNS active version is v2
  SELECT pbv.version_number INTO v_ver
  FROM   procedure_library pl
  JOIN   procedure_blueprint_versions pbv ON pbv.id = pl.active_version_id
  WHERE  pl.procedure_code = 'VITAL_SIGNS'
    AND  pl.library_scope  = 'global';

  IF v_ver IS NULL THEN
    RAISE NOTICE 'CHECK 4 WARN: VITAL_SIGNS active_version_id not found or not joined';
  ELSIF v_ver = 2 THEN
    RAISE NOTICE 'CHECK 4 OK: VITAL_SIGNS active version = 2';
  ELSE
    RAISE NOTICE 'CHECK 4 WARN: VITAL_SIGNS active version = % (expected 2)', v_ver;
  END IF;

  -- 5. AE_REVIEW active version is v2
  SELECT pbv.version_number INTO v_ver
  FROM   procedure_library pl
  JOIN   procedure_blueprint_versions pbv ON pbv.id = pl.active_version_id
  WHERE  pl.procedure_code = 'AE_REVIEW'
    AND  pl.library_scope  = 'global';

  IF v_ver IS NULL THEN
    RAISE NOTICE 'CHECK 5 WARN: AE_REVIEW active_version_id not found or not joined';
  ELSIF v_ver = 2 THEN
    RAISE NOTICE 'CHECK 5 OK: AE_REVIEW active version = 2';
  ELSE
    RAISE NOTICE 'CHECK 5 WARN: AE_REVIEW active version = % (expected 2)', v_ver;
  END IF;

  -- 6. PHYSICAL_EXAM active version is v2
  SELECT pbv.version_number INTO v_ver
  FROM   procedure_library pl
  JOIN   procedure_blueprint_versions pbv ON pbv.id = pl.active_version_id
  WHERE  pl.procedure_code = 'PHYSICAL_EXAM'
    AND  pl.library_scope  = 'global';

  IF v_ver IS NULL THEN
    RAISE NOTICE 'CHECK 6 WARN: PHYSICAL_EXAM active_version_id not found or not joined';
  ELSIF v_ver = 2 THEN
    RAISE NOTICE 'CHECK 6 OK: PHYSICAL_EXAM active version = 2';
  ELSE
    RAISE NOTICE 'CHECK 6 WARN: PHYSICAL_EXAM active version = % (expected 2)', v_ver;
  END IF;

  -- 7. CONMED_REVIEW active version is v2
  SELECT pbv.version_number INTO v_ver
  FROM   procedure_library pl
  JOIN   procedure_blueprint_versions pbv ON pbv.id = pl.active_version_id
  WHERE  pl.procedure_code = 'CONMED_REVIEW'
    AND  pl.library_scope  = 'global';

  IF v_ver IS NULL THEN
    RAISE NOTICE 'CHECK 7 WARN: CONMED_REVIEW active_version_id not found or not joined';
  ELSIF v_ver = 2 THEN
    RAISE NOTICE 'CHECK 7 OK: CONMED_REVIEW active version = 2';
  ELSE
    RAISE NOTICE 'CHECK 7 WARN: CONMED_REVIEW active version = % (expected 2)', v_ver;
  END IF;

END $$;
