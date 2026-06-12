-- Migration 0181: Validation Protocol 002 Procedure Blueprint Seeds
--
-- Seeds 5 generic reusable blueprints required by VALIDATION_PROTOCOL_002 and
-- broadly applicable across any household-transmission / remote-visit protocol.
-- All rows are idempotent via WHERE NOT EXISTS on procedure_code + library_scope.
--
-- Blueprints added (with published blueprint versions):
--   INFORMED_CONSENT    (universal)
--   SPECIMEN_COLLECTION (common)
--   SYMPTOM_ASSESSMENT  (common)
--   HOUSEHOLD_LINKAGE   (study_specific)
--   UNSCHEDULED_VISIT_ASSESSMENT (common)
--
-- VP002 semantic mapping after this migration (12/12 covered):
--   PROC_MV_CONSENT          -> INFORMED_CONSENT        (this migration)
--   PROC_MV_ELIGIBILITY      -> ELIGIBILITY_REVIEW       (0179)
--   PROC_MV_HOUSEHOLD_LINK   -> HOUSEHOLD_LINKAGE        (this migration)
--   PROC_MV_SYMPTOM_SCREEN   -> SYMPTOM_ASSESSMENT       (this migration)
--   PROC_MV_HOME_SWAB        -> SPECIMEN_COLLECTION      (this migration)
--   PROC_MV_PHONE_CHECK      -> PHONE_CONTACT            (0179)
--   PROC_MV_REMOTE_SYMPTOM   -> SYMPTOM_ASSESSMENT       (this migration)
--   PROC_MV_SITE_VITALS      -> VITAL_SIGNS              (0110/0180 v2)
--   PROC_MV_AE               -> AE_REVIEW                (0110/0180 v2)
--   PROC_MV_SICK_ASSESS      -> UNSCHEDULED_VISIT_ASSESSMENT (this migration)
--   PROC_MV_EXTRA_SWAB       -> SPECIMEN_COLLECTION      (this migration)
--   PROC_MV_EOS_CLOSEOUT     -> EOS_CLOSEOUT             (0179)
--
-- blueprint_status values: 'draft' | 'published' | 'archived'  (per 0110 constraint)
-- library status values:   'active' | 'inactive' | 'draft' | 'archived' (per 0110 constraint)

-- ---------------------------------------------------------------------------
-- 1. INFORMED_CONSENT  (universal)
-- ---------------------------------------------------------------------------

DO $$
DECLARE
  seed_actor uuid := '00000000-0000-4000-8000-000000000001';
  v_lib_id   uuid;
  v_ver_id   uuid;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM procedure_library
    WHERE  procedure_code = 'INFORMED_CONSENT'
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
      'INFORMED_CONSENT',
      'Informed Consent',
      'regulatory',
      'enrollment',
      'Document informed consent obtained from subject prior to any protocol procedures. Supports initial consent, re-consent, assent, and legally authorized representative consent.',
      'standard',
      20,
      'active',
      ARRAY['consent','regulatory','enrollment','universal'],
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
          "section_id": "informed_consent",
          "title": "Informed Consent",
          "fields": [
            {"field_id": "consent_datetime",                "type": "datetime", "required": true,  "label": "Date / Time of Consent"},
            {"field_id": "consent_version",                 "type": "text",     "required": true,  "label": "Consent Form Version"},
            {"field_id": "consent_type",                    "type": "select",   "required": true,  "label": "Consent Type",
             "options": ["initial","re_consent","assent","legally_authorized_representative"]},
            {"field_id": "subject_confirmed_willingness",   "type": "select",   "required": true,  "label": "Subject Confirmed Willingness",
             "options": ["yes","no"]},
            {"field_id": "adequate_time_to_review",         "type": "select",   "required": true,  "label": "Adequate Time to Review",
             "options": ["yes","no"]},
            {"field_id": "questions_answered",              "type": "select",   "required": true,  "label": "Questions Answered",
             "options": ["yes","no"]},
            {"field_id": "witness_present",                 "type": "select",   "required": false, "label": "Witness Present",
             "options": ["yes","no","not_required"]},
            {"field_id": "witness_name",                    "type": "text",     "required": false, "label": "Witness Name"},
            {"field_id": "lar_name",                        "type": "text",     "required": false, "label": "LAR Name"},
            {"field_id": "lar_relationship",                "type": "text",     "required": false, "label": "LAR Relationship"},
            {"field_id": "consented_by",                    "type": "text",     "required": true,  "label": "Consented By"},
            {"field_id": "comments",                        "type": "textarea", "required": false, "label": "Comments"}
          ]
        }],
        "coordinator_guidance": "Ensure subject has adequate time to review consent. Document all questions and answers. Confirm correct version before proceeding."
      }'::jsonb,
      '{
        "fields": [
          {"field_id": "consent_datetime",              "type": "datetime", "label": "Date / Time of Consent",       "required": true},
          {"field_id": "consent_version",               "type": "text",     "label": "Consent Form Version",          "required": true},
          {"field_id": "consent_type",                  "type": "select",   "label": "Consent Type",                  "required": true,
           "options": ["initial","re_consent","assent","legally_authorized_representative"]},
          {"field_id": "subject_confirmed_willingness", "type": "select",   "label": "Subject Confirmed Willingness", "required": true,
           "options": ["yes","no"]},
          {"field_id": "adequate_time_to_review",       "type": "select",   "label": "Adequate Time to Review",       "required": true,
           "options": ["yes","no"]},
          {"field_id": "questions_answered",            "type": "select",   "label": "Questions Answered",            "required": true,
           "options": ["yes","no"]},
          {"field_id": "witness_present",               "type": "select",   "label": "Witness Present",               "required": false,
           "options": ["yes","no","not_required"]},
          {"field_id": "witness_name",                  "type": "text",     "label": "Witness Name",                  "required": false},
          {"field_id": "lar_name",                      "type": "text",     "label": "LAR Name",                      "required": false},
          {"field_id": "lar_relationship",              "type": "text",     "label": "LAR Relationship",              "required": false},
          {"field_id": "consented_by",                  "type": "text",     "label": "Consented By",                  "required": true},
          {"field_id": "comments",                      "type": "textarea", "label": "Comments",                      "required": false}
        ]
      }'::jsonb,
      '{
        "rules": [
          {
            "if":   {"field": "witness_present", "equals": "yes"},
            "then": {"require": ["witness_name"]}
          },
          {
            "if":   {"field": "consent_type", "equals": "legally_authorized_representative"},
            "then": {"require": ["lar_name","lar_relationship"]}
          }
        ]
      }'::jsonb,
      '{"coordinator_guidance": "Ensure subject has adequate time to review consent. Document all questions and answers. Confirm correct version before proceeding."}'::jsonb,
      seed_actor
    ) RETURNING id INTO v_ver_id;

    UPDATE procedure_library
    SET    active_version_id = v_ver_id
    WHERE  id = v_lib_id;

  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 2. SPECIMEN_COLLECTION  (common)
--    Generic sample collection covering any specimen type (nasal swab, blood,
--    urine, etc.). Maps to PROC_MV_HOME_SWAB and PROC_MV_EXTRA_SWAB via the
--    specimen_type selector. No MV or VP002 references in field names or labels.
-- ---------------------------------------------------------------------------

DO $$
DECLARE
  seed_actor uuid := '00000000-0000-4000-8000-000000000001';
  v_lib_id   uuid;
  v_ver_id   uuid;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM procedure_library
    WHERE  procedure_code = 'SPECIMEN_COLLECTION'
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
      supports_offsite,
      status,
      tags,
      created_by
    ) VALUES (
      'global',
      'SPECIMEN_COLLECTION',
      'Specimen Collection',
      'laboratory',
      'sample_collection',
      'Generic specimen collection documentation covering any sample type. Tracks collection method, fasting, kit ID, chain of custody, and AE linkage.',
      'standard',
      15,
      true,
      'active',
      ARRAY['specimen','collection','lab','sample','common'],
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
          "section_id": "specimen_collection",
          "title": "Specimen Collection",
          "fields": [
            {"field_id": "collection_datetime",    "type": "datetime", "required": true,  "label": "Collection Date / Time"},
            {"field_id": "specimen_type",          "type": "select",   "required": true,  "label": "Specimen Type",
             "options": ["nasal_swab","blood_whole","blood_serum","blood_plasma","urine","saliva","buccal_swab","other"]},
            {"field_id": "specimen_type_other",    "type": "text",     "required": false, "label": "Specify Other"},
            {"field_id": "collection_method",      "type": "select",   "required": false, "label": "Collection Method",
             "options": ["self_collected","staff_collected","combined"]},
            {"field_id": "fasting_required",       "type": "select",   "required": false, "label": "Fasting Required",
             "options": ["yes","no","not_applicable"]},
            {"field_id": "fasting_confirmed",      "type": "select",   "required": false, "label": "Fasting Confirmed",
             "options": ["yes","no"]},
            {"field_id": "fasting_hours",          "type": "integer",  "required": false, "label": "Fasting Hours"},
            {"field_id": "collection_location",    "type": "select",   "required": false, "label": "Collection Location",
             "options": ["site","home","remote_clinic","other"]},
            {"field_id": "kit_id",                 "type": "text",     "required": false, "label": "Kit / Collection ID"},
            {"field_id": "accession_number",       "type": "text",     "required": false, "label": "Accession Number"},
            {"field_id": "volume_collected",       "type": "text",     "required": false, "label": "Volume Collected"},
            {"field_id": "processing_status",      "type": "select",   "required": false, "label": "Processing Status",
             "options": ["collected","in_transit","received","resulted","cancelled"]},
            {"field_id": "storage_temperature",    "type": "select",   "required": false, "label": "Storage Temperature",
             "options": ["ambient","refrigerated","frozen","dry_ice"]},
            {"field_id": "shipped_datetime",       "type": "datetime", "required": false, "label": "Shipped Date / Time"},
            {"field_id": "received_by_lab",        "type": "select",   "required": false, "label": "Received by Lab",
             "options": ["yes","no"]},
            {"field_id": "abnormal_flag",          "type": "select",   "required": false, "label": "Abnormal Flag",
             "options": ["yes","no"]},
            {"field_id": "ae_linkage",             "type": "select",   "required": false, "label": "Linked to AE",
             "options": ["yes","no"]},
            {"field_id": "linked_ae_id",           "type": "text",     "required": false, "label": "Linked AE ID"},
            {"field_id": "collected_by",           "type": "text",     "required": false, "label": "Collected By"},
            {"field_id": "comments",               "type": "textarea", "required": false, "label": "Comments"}
          ]
        }],
        "coordinator_guidance": "Record kit ID from collection materials. Confirm storage and transport requirements per protocol lab manual. Document any deviations from standard collection."
      }'::jsonb,
      '{
        "fields": [
          {"field_id": "collection_datetime", "type": "datetime", "label": "Collection Date / Time", "required": true},
          {"field_id": "specimen_type",       "type": "select",   "label": "Specimen Type",           "required": true,
           "options": ["nasal_swab","blood_whole","blood_serum","blood_plasma","urine","saliva","buccal_swab","other"]},
          {"field_id": "specimen_type_other", "type": "text",     "label": "Specify Other",            "required": false},
          {"field_id": "collection_method",   "type": "select",   "label": "Collection Method",        "required": false,
           "options": ["self_collected","staff_collected","combined"]},
          {"field_id": "fasting_required",    "type": "select",   "label": "Fasting Required",         "required": false,
           "options": ["yes","no","not_applicable"]},
          {"field_id": "fasting_confirmed",   "type": "select",   "label": "Fasting Confirmed",        "required": false,
           "options": ["yes","no"]},
          {"field_id": "fasting_hours",       "type": "integer",  "label": "Fasting Hours",            "required": false},
          {"field_id": "collection_location", "type": "select",   "label": "Collection Location",      "required": false,
           "options": ["site","home","remote_clinic","other"]},
          {"field_id": "kit_id",              "type": "text",     "label": "Kit / Collection ID",      "required": false},
          {"field_id": "accession_number",    "type": "text",     "label": "Accession Number",         "required": false},
          {"field_id": "volume_collected",    "type": "text",     "label": "Volume Collected",         "required": false},
          {"field_id": "processing_status",   "type": "select",   "label": "Processing Status",        "required": false,
           "options": ["collected","in_transit","received","resulted","cancelled"]},
          {"field_id": "storage_temperature", "type": "select",   "label": "Storage Temperature",      "required": false,
           "options": ["ambient","refrigerated","frozen","dry_ice"]},
          {"field_id": "shipped_datetime",    "type": "datetime", "label": "Shipped Date / Time",      "required": false},
          {"field_id": "received_by_lab",     "type": "select",   "label": "Received by Lab",          "required": false,
           "options": ["yes","no"]},
          {"field_id": "abnormal_flag",       "type": "select",   "label": "Abnormal Flag",            "required": false,
           "options": ["yes","no"]},
          {"field_id": "ae_linkage",          "type": "select",   "label": "Linked to AE",             "required": false,
           "options": ["yes","no"]},
          {"field_id": "linked_ae_id",        "type": "text",     "label": "Linked AE ID",             "required": false},
          {"field_id": "collected_by",        "type": "text",     "label": "Collected By",             "required": false},
          {"field_id": "comments",            "type": "textarea", "label": "Comments",                 "required": false}
        ]
      }'::jsonb,
      '{
        "rules": [
          {
            "if":   {"field": "specimen_type", "equals": "other"},
            "then": {"require": ["specimen_type_other"]}
          },
          {
            "if":   {"field": "fasting_required", "equals": "yes"},
            "then": {"require": ["fasting_confirmed"]}
          },
          {
            "if":   {"field": "fasting_confirmed", "equals": "yes"},
            "then": {"require": ["fasting_hours"]}
          },
          {
            "if":   {"field": "ae_linkage", "equals": "yes"},
            "then": {"require": ["linked_ae_id"]}
          }
        ]
      }'::jsonb,
      '{"coordinator_guidance": "Record kit ID from collection materials. Confirm storage and transport requirements per protocol lab manual. Document any deviations from standard collection."}'::jsonb,
      seed_actor
    ) RETURNING id INTO v_ver_id;

    UPDATE procedure_library
    SET    active_version_id = v_ver_id
    WHERE  id = v_lib_id;

  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 3. SYMPTOM_ASSESSMENT  (common)
--    Generic respiratory / infectious disease symptom assessment. Derived from
--    canonical symptom fields — no MV or VP002 references in names or labels.
-- ---------------------------------------------------------------------------

DO $$
DECLARE
  seed_actor uuid := '00000000-0000-4000-8000-000000000001';
  v_lib_id   uuid;
  v_ver_id   uuid;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM procedure_library
    WHERE  procedure_code = 'SYMPTOM_ASSESSMENT'
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
      supports_offsite,
      status,
      tags,
      created_by
    ) VALUES (
      'global',
      'SYMPTOM_ASSESSMENT',
      'Symptom Assessment',
      'clinical_review',
      'symptom',
      'Generic symptom assessment for respiratory and infectious disease protocols. Covers symptom presence, severity, onset, and escalation triggers. Usable for on-site, phone, video, and patient-reported contacts.',
      'simple',
      15,
      true,
      'active',
      ARRAY['symptom','assessment','respiratory','infectious','remote','common'],
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
          "section_id": "symptom_assessment",
          "title": "Symptom Assessment",
          "fields": [
            {"field_id": "assessment_datetime",           "type": "datetime", "required": true,  "label": "Assessment Date / Time"},
            {"field_id": "assessment_method",             "type": "select",   "required": true,  "label": "Assessment Method",
             "options": ["in_person","telephone","video","patient_reported","remote_platform"]},
            {"field_id": "fever_present",                 "type": "select",   "required": false, "label": "Fever Present",
             "options": ["yes","no","unknown"]},
            {"field_id": "fever_temperature",             "type": "number",   "required": false, "label": "Measured Temperature"},
            {"field_id": "fever_temperature_unit",        "type": "select",   "required": false, "label": "Temperature Unit",
             "options": ["C","F"]},
            {"field_id": "cough_present",                 "type": "select",   "required": false, "label": "Cough Present",
             "options": ["yes","no","unknown"]},
            {"field_id": "cough_type",                    "type": "select",   "required": false, "label": "Cough Type",
             "options": ["dry","productive"]},
            {"field_id": "sore_throat_present",           "type": "select",   "required": false, "label": "Sore Throat Present",
             "options": ["yes","no","unknown"]},
            {"field_id": "nasal_congestion_present",      "type": "select",   "required": false, "label": "Nasal Congestion Present",
             "options": ["yes","no","unknown"]},
            {"field_id": "shortness_of_breath_present",   "type": "select",   "required": false, "label": "Shortness of Breath Present",
             "options": ["yes","no","unknown"]},
            {"field_id": "fatigue_present",               "type": "select",   "required": false, "label": "Fatigue Present",
             "options": ["yes","no","unknown"]},
            {"field_id": "myalgia_present",               "type": "select",   "required": false, "label": "Myalgia Present",
             "options": ["yes","no","unknown"]},
            {"field_id": "headache_present",              "type": "select",   "required": false, "label": "Headache Present",
             "options": ["yes","no","unknown"]},
            {"field_id": "other_symptoms_present",        "type": "select",   "required": false, "label": "Other Symptoms Present",
             "options": ["yes","no"]},
            {"field_id": "other_symptoms_detail",         "type": "textarea", "required": false, "label": "Other Symptoms Detail"},
            {"field_id": "symptom_onset_date",            "type": "date",     "required": false, "label": "Symptom Onset Date"},
            {"field_id": "symptom_severity",              "type": "select",   "required": false, "label": "Symptom Severity",
             "options": ["mild","moderate","severe"]},
            {"field_id": "symptoms_worsening",            "type": "select",   "required": false, "label": "Symptoms Worsening",
             "options": ["yes","no","stable"]},
            {"field_id": "medical_care_sought",           "type": "select",   "required": false, "label": "Medical Care Sought",
             "options": ["yes","no"]},
            {"field_id": "medications_taken_for_symptoms","type": "select",   "required": false, "label": "Medications Taken for Symptoms",
             "options": ["yes","no"]},
            {"field_id": "medications_detail",            "type": "textarea", "required": false, "label": "Medications Taken Detail"},
            {"field_id": "ae_linkage",                    "type": "select",   "required": false, "label": "Linked to AE",
             "options": ["yes","no"]},
            {"field_id": "linked_ae_id",                  "type": "text",     "required": false, "label": "Linked AE ID"},
            {"field_id": "completed_by",                  "type": "text",     "required": false, "label": "Completed By"}
          ]
        }],
        "coordinator_guidance": "Document all symptoms reported since last contact. Confirm onset date if subject reports new symptoms. Assess severity and escalate to PI if symptoms worsen."
      }'::jsonb,
      '{
        "fields": [
          {"field_id": "assessment_datetime",            "type": "datetime", "label": "Assessment Date / Time",           "required": true},
          {"field_id": "assessment_method",              "type": "select",   "label": "Assessment Method",                "required": true,
           "options": ["in_person","telephone","video","patient_reported","remote_platform"]},
          {"field_id": "fever_present",                  "type": "select",   "label": "Fever Present",                    "required": false,
           "options": ["yes","no","unknown"]},
          {"field_id": "fever_temperature",              "type": "number",   "label": "Measured Temperature",             "required": false},
          {"field_id": "fever_temperature_unit",         "type": "select",   "label": "Temperature Unit",                 "required": false,
           "options": ["C","F"]},
          {"field_id": "cough_present",                  "type": "select",   "label": "Cough Present",                    "required": false,
           "options": ["yes","no","unknown"]},
          {"field_id": "cough_type",                     "type": "select",   "label": "Cough Type",                       "required": false,
           "options": ["dry","productive"]},
          {"field_id": "sore_throat_present",            "type": "select",   "label": "Sore Throat Present",              "required": false,
           "options": ["yes","no","unknown"]},
          {"field_id": "nasal_congestion_present",       "type": "select",   "label": "Nasal Congestion Present",         "required": false,
           "options": ["yes","no","unknown"]},
          {"field_id": "shortness_of_breath_present",    "type": "select",   "label": "Shortness of Breath Present",      "required": false,
           "options": ["yes","no","unknown"]},
          {"field_id": "fatigue_present",                "type": "select",   "label": "Fatigue Present",                  "required": false,
           "options": ["yes","no","unknown"]},
          {"field_id": "myalgia_present",                "type": "select",   "label": "Myalgia Present",                  "required": false,
           "options": ["yes","no","unknown"]},
          {"field_id": "headache_present",               "type": "select",   "label": "Headache Present",                 "required": false,
           "options": ["yes","no","unknown"]},
          {"field_id": "other_symptoms_present",         "type": "select",   "label": "Other Symptoms Present",           "required": false,
           "options": ["yes","no"]},
          {"field_id": "other_symptoms_detail",          "type": "textarea", "label": "Other Symptoms Detail",            "required": false},
          {"field_id": "symptom_onset_date",             "type": "date",     "label": "Symptom Onset Date",               "required": false},
          {"field_id": "symptom_severity",               "type": "select",   "label": "Symptom Severity",                 "required": false,
           "options": ["mild","moderate","severe"]},
          {"field_id": "symptoms_worsening",             "type": "select",   "label": "Symptoms Worsening",               "required": false,
           "options": ["yes","no","stable"]},
          {"field_id": "medical_care_sought",            "type": "select",   "label": "Medical Care Sought",              "required": false,
           "options": ["yes","no"]},
          {"field_id": "medications_taken_for_symptoms", "type": "select",   "label": "Medications Taken for Symptoms",   "required": false,
           "options": ["yes","no"]},
          {"field_id": "medications_detail",             "type": "textarea", "label": "Medications Taken Detail",         "required": false},
          {"field_id": "ae_linkage",                     "type": "select",   "label": "Linked to AE",                     "required": false,
           "options": ["yes","no"]},
          {"field_id": "linked_ae_id",                   "type": "text",     "label": "Linked AE ID",                     "required": false},
          {"field_id": "completed_by",                   "type": "text",     "label": "Completed By",                     "required": false}
        ]
      }'::jsonb,
      '{
        "rules": [
          {
            "if":   {"field": "fever_present", "equals": "yes"},
            "then": {"require": ["fever_temperature"]}
          },
          {
            "if":   {"field": "cough_present", "equals": "yes"},
            "then": {"show": ["cough_type"]}
          },
          {
            "if":   {"field": "other_symptoms_present", "equals": "yes"},
            "then": {"require": ["other_symptoms_detail"]}
          },
          {
            "if":   {"field": "medications_taken_for_symptoms", "equals": "yes"},
            "then": {"require": ["medications_detail"]}
          },
          {
            "if":   {"field": "ae_linkage", "equals": "yes"},
            "then": {"require": ["linked_ae_id"]}
          }
        ]
      }'::jsonb,
      '{"coordinator_guidance": "Document all symptoms reported since last contact. Confirm onset date if subject reports new symptoms. Assess severity and escalate to PI if symptoms worsen."}'::jsonb,
      seed_actor
    ) RETURNING id INTO v_ver_id;

    UPDATE procedure_library
    SET    active_version_id = v_ver_id
    WHERE  id = v_lib_id;

  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 4. HOUSEHOLD_LINKAGE  (study_specific)
--    Minimal attestation for household member enrollment confirmation.
-- ---------------------------------------------------------------------------

DO $$
DECLARE
  seed_actor uuid := '00000000-0000-4000-8000-000000000001';
  v_lib_id   uuid;
  v_ver_id   uuid;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM procedure_library
    WHERE  procedure_code = 'HOUSEHOLD_LINKAGE'
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
      'HOUSEHOLD_LINKAGE',
      'Household Linkage',
      'regulatory',
      'enrollment',
      'Household member enrollment confirmation and relationship attestation. Documents household relationship, living arrangements, and confirmation that separate consent documentation exists for each member.',
      'simple',
      10,
      'active',
      ARRAY['household','linkage','enrollment','study_specific'],
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
          "section_id": "household_linkage",
          "title": "Household Linkage",
          "fields": [
            {"field_id": "attestation_datetime",        "type": "datetime", "required": true,  "label": "Attestation Date / Time"},
            {"field_id": "household_relationship",      "type": "select",   "required": true,  "label": "Household Relationship",
             "options": ["spouse_partner","parent_child","sibling","roommate","other_household_member"]},
            {"field_id": "household_relationship_other","type": "text",     "required": false, "label": "Specify Relationship"},
            {"field_id": "index_subject_confirmed",     "type": "select",   "required": true,  "label": "Primary Household Member Confirmed",
             "options": ["yes","no"]},
            {"field_id": "household_member_role",       "type": "select",   "required": true,  "label": "Household Member Role",
             "options": ["index_case","household_contact"]},
            {"field_id": "shared_living_duration",      "type": "select",   "required": false, "label": "Shared Living Duration",
             "options": ["less_than_3_months","3_to_12_months","more_than_12_months"]},
            {"field_id": "shared_bedroom",              "type": "select",   "required": false, "label": "Shared Bedroom",
             "options": ["yes","no"]},
            {"field_id": "subject_consented_separately","type": "select",   "required": true,  "label": "Subject Consented Separately",
             "options": ["yes","no"]},
            {"field_id": "eligibility_verified",        "type": "select",   "required": true,  "label": "Eligibility Verified",
             "options": ["yes","no"]},
            {"field_id": "confirmed_by",                "type": "text",     "required": true,  "label": "Confirmed By"},
            {"field_id": "comments",                    "type": "textarea", "required": false, "label": "Comments"}
          ]
        }],
        "coordinator_guidance": "Confirm household relationship and living arrangements. Ensure each household member has separate consent documentation."
      }'::jsonb,
      '{
        "fields": [
          {"field_id": "attestation_datetime",         "type": "datetime", "label": "Attestation Date / Time",              "required": true},
          {"field_id": "household_relationship",       "type": "select",   "label": "Household Relationship",               "required": true,
           "options": ["spouse_partner","parent_child","sibling","roommate","other_household_member"]},
          {"field_id": "household_relationship_other", "type": "text",     "label": "Specify Relationship",                 "required": false},
          {"field_id": "index_subject_confirmed",      "type": "select",   "label": "Primary Household Member Confirmed",   "required": true,
           "options": ["yes","no"]},
          {"field_id": "household_member_role",        "type": "select",   "label": "Household Member Role",                "required": true,
           "options": ["index_case","household_contact"]},
          {"field_id": "shared_living_duration",       "type": "select",   "label": "Shared Living Duration",               "required": false,
           "options": ["less_than_3_months","3_to_12_months","more_than_12_months"]},
          {"field_id": "shared_bedroom",               "type": "select",   "label": "Shared Bedroom",                       "required": false,
           "options": ["yes","no"]},
          {"field_id": "subject_consented_separately", "type": "select",   "label": "Subject Consented Separately",         "required": true,
           "options": ["yes","no"]},
          {"field_id": "eligibility_verified",         "type": "select",   "label": "Eligibility Verified",                 "required": true,
           "options": ["yes","no"]},
          {"field_id": "confirmed_by",                 "type": "text",     "label": "Confirmed By",                         "required": true},
          {"field_id": "comments",                     "type": "textarea", "label": "Comments",                             "required": false}
        ]
      }'::jsonb,
      '{
        "rules": [
          {
            "if":   {"field": "household_relationship", "equals": "other_household_member"},
            "then": {"require": ["household_relationship_other"]}
          }
        ]
      }'::jsonb,
      '{"coordinator_guidance": "Confirm household relationship and living arrangements. Ensure each household member has separate consent documentation."}'::jsonb,
      seed_actor
    ) RETURNING id INTO v_ver_id;

    UPDATE procedure_library
    SET    active_version_id = v_ver_id
    WHERE  id = v_lib_id;

  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 5. UNSCHEDULED_VISIT_ASSESSMENT  (common)
--    Generic clinical review wrapper for unscheduled or sick visits. Reusable
--    across any unscheduled event type — not specific to any protocol.
-- ---------------------------------------------------------------------------

DO $$
DECLARE
  seed_actor uuid := '00000000-0000-4000-8000-000000000001';
  v_lib_id   uuid;
  v_ver_id   uuid;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM procedure_library
    WHERE  procedure_code = 'UNSCHEDULED_VISIT_ASSESSMENT'
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
      supports_offsite,
      status,
      tags,
      created_by
    ) VALUES (
      'global',
      'UNSCHEDULED_VISIT_ASSESSMENT',
      'Unscheduled Visit Assessment',
      'clinical_review',
      'unscheduled',
      'Clinical review wrapper for unscheduled or sick visits. Documents visit reason, clinical assessment performed, new AEs, protocol deviations, IP hold decisions, and follow-up plans.',
      'standard',
      30,
      true,
      'active',
      ARRAY['unscheduled','sick_visit','clinical_review','ae','common'],
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
          "section_id": "unscheduled_visit_assessment",
          "title": "Unscheduled Visit Assessment",
          "fields": [
            {"field_id": "visit_datetime",                 "type": "datetime", "required": true,  "label": "Visit Date / Time"},
            {"field_id": "visit_reason",                   "type": "select",   "required": true,  "label": "Visit Reason",
             "options": ["illness","injury","ae_follow_up","protocol_deviation_review","subject_request","investigator_initiated","other"]},
            {"field_id": "visit_reason_other",             "type": "text",     "required": false, "label": "Specify Reason"},
            {"field_id": "visit_type",                     "type": "select",   "required": true,  "label": "Visit Type",
             "options": ["in_person","telephone","video","home_visit"]},
            {"field_id": "primary_complaint",              "type": "textarea", "required": true,  "label": "Primary Complaint / Reason for Visit"},
            {"field_id": "clinical_assessment_performed",  "type": "select",   "required": true,  "label": "Clinical Assessment Performed",
             "options": ["yes","no"]},
            {"field_id": "vital_signs_obtained",           "type": "select",   "required": false, "label": "Vital Signs Obtained",
             "options": ["yes","no","not_applicable"]},
            {"field_id": "physical_exam_performed",        "type": "select",   "required": false, "label": "Physical Exam Performed",
             "options": ["yes","no","not_applicable"]},
            {"field_id": "assessment_summary",             "type": "textarea", "required": false, "label": "Assessment Summary"},
            {"field_id": "new_ae_identified",              "type": "select",   "required": true,  "label": "New AE Identified",
             "options": ["yes","no"]},
            {"field_id": "ae_reference",                   "type": "text",     "required": false, "label": "AE Reference"},
            {"field_id": "protocol_deviation_identified",  "type": "select",   "required": false, "label": "Protocol Deviation Identified",
             "options": ["yes","no"]},
            {"field_id": "pd_reference",                   "type": "text",     "required": false, "label": "Protocol Deviation Reference"},
            {"field_id": "ip_held",                        "type": "select",   "required": false, "label": "IP Held",
             "options": ["yes","no","not_applicable"]},
            {"field_id": "ip_hold_reason",                 "type": "textarea", "required": false, "label": "IP Hold Reason"},
            {"field_id": "follow_up_required",             "type": "select",   "required": true,  "label": "Follow-up Required",
             "options": ["yes","no"]},
            {"field_id": "follow_up_plan",                 "type": "textarea", "required": false, "label": "Follow-up Plan"},
            {"field_id": "pi_notified",                    "type": "select",   "required": false, "label": "PI Notified",
             "options": ["yes","no","not_required"]},
            {"field_id": "completed_by",                   "type": "text",     "required": true,  "label": "Completed By"}
          ]
        }],
        "coordinator_guidance": "Document the full reason for this unscheduled contact. Assess for new AEs before closing. Notify PI if IP hold or new SAE identified."
      }'::jsonb,
      '{
        "fields": [
          {"field_id": "visit_datetime",                "type": "datetime", "label": "Visit Date / Time",           "required": true},
          {"field_id": "visit_reason",                  "type": "select",   "label": "Visit Reason",                "required": true,
           "options": ["illness","injury","ae_follow_up","protocol_deviation_review","subject_request","investigator_initiated","other"]},
          {"field_id": "visit_reason_other",            "type": "text",     "label": "Specify Reason",              "required": false},
          {"field_id": "visit_type",                    "type": "select",   "label": "Visit Type",                  "required": true,
           "options": ["in_person","telephone","video","home_visit"]},
          {"field_id": "primary_complaint",             "type": "textarea", "label": "Primary Complaint / Reason",  "required": true},
          {"field_id": "clinical_assessment_performed", "type": "select",   "label": "Clinical Assessment Performed","required": true,
           "options": ["yes","no"]},
          {"field_id": "vital_signs_obtained",          "type": "select",   "label": "Vital Signs Obtained",        "required": false,
           "options": ["yes","no","not_applicable"]},
          {"field_id": "physical_exam_performed",       "type": "select",   "label": "Physical Exam Performed",     "required": false,
           "options": ["yes","no","not_applicable"]},
          {"field_id": "assessment_summary",            "type": "textarea", "label": "Assessment Summary",          "required": false},
          {"field_id": "new_ae_identified",             "type": "select",   "label": "New AE Identified",           "required": true,
           "options": ["yes","no"]},
          {"field_id": "ae_reference",                  "type": "text",     "label": "AE Reference",                "required": false},
          {"field_id": "protocol_deviation_identified", "type": "select",   "label": "Protocol Deviation Identified","required": false,
           "options": ["yes","no"]},
          {"field_id": "pd_reference",                  "type": "text",     "label": "Protocol Deviation Reference", "required": false},
          {"field_id": "ip_held",                       "type": "select",   "label": "IP Held",                     "required": false,
           "options": ["yes","no","not_applicable"]},
          {"field_id": "ip_hold_reason",                "type": "textarea", "label": "IP Hold Reason",              "required": false},
          {"field_id": "follow_up_required",            "type": "select",   "label": "Follow-up Required",          "required": true,
           "options": ["yes","no"]},
          {"field_id": "follow_up_plan",                "type": "textarea", "label": "Follow-up Plan",              "required": false},
          {"field_id": "pi_notified",                   "type": "select",   "label": "PI Notified",                 "required": false,
           "options": ["yes","no","not_required"]},
          {"field_id": "completed_by",                  "type": "text",     "label": "Completed By",                "required": true}
        ]
      }'::jsonb,
      '{
        "rules": [
          {
            "if":   {"field": "visit_reason", "equals": "other"},
            "then": {"require": ["visit_reason_other"]}
          },
          {
            "if":   {"field": "new_ae_identified", "equals": "yes"},
            "then": {"require": ["ae_reference"]}
          },
          {
            "if":   {"field": "protocol_deviation_identified", "equals": "yes"},
            "then": {"require": ["pd_reference"]}
          },
          {
            "if":   {"field": "ip_held", "equals": "yes"},
            "then": {"require": ["ip_hold_reason"]}
          },
          {
            "if":   {"field": "follow_up_required", "equals": "yes"},
            "then": {"require": ["follow_up_plan"]}
          }
        ]
      }'::jsonb,
      '{"coordinator_guidance": "Document the full reason for this unscheduled contact. Assess for new AEs before closing. Notify PI if IP hold or new SAE identified."}'::jsonb,
      seed_actor
    ) RETURNING id INTO v_ver_id;

    UPDATE procedure_library
    SET    active_version_id = v_ver_id
    WHERE  id = v_lib_id;

  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- Verification block (RAISE NOTICE — non-blocking)
-- ---------------------------------------------------------------------------

DO $$
DECLARE
  v_count  int;
  v_cnt_universal int;
  v_cnt_published int;
BEGIN

  -- CHECK 1: INFORMED_CONSENT has active published version
  SELECT 1 INTO v_count
  FROM   procedure_library pl
  JOIN   procedure_blueprint_versions pbv ON pbv.id = pl.active_version_id
  WHERE  pl.procedure_code    = 'INFORMED_CONSENT'
    AND  pl.library_scope     = 'global'
    AND  pbv.blueprint_status = 'published';

  IF NOT FOUND THEN
    RAISE NOTICE 'CHECK 1 WARN: INFORMED_CONSENT not found or missing active published version';
  ELSE
    RAISE NOTICE 'CHECK 1 OK: INFORMED_CONSENT has active published version';
  END IF;

  -- CHECK 2: SPECIMEN_COLLECTION has active published version
  SELECT 1 INTO v_count
  FROM   procedure_library pl
  JOIN   procedure_blueprint_versions pbv ON pbv.id = pl.active_version_id
  WHERE  pl.procedure_code    = 'SPECIMEN_COLLECTION'
    AND  pl.library_scope     = 'global'
    AND  pbv.blueprint_status = 'published';

  IF NOT FOUND THEN
    RAISE NOTICE 'CHECK 2 WARN: SPECIMEN_COLLECTION not found or missing active published version';
  ELSE
    RAISE NOTICE 'CHECK 2 OK: SPECIMEN_COLLECTION has active published version';
  END IF;

  -- CHECK 3: SYMPTOM_ASSESSMENT has active published version
  SELECT 1 INTO v_count
  FROM   procedure_library pl
  JOIN   procedure_blueprint_versions pbv ON pbv.id = pl.active_version_id
  WHERE  pl.procedure_code    = 'SYMPTOM_ASSESSMENT'
    AND  pl.library_scope     = 'global'
    AND  pbv.blueprint_status = 'published';

  IF NOT FOUND THEN
    RAISE NOTICE 'CHECK 3 WARN: SYMPTOM_ASSESSMENT not found or missing active published version';
  ELSE
    RAISE NOTICE 'CHECK 3 OK: SYMPTOM_ASSESSMENT has active published version';
  END IF;

  -- CHECK 4: HOUSEHOLD_LINKAGE has active published version
  SELECT 1 INTO v_count
  FROM   procedure_library pl
  JOIN   procedure_blueprint_versions pbv ON pbv.id = pl.active_version_id
  WHERE  pl.procedure_code    = 'HOUSEHOLD_LINKAGE'
    AND  pl.library_scope     = 'global'
    AND  pbv.blueprint_status = 'published';

  IF NOT FOUND THEN
    RAISE NOTICE 'CHECK 4 WARN: HOUSEHOLD_LINKAGE not found or missing active published version';
  ELSE
    RAISE NOTICE 'CHECK 4 OK: HOUSEHOLD_LINKAGE has active published version';
  END IF;

  -- CHECK 5: UNSCHEDULED_VISIT_ASSESSMENT has active published version
  SELECT 1 INTO v_count
  FROM   procedure_library pl
  JOIN   procedure_blueprint_versions pbv ON pbv.id = pl.active_version_id
  WHERE  pl.procedure_code    = 'UNSCHEDULED_VISIT_ASSESSMENT'
    AND  pl.library_scope     = 'global'
    AND  pbv.blueprint_status = 'published';

  IF NOT FOUND THEN
    RAISE NOTICE 'CHECK 5 WARN: UNSCHEDULED_VISIT_ASSESSMENT not found or missing active published version';
  ELSE
    RAISE NOTICE 'CHECK 5 OK: UNSCHEDULED_VISIT_ASSESSMENT has active published version';
  END IF;

  -- CHECK 6: Count of blueprints with tier = 'universal' in global scope
  -- Note: tier is stored in the tags array; 'universal' tier blueprints are tagged accordingly.
  -- We count procedure_library rows tagged 'universal' with an active published version.
  SELECT COUNT(*) INTO v_cnt_universal
  FROM   procedure_library pl
  JOIN   procedure_blueprint_versions pbv ON pbv.id = pl.active_version_id
  WHERE  pl.library_scope     = 'global'
    AND  pl.status            = 'active'
    AND  pbv.blueprint_status = 'published'
    AND  pl.tags && ARRAY['universal'];

  RAISE NOTICE 'CHECK 6 INFO: blueprints tagged universal (active, published, global scope) = %', v_cnt_universal;

  -- CHECK 7: Count of all active published blueprints in global scope
  SELECT COUNT(*) INTO v_cnt_published
  FROM   procedure_library pl
  JOIN   procedure_blueprint_versions pbv ON pbv.id = pl.active_version_id
  WHERE  pl.library_scope     = 'global'
    AND  pl.status            = 'active'
    AND  pbv.blueprint_status = 'published';

  RAISE NOTICE 'CHECK 7 INFO: total active published blueprints in global scope = %', v_cnt_published;

END $$;
