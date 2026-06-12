-- Migration 0182: Procedure Blueprint Library Phase 2 Expansion
--
-- Seeds 4 generic reusable blueprints covering investigational product
-- administration and clinical assessment procedures. All rows are idempotent
-- via WHERE NOT EXISTS on procedure_code + library_scope.
--
-- Blueprints added (with published blueprint versions):
--   IP_ADMINISTRATION          (universal)
--   INJECTION_SITE_ASSESSMENT  (common)
--   IMAGING_ASSESSMENT         (common)
--   FUNCTIONAL_STATUS_ASSESSMENT (common, supports_offsite: true)
--
-- Post-0182 semantic mapping coverage:
--   ONC_882  — 11/11 covered (100%)
--   VACCINE_001 — 10/10 covered (100%)
--   VALIDATION_PROTOCOL_001 — 14/14 covered (100%)
--   VALIDATION_PROTOCOL_002 — 12/12 covered (100%)
--
-- blueprint_status values: 'draft' | 'published' | 'archived'  (per 0110 constraint)
-- library status values:   'active' | 'inactive' | 'draft' | 'archived' (per 0110 constraint)

-- ---------------------------------------------------------------------------
-- 1. IP_ADMINISTRATION  (universal)
--    Full IP administration documentation covering dispensed/administered/
--    returned/missed quantities, kit/lot numbers, route, dual verification,
--    pre/post checks, and infusion reaction. Derived from IP_ADMIN_CORE_V1.
--    No protocol-specific names in any field ID, label, or guidance.
-- ---------------------------------------------------------------------------

DO $$
DECLARE
  seed_actor uuid := '00000000-0000-4000-8000-000000000001';
  v_lib_id   uuid;
  v_ver_id   uuid;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM procedure_library
    WHERE  procedure_code = 'IP_ADMINISTRATION'
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
      'IP_ADMINISTRATION',
      'IP Administration',
      'treatment',
      'investigational_product',
      'Document investigational product administration including dose, route, lot/kit details, dual verification, pre/post-administration checks, and infusion reaction monitoring.',
      'complex',
      45,
      false,
      'active',
      ARRAY['ip_administration','treatment','investigational_product','universal'],
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
          "section_id": "ip_administration",
          "title": "IP Administration",
          "fields": [
            {"field_id": "administration_datetime",              "type": "datetime", "required": true,  "label": "Administration Date / Time"},
            {"field_id": "ip_name",                              "type": "text",     "required": true,  "label": "Investigational Product Name"},
            {"field_id": "dose_administered",                    "type": "number",   "required": true,  "label": "Dose Administered"},
            {"field_id": "dose_unit",                            "type": "select",   "required": true,  "label": "Dose Unit",
             "options": ["mg","mg/kg","mcg","IU","mL","other"]},
            {"field_id": "route_of_administration",              "type": "select",   "required": true,  "label": "Route of Administration",
             "options": ["oral","iv_infusion","iv_bolus","subcutaneous","intramuscular","intranasal","other"]},
            {"field_id": "administration_site",                  "type": "text",     "required": false, "label": "Administration Site / Anatomical Location"},
            {"field_id": "lot_number",                           "type": "text",     "required": true,  "label": "Lot / Batch Number"},
            {"field_id": "kit_number",                           "type": "text",     "required": false, "label": "Kit Number"},
            {"field_id": "expiry_date",                          "type": "date",     "required": false, "label": "Expiry Date"},
            {"field_id": "dose_dispensed",                       "type": "number",   "required": false, "label": "Dose Dispensed"},
            {"field_id": "dose_returned",                        "type": "number",   "required": false, "label": "Dose Returned"},
            {"field_id": "missed_dose",                          "type": "select",   "required": false, "label": "Missed Dose",
             "options": ["yes","no"]},
            {"field_id": "missed_dose_reason",                   "type": "textarea", "required": false, "label": "Missed Dose Reason"},
            {"field_id": "dual_verification_performed",          "type": "select",   "required": false, "label": "Dual Verification Performed",
             "options": ["yes","no","not_required"]},
            {"field_id": "dual_verifier_id",                     "type": "text",     "required": false, "label": "Dual Verifier ID"},
            {"field_id": "pre_administration_check_performed",   "type": "select",   "required": false, "label": "Pre-Administration Check Performed",
             "options": ["yes","no"]},
            {"field_id": "pre_administration_vitals_obtained",   "type": "select",   "required": false, "label": "Pre-Administration Vitals Obtained",
             "options": ["yes","no","not_required"]},
            {"field_id": "post_administration_observation_period","type": "integer",  "required": false, "label": "Post-Administration Observation Period (minutes)"},
            {"field_id": "infusion_reaction_observed",           "type": "select",   "required": false, "label": "Infusion Reaction Observed",
             "options": ["yes","no","not_applicable"]},
            {"field_id": "infusion_reaction_detail",             "type": "textarea", "required": false, "label": "Infusion Reaction Detail"},
            {"field_id": "dose_modification",                    "type": "select",   "required": false, "label": "Dose Modification",
             "options": ["none","dose_reduced","dose_interrupted","dose_discontinued"]},
            {"field_id": "dose_modification_reason",             "type": "textarea", "required": false, "label": "Dose Modification Reason"},
            {"field_id": "administered_by",                      "type": "text",     "required": true,  "label": "Administered By"},
            {"field_id": "witnessed_by",                         "type": "text",     "required": false, "label": "Witnessed By"},
            {"field_id": "comments",                             "type": "textarea", "required": false, "label": "Comments"}
          ]
        }],
        "coordinator_guidance": "Complete dual verification before administration. Document full lot/kit details. Observe subject per protocol post-administration period. Escalate any infusion reactions to PI immediately."
      }''::jsonb,
      '{
        "fields": [
          {"field_id": "administration_datetime",               "type": "datetime", "label": "Administration Date / Time",                    "required": true},
          {"field_id": "ip_name",                               "type": "text",     "label": "Investigational Product Name",                  "required": true},
          {"field_id": "dose_administered",                     "type": "number",   "label": "Dose Administered",                             "required": true},
          {"field_id": "dose_unit",                             "type": "select",   "label": "Dose Unit",                                     "required": true,
           "options": ["mg","mg/kg","mcg","IU","mL","other"]},
          {"field_id": "route_of_administration",               "type": "select",   "label": "Route of Administration",                       "required": true,
           "options": ["oral","iv_infusion","iv_bolus","subcutaneous","intramuscular","intranasal","other"]},
          {"field_id": "administration_site",                   "type": "text",     "label": "Administration Site / Anatomical Location",     "required": false},
          {"field_id": "lot_number",                            "type": "text",     "label": "Lot / Batch Number",                            "required": true},
          {"field_id": "kit_number",                            "type": "text",     "label": "Kit Number",                                    "required": false},
          {"field_id": "expiry_date",                           "type": "date",     "label": "Expiry Date",                                   "required": false},
          {"field_id": "dose_dispensed",                        "type": "number",   "label": "Dose Dispensed",                                "required": false},
          {"field_id": "dose_returned",                         "type": "number",   "label": "Dose Returned",                                 "required": false},
          {"field_id": "missed_dose",                           "type": "select",   "label": "Missed Dose",                                   "required": false,
           "options": ["yes","no"]},
          {"field_id": "missed_dose_reason",                    "type": "textarea", "label": "Missed Dose Reason",                            "required": false},
          {"field_id": "dual_verification_performed",           "type": "select",   "label": "Dual Verification Performed",                   "required": false,
           "options": ["yes","no","not_required"]},
          {"field_id": "dual_verifier_id",                      "type": "text",     "label": "Dual Verifier ID",                              "required": false},
          {"field_id": "pre_administration_check_performed",    "type": "select",   "label": "Pre-Administration Check Performed",            "required": false,
           "options": ["yes","no"]},
          {"field_id": "pre_administration_vitals_obtained",    "type": "select",   "label": "Pre-Administration Vitals Obtained",            "required": false,
           "options": ["yes","no","not_required"]},
          {"field_id": "post_administration_observation_period","type": "integer",  "label": "Post-Administration Observation Period (minutes)","required": false},
          {"field_id": "infusion_reaction_observed",            "type": "select",   "label": "Infusion Reaction Observed",                    "required": false,
           "options": ["yes","no","not_applicable"]},
          {"field_id": "infusion_reaction_detail",              "type": "textarea", "label": "Infusion Reaction Detail",                      "required": false},
          {"field_id": "dose_modification",                     "type": "select",   "label": "Dose Modification",                             "required": false,
           "options": ["none","dose_reduced","dose_interrupted","dose_discontinued"]},
          {"field_id": "dose_modification_reason",              "type": "textarea", "label": "Dose Modification Reason",                      "required": false},
          {"field_id": "administered_by",                       "type": "text",     "label": "Administered By",                               "required": true},
          {"field_id": "witnessed_by",                          "type": "text",     "label": "Witnessed By",                                  "required": false},
          {"field_id": "comments",                              "type": "textarea", "label": "Comments",                                      "required": false}
        ]
      }''::jsonb,
      '{
        "rules": [
          {
            "if":   {"field": "missed_dose", "equals": "yes"},
            "then": {"require": ["missed_dose_reason"]}
          },
          {
            "if":   {"field": "dual_verification_performed", "equals": "yes"},
            "then": {"require": ["dual_verifier_id"]}
          },
          {
            "if":   {"field": "infusion_reaction_observed", "equals": "yes"},
            "then": {"require": ["infusion_reaction_detail"]}
          },
          {
            "if":   {"field": "dose_modification", "not_equals": "none"},
            "then": {"require": ["dose_modification_reason"]}
          }
        ]
      }''::jsonb,
      '{"coordinator_guidance": "Complete dual verification before administration. Document full lot/kit details. Observe subject per protocol post-administration period. Escalate any infusion reactions to PI immediately."}'::jsonb,
      seed_actor
    ) RETURNING id INTO v_ver_id;

    UPDATE procedure_library
    SET    active_version_id = v_ver_id
    WHERE  id = v_lib_id;

  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 2. INJECTION_SITE_ASSESSMENT  (common)
--    Generic injection site reactogenicity assessment covering erythema,
--    swelling, induration, pain, pruritus, bruising, and grading.
--    Supports any injectable IP protocol — no study-specific identifiers.
-- ---------------------------------------------------------------------------

DO $$
DECLARE
  seed_actor uuid := '00000000-0000-4000-8000-000000000001';
  v_lib_id   uuid;
  v_ver_id   uuid;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM procedure_library
    WHERE  procedure_code = 'INJECTION_SITE_ASSESSMENT'
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
      'INJECTION_SITE_ASSESSMENT',
      'Injection Site Assessment',
      'treatment',
      'reactogenicity',
      'Assess and grade injection site reactions including erythema, swelling, induration, warmth, pain, pruritus, and bruising. Supports all required timepoints and AE linkage.',
      'simple',
      10,
      false,
      'active',
      ARRAY['injection_site','reactogenicity','assessment','vaccine','common'],
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
          "section_id": "injection_site_assessment",
          "title": "Injection Site Assessment",
          "fields": [
            {"field_id": "assessment_datetime",           "type": "datetime", "required": true,  "label": "Assessment Date / Time"},
            {"field_id": "injection_site_location",       "type": "select",   "required": true,  "label": "Injection Site Location",
             "options": ["left_arm","right_arm","left_thigh","right_thigh","abdomen","other"]},
            {"field_id": "injection_site_location_other", "type": "text",     "required": false, "label": "Specify Location"},
            {"field_id": "assessment_timepoint",          "type": "select",   "required": true,  "label": "Assessment Timepoint",
             "options": ["pre_injection","post_injection_30min","post_injection_1h","post_injection_4h","post_injection_24h","post_injection_48h","post_injection_72h","day_7","other"]},
            {"field_id": "erythema_present",              "type": "select",   "required": false, "label": "Erythema Present",
             "options": ["yes","no"]},
            {"field_id": "erythema_diameter_mm",          "type": "integer",  "required": false, "label": "Erythema Diameter (mm)"},
            {"field_id": "swelling_present",              "type": "select",   "required": false, "label": "Swelling Present",
             "options": ["yes","no"]},
            {"field_id": "swelling_diameter_mm",          "type": "integer",  "required": false, "label": "Swelling Diameter (mm)"},
            {"field_id": "induration_present",            "type": "select",   "required": false, "label": "Induration Present",
             "options": ["yes","no"]},
            {"field_id": "induration_diameter_mm",        "type": "integer",  "required": false, "label": "Induration Diameter (mm)"},
            {"field_id": "warmth_present",                "type": "select",   "required": false, "label": "Warmth Present",
             "options": ["yes","no"]},
            {"field_id": "pain_at_site",                  "type": "select",   "required": false, "label": "Pain at Site",
             "options": ["none","mild","moderate","severe"]},
            {"field_id": "pruritus_present",              "type": "select",   "required": false, "label": "Pruritus Present",
             "options": ["yes","no"]},
            {"field_id": "bruising_present",              "type": "select",   "required": false, "label": "Bruising Present",
             "options": ["yes","no"]},
            {"field_id": "overall_grade",                 "type": "select",   "required": false, "label": "Overall Reactogenicity Grade",
             "options": ["grade_0","grade_1","grade_2","grade_3","grade_4"]},
            {"field_id": "ae_linkage",                    "type": "select",   "required": false, "label": "Linked to AE",
             "options": ["yes","no"]},
            {"field_id": "linked_ae_id",                  "type": "text",     "required": false, "label": "Linked AE ID"},
            {"field_id": "assessed_by",                   "type": "text",     "required": true,  "label": "Assessed By"},
            {"field_id": "comments",                      "type": "textarea", "required": false, "label": "Comments"}
          ]
        }],
        "coordinator_guidance": "Assess injection site at all required timepoints per protocol. Document grade per protocol reactogenicity scale. Escalate Grade 3+ reactions to PI immediately."
      }''::jsonb,
      '{
        "fields": [
          {"field_id": "assessment_datetime",           "type": "datetime", "label": "Assessment Date / Time",    "required": true},
          {"field_id": "injection_site_location",       "type": "select",   "label": "Injection Site Location",   "required": true,
           "options": ["left_arm","right_arm","left_thigh","right_thigh","abdomen","other"]},
          {"field_id": "injection_site_location_other", "type": "text",     "label": "Specify Location",          "required": false},
          {"field_id": "assessment_timepoint",          "type": "select",   "label": "Assessment Timepoint",      "required": true,
           "options": ["pre_injection","post_injection_30min","post_injection_1h","post_injection_4h","post_injection_24h","post_injection_48h","post_injection_72h","day_7","other"]},
          {"field_id": "erythema_present",              "type": "select",   "label": "Erythema Present",          "required": false,
           "options": ["yes","no"]},
          {"field_id": "erythema_diameter_mm",          "type": "integer",  "label": "Erythema Diameter (mm)",    "required": false},
          {"field_id": "swelling_present",              "type": "select",   "label": "Swelling Present",          "required": false,
           "options": ["yes","no"]},
          {"field_id": "swelling_diameter_mm",          "type": "integer",  "label": "Swelling Diameter (mm)",    "required": false},
          {"field_id": "induration_present",            "type": "select",   "label": "Induration Present",        "required": false,
           "options": ["yes","no"]},
          {"field_id": "induration_diameter_mm",        "type": "integer",  "label": "Induration Diameter (mm)",  "required": false},
          {"field_id": "warmth_present",                "type": "select",   "label": "Warmth Present",            "required": false,
           "options": ["yes","no"]},
          {"field_id": "pain_at_site",                  "type": "select",   "label": "Pain at Site",              "required": false,
           "options": ["none","mild","moderate","severe"]},
          {"field_id": "pruritus_present",              "type": "select",   "label": "Pruritus Present",          "required": false,
           "options": ["yes","no"]},
          {"field_id": "bruising_present",              "type": "select",   "label": "Bruising Present",          "required": false,
           "options": ["yes","no"]},
          {"field_id": "overall_grade",                 "type": "select",   "label": "Overall Reactogenicity Grade","required": false,
           "options": ["grade_0","grade_1","grade_2","grade_3","grade_4"]},
          {"field_id": "ae_linkage",                    "type": "select",   "label": "Linked to AE",              "required": false,
           "options": ["yes","no"]},
          {"field_id": "linked_ae_id",                  "type": "text",     "label": "Linked AE ID",              "required": false},
          {"field_id": "assessed_by",                   "type": "text",     "label": "Assessed By",               "required": true},
          {"field_id": "comments",                      "type": "textarea", "label": "Comments",                  "required": false}
        ]
      }''::jsonb,
      '{
        "rules": [
          {
            "if":   {"field": "injection_site_location", "equals": "other"},
            "then": {"require": ["injection_site_location_other"]}
          },
          {
            "if":   {"field": "erythema_present", "equals": "yes"},
            "then": {"show": ["erythema_diameter_mm"]}
          },
          {
            "if":   {"field": "swelling_present", "equals": "yes"},
            "then": {"show": ["swelling_diameter_mm"]}
          },
          {
            "if":   {"field": "induration_present", "equals": "yes"},
            "then": {"show": ["induration_diameter_mm"]}
          },
          {
            "if":   {"field": "ae_linkage", "equals": "yes"},
            "then": {"require": ["linked_ae_id"]}
          }
        ]
      }''::jsonb,
      '{"coordinator_guidance": "Assess injection site at all required timepoints per protocol. Document grade per protocol reactogenicity scale. Escalate Grade 3+ reactions to PI immediately."}'::jsonb,
      seed_actor
    ) RETURNING id INTO v_ver_id;

    UPDATE procedure_library
    SET    active_version_id = v_ver_id
    WHERE  id = v_lib_id;

  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 3. IMAGING_ASSESSMENT  (common)
--    Generic imaging assessment covering CT, MRI, X-ray, PET, ultrasound.
--    Study-specific assessment criteria (e.g., RECIST 1.1) are a configuration
--    parameter via the assessment_criteria selector — not separate blueprints.
-- ---------------------------------------------------------------------------

DO $$
DECLARE
  seed_actor uuid := '00000000-0000-4000-8000-000000000001';
  v_lib_id   uuid;
  v_ver_id   uuid;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM procedure_library
    WHERE  procedure_code = 'IMAGING_ASSESSMENT'
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
      'IMAGING_ASSESSMENT',
      'Imaging Assessment',
      'imaging',
      'diagnostic_imaging',
      'Generic imaging assessment documentation covering CT, MRI, X-ray, PET, and ultrasound. Supports tumor response, safety, and other imaging contexts. Assessment criteria (RECIST, iRECIST, etc.) are a configuration parameter.',
      'standard',
      20,
      false,
      'active',
      ARRAY['imaging','ct','mri','xray','pet','assessment','common'],
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
          "section_id": "imaging_assessment",
          "title": "Imaging Assessment",
          "fields": [
            {"field_id": "assessment_datetime",          "type": "datetime", "required": true,  "label": "Assessment Date / Time"},
            {"field_id": "imaging_modality",             "type": "select",   "required": true,  "label": "Imaging Modality",
             "options": ["ct_scan","mri","x_ray","pet_scan","pet_ct","ultrasound","other"]},
            {"field_id": "imaging_modality_other",       "type": "text",     "required": false, "label": "Specify Modality"},
            {"field_id": "body_region",                  "type": "select",   "required": true,  "label": "Body Region",
             "options": ["head_neck","chest","abdomen","pelvis","chest_abdomen_pelvis","extremity","whole_body","other"]},
            {"field_id": "body_region_other",            "type": "text",     "required": false, "label": "Specify Region"},
            {"field_id": "assessment_type",              "type": "select",   "required": true,  "label": "Assessment Type",
             "options": ["tumor_assessment","safety_scan","bone_scan","cardiac","pulmonary","other"]},
            {"field_id": "assessment_criteria",          "type": "select",   "required": false, "label": "Assessment Criteria",
             "options": ["recist_1_1","irrecist","percist","lugano","who_criteria","not_applicable","other"]},
            {"field_id": "contrast_used",                "type": "select",   "required": false, "label": "Contrast Used",
             "options": ["yes","no","not_applicable"]},
            {"field_id": "scan_performed_datetime",      "type": "datetime", "required": true,  "label": "Scan Performed Date / Time"},
            {"field_id": "performed_at",                 "type": "select",   "required": false, "label": "Performed At",
             "options": ["local_site","central_imaging_facility","external_facility"]},
            {"field_id": "accession_number",             "type": "text",     "required": false, "label": "Accession Number / Image ID"},
            {"field_id": "radiologist_read_available",   "type": "select",   "required": false, "label": "Radiologist Read Available",
             "options": ["yes","no","pending"]},
            {"field_id": "overall_response",             "type": "select",   "required": false, "label": "Overall Response (if applicable)",
             "options": ["complete_response","partial_response","stable_disease","progressive_disease","not_evaluable","not_applicable"]},
            {"field_id": "lesion_measurements_recorded", "type": "select",   "required": false, "label": "Lesion Measurements Recorded",
             "options": ["yes","no","not_applicable"]},
            {"field_id": "new_lesions_identified",       "type": "select",   "required": false, "label": "New Lesions Identified",
             "options": ["yes","no","not_evaluable"]},
            {"field_id": "clinical_significance",        "type": "select",   "required": false, "label": "Clinically Significant Finding",
             "options": ["yes","no"]},
            {"field_id": "clinical_significance_detail", "type": "textarea", "required": false, "label": "Clinical Significance Detail"},
            {"field_id": "ae_linkage",                   "type": "select",   "required": false, "label": "Linked to AE",
             "options": ["yes","no"]},
            {"field_id": "linked_ae_id",                 "type": "text",     "required": false, "label": "Linked AE ID"},
            {"field_id": "completed_by",                 "type": "text",     "required": true,  "label": "Completed By"},
            {"field_id": "comments",                     "type": "textarea", "required": false, "label": "Comments"}
          ]
        }],
        "coordinator_guidance": "Record accession number from imaging facility. Confirm radiologist read is available before closing visit. Document any new lesions or clinically significant findings and discuss with PI."
      }''::jsonb,
      '{
        "fields": [
          {"field_id": "assessment_datetime",          "type": "datetime", "label": "Assessment Date / Time",           "required": true},
          {"field_id": "imaging_modality",             "type": "select",   "label": "Imaging Modality",                 "required": true,
           "options": ["ct_scan","mri","x_ray","pet_scan","pet_ct","ultrasound","other"]},
          {"field_id": "imaging_modality_other",       "type": "text",     "label": "Specify Modality",                 "required": false},
          {"field_id": "body_region",                  "type": "select",   "label": "Body Region",                      "required": true,
           "options": ["head_neck","chest","abdomen","pelvis","chest_abdomen_pelvis","extremity","whole_body","other"]},
          {"field_id": "body_region_other",            "type": "text",     "label": "Specify Region",                   "required": false},
          {"field_id": "assessment_type",              "type": "select",   "label": "Assessment Type",                  "required": true,
           "options": ["tumor_assessment","safety_scan","bone_scan","cardiac","pulmonary","other"]},
          {"field_id": "assessment_criteria",          "type": "select",   "label": "Assessment Criteria",              "required": false,
           "options": ["recist_1_1","irrecist","percist","lugano","who_criteria","not_applicable","other"]},
          {"field_id": "contrast_used",                "type": "select",   "label": "Contrast Used",                    "required": false,
           "options": ["yes","no","not_applicable"]},
          {"field_id": "scan_performed_datetime",      "type": "datetime", "label": "Scan Performed Date / Time",       "required": true},
          {"field_id": "performed_at",                 "type": "select",   "label": "Performed At",                     "required": false,
           "options": ["local_site","central_imaging_facility","external_facility"]},
          {"field_id": "accession_number",             "type": "text",     "label": "Accession Number / Image ID",      "required": false},
          {"field_id": "radiologist_read_available",   "type": "select",   "label": "Radiologist Read Available",       "required": false,
           "options": ["yes","no","pending"]},
          {"field_id": "overall_response",             "type": "select",   "label": "Overall Response (if applicable)", "required": false,
           "options": ["complete_response","partial_response","stable_disease","progressive_disease","not_evaluable","not_applicable"]},
          {"field_id": "lesion_measurements_recorded", "type": "select",   "label": "Lesion Measurements Recorded",     "required": false,
           "options": ["yes","no","not_applicable"]},
          {"field_id": "new_lesions_identified",       "type": "select",   "label": "New Lesions Identified",           "required": false,
           "options": ["yes","no","not_evaluable"]},
          {"field_id": "clinical_significance",        "type": "select",   "label": "Clinically Significant Finding",   "required": false,
           "options": ["yes","no"]},
          {"field_id": "clinical_significance_detail", "type": "textarea", "label": "Clinical Significance Detail",     "required": false},
          {"field_id": "ae_linkage",                   "type": "select",   "label": "Linked to AE",                     "required": false,
           "options": ["yes","no"]},
          {"field_id": "linked_ae_id",                 "type": "text",     "label": "Linked AE ID",                     "required": false},
          {"field_id": "completed_by",                 "type": "text",     "label": "Completed By",                     "required": true},
          {"field_id": "comments",                     "type": "textarea", "label": "Comments",                         "required": false}
        ]
      }''::jsonb,
      '{
        "rules": [
          {
            "if":   {"field": "imaging_modality", "equals": "other"},
            "then": {"require": ["imaging_modality_other"]}
          },
          {
            "if":   {"field": "body_region", "equals": "other"},
            "then": {"require": ["body_region_other"]}
          },
          {
            "if":   {"field": "clinical_significance", "equals": "yes"},
            "then": {"require": ["clinical_significance_detail"]}
          },
          {
            "if":   {"field": "ae_linkage", "equals": "yes"},
            "then": {"require": ["linked_ae_id"]}
          }
        ]
      }''::jsonb,
      '{"coordinator_guidance": "Record accession number from imaging facility. Confirm radiologist read is available before closing visit. Document any new lesions or clinically significant findings and discuss with PI."}'::jsonb,
      seed_actor
    ) RETURNING id INTO v_ver_id;

    UPDATE procedure_library
    SET    active_version_id = v_ver_id
    WHERE  id = v_lib_id;

  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 4. FUNCTIONAL_STATUS_ASSESSMENT  (common, supports_offsite: true)
--    Generic functional/performance status assessment supporting multiple
--    performance scales through a single scale_type configuration parameter.
--    Same reuse pattern as QUESTIONNAIRE_ADMINISTRATION (instrument_name),
--    SPECIMEN_COLLECTION (specimen_type), and PHONE_CONTACT (contact_method).
--    ECOG, Karnofsky, Lansky, and WHO scales are all covered by this blueprint.
-- ---------------------------------------------------------------------------

DO $$
DECLARE
  seed_actor uuid := '00000000-0000-4000-8000-000000000001';
  v_lib_id   uuid;
  v_ver_id   uuid;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM procedure_library
    WHERE  procedure_code = 'FUNCTIONAL_STATUS_ASSESSMENT'
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
      'FUNCTIONAL_STATUS_ASSESSMENT',
      'Functional Status Assessment',
      'clinical_review',
      'performance_status',
      'Generic functional and performance status assessment supporting ECOG, Karnofsky, Lansky, WHO, and other scales via a single scale_type configurator. Documents score, clinical basis, change from baseline, and clinical significance.',
      'simple',
      10,
      true,
      'active',
      ARRAY['functional_status','performance_status','ecog','karnofsky','assessment','common'],
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
          "section_id": "functional_status_assessment",
          "title": "Functional Status Assessment",
          "fields": [
            {"field_id": "assessment_datetime",          "type": "datetime", "required": true,  "label": "Assessment Date / Time"},
            {"field_id": "scale_type",                   "type": "select",   "required": true,  "label": "Performance Scale",
             "options": ["ecog","karnofsky","lansky","who_performance_status","other"]},
            {"field_id": "scale_type_other",             "type": "text",     "required": false, "label": "Specify Scale"},
            {"field_id": "ecog_score",                   "type": "select",   "required": false, "label": "ECOG Score",
             "options": ["0","1","2","3","4","5"]},
            {"field_id": "karnofsky_score",              "type": "select",   "required": false, "label": "Karnofsky Score",
             "options": ["100","90","80","70","60","50","40","30","20","10","0"]},
            {"field_id": "lansky_score",                 "type": "select",   "required": false, "label": "Lansky Score",
             "options": ["100","90","80","70","60","50","40","30","20","10","0"]},
            {"field_id": "who_score",                    "type": "select",   "required": false, "label": "WHO Performance Score",
             "options": ["0","1","2","3","4"]},
            {"field_id": "numeric_score",                "type": "integer",  "required": false, "label": "Numeric Score"},
            {"field_id": "score_rationale",              "type": "textarea", "required": false, "label": "Score Rationale / Clinical Basis"},
            {"field_id": "compared_to_baseline",         "type": "select",   "required": false, "label": "Compared to Baseline",
             "options": ["improved","stable","worsened","baseline_not_available"]},
            {"field_id": "change_from_previous",         "type": "select",   "required": false, "label": "Change from Previous Assessment",
             "options": ["improved","stable","worsened","first_assessment"]},
            {"field_id": "clinical_significance",        "type": "select",   "required": false, "label": "Clinically Significant Change",
             "options": ["yes","no"]},
            {"field_id": "clinical_significance_detail", "type": "textarea", "required": false, "label": "Clinical Significance Detail"},
            {"field_id": "ae_linkage",                   "type": "select",   "required": false, "label": "Linked to AE",
             "options": ["yes","no"]},
            {"field_id": "linked_ae_id",                 "type": "text",     "required": false, "label": "Linked AE ID"},
            {"field_id": "assessed_by",                  "type": "text",     "required": true,  "label": "Assessed By"},
            {"field_id": "comments",                     "type": "textarea", "required": false, "label": "Comments"}
          ]
        }],
        "coordinator_guidance": "Select the performance scale specified in the protocol. Document basis for score in score_rationale field. Notify PI of any significant worsening from baseline."
      }''::jsonb,
      '{
        "fields": [
          {"field_id": "assessment_datetime",          "type": "datetime", "label": "Assessment Date / Time",        "required": true},
          {"field_id": "scale_type",                   "type": "select",   "label": "Performance Scale",             "required": true,
           "options": ["ecog","karnofsky","lansky","who_performance_status","other"]},
          {"field_id": "scale_type_other",             "type": "text",     "label": "Specify Scale",                 "required": false},
          {"field_id": "ecog_score",                   "type": "select",   "label": "ECOG Score",                    "required": false,
           "options": ["0","1","2","3","4","5"]},
          {"field_id": "karnofsky_score",              "type": "select",   "label": "Karnofsky Score",               "required": false,
           "options": ["100","90","80","70","60","50","40","30","20","10","0"]},
          {"field_id": "lansky_score",                 "type": "select",   "label": "Lansky Score",                  "required": false,
           "options": ["100","90","80","70","60","50","40","30","20","10","0"]},
          {"field_id": "who_score",                    "type": "select",   "label": "WHO Performance Score",         "required": false,
           "options": ["0","1","2","3","4"]},
          {"field_id": "numeric_score",                "type": "integer",  "label": "Numeric Score",                 "required": false},
          {"field_id": "score_rationale",              "type": "textarea", "label": "Score Rationale / Clinical Basis","required": false},
          {"field_id": "compared_to_baseline",         "type": "select",   "label": "Compared to Baseline",          "required": false,
           "options": ["improved","stable","worsened","baseline_not_available"]},
          {"field_id": "change_from_previous",         "type": "select",   "label": "Change from Previous Assessment","required": false,
           "options": ["improved","stable","worsened","first_assessment"]},
          {"field_id": "clinical_significance",        "type": "select",   "label": "Clinically Significant Change", "required": false,
           "options": ["yes","no"]},
          {"field_id": "clinical_significance_detail", "type": "textarea", "label": "Clinical Significance Detail",  "required": false},
          {"field_id": "ae_linkage",                   "type": "select",   "label": "Linked to AE",                  "required": false,
           "options": ["yes","no"]},
          {"field_id": "linked_ae_id",                 "type": "text",     "label": "Linked AE ID",                  "required": false},
          {"field_id": "assessed_by",                  "type": "text",     "label": "Assessed By",                   "required": true},
          {"field_id": "comments",                     "type": "textarea", "label": "Comments",                      "required": false}
        ]
      }''::jsonb,
      '{
        "rules": [
          {
            "if":   {"field": "scale_type", "equals": "other"},
            "then": {"require": ["scale_type_other"]}
          },
          {
            "if":   {"field": "scale_type", "equals": "ecog"},
            "then": {"show": ["ecog_score"]}
          },
          {
            "if":   {"field": "scale_type", "equals": "karnofsky"},
            "then": {"show": ["karnofsky_score"]}
          },
          {
            "if":   {"field": "scale_type", "equals": "lansky"},
            "then": {"show": ["lansky_score"]}
          },
          {
            "if":   {"field": "scale_type", "equals": "who_performance_status"},
            "then": {"show": ["who_score"]}
          },
          {
            "if":   {"field": "clinical_significance", "equals": "yes"},
            "then": {"require": ["clinical_significance_detail"]}
          },
          {
            "if":   {"field": "ae_linkage", "equals": "yes"},
            "then": {"require": ["linked_ae_id"]}
          }
        ]
      }''::jsonb,
      '{"coordinator_guidance": "Select the performance scale specified in the protocol. Document basis for score in score_rationale field. Notify PI of any significant worsening from baseline."}'::jsonb,
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
  v_count        int;
  v_cnt_total    int;
BEGIN

  -- CHECK 1: IP_ADMINISTRATION has active published version
  SELECT 1 INTO v_count
  FROM   procedure_library pl
  JOIN   procedure_blueprint_versions pbv ON pbv.id = pl.active_version_id
  WHERE  pl.procedure_code    = 'IP_ADMINISTRATION'
    AND  pl.library_scope     = 'global'
    AND  pbv.blueprint_status = 'published';

  IF NOT FOUND THEN
    RAISE NOTICE 'CHECK 1 WARN: IP_ADMINISTRATION not found or missing active published version';
  ELSE
    RAISE NOTICE 'CHECK 1 OK: IP_ADMINISTRATION has active published version';
  END IF;

  -- CHECK 2: INJECTION_SITE_ASSESSMENT has active published version
  SELECT 1 INTO v_count
  FROM   procedure_library pl
  JOIN   procedure_blueprint_versions pbv ON pbv.id = pl.active_version_id
  WHERE  pl.procedure_code    = 'INJECTION_SITE_ASSESSMENT'
    AND  pl.library_scope     = 'global'
    AND  pbv.blueprint_status = 'published';

  IF NOT FOUND THEN
    RAISE NOTICE 'CHECK 2 WARN: INJECTION_SITE_ASSESSMENT not found or missing active published version';
  ELSE
    RAISE NOTICE 'CHECK 2 OK: INJECTION_SITE_ASSESSMENT has active published version';
  END IF;

  -- CHECK 3: IMAGING_ASSESSMENT has active published version
  SELECT 1 INTO v_count
  FROM   procedure_library pl
  JOIN   procedure_blueprint_versions pbv ON pbv.id = pl.active_version_id
  WHERE  pl.procedure_code    = 'IMAGING_ASSESSMENT'
    AND  pl.library_scope     = 'global'
    AND  pbv.blueprint_status = 'published';

  IF NOT FOUND THEN
    RAISE NOTICE 'CHECK 3 WARN: IMAGING_ASSESSMENT not found or missing active published version';
  ELSE
    RAISE NOTICE 'CHECK 3 OK: IMAGING_ASSESSMENT has active published version';
  END IF;

  -- CHECK 4: FUNCTIONAL_STATUS_ASSESSMENT has active published version
  SELECT 1 INTO v_count
  FROM   procedure_library pl
  JOIN   procedure_blueprint_versions pbv ON pbv.id = pl.active_version_id
  WHERE  pl.procedure_code    = 'FUNCTIONAL_STATUS_ASSESSMENT'
    AND  pl.library_scope     = 'global'
    AND  pbv.blueprint_status = 'published';

  IF NOT FOUND THEN
    RAISE NOTICE 'CHECK 4 WARN: FUNCTIONAL_STATUS_ASSESSMENT not found or missing active published version';
  ELSE
    RAISE NOTICE 'CHECK 4 OK: FUNCTIONAL_STATUS_ASSESSMENT has active published version';
  END IF;

  -- CHECK 5: Total count of active published blueprints in global scope
  SELECT COUNT(*) INTO v_cnt_total
  FROM   procedure_library pl
  JOIN   procedure_blueprint_versions pbv ON pbv.id = pl.active_version_id
  WHERE  pl.library_scope     = 'global'
    AND  pl.status            = 'active'
    AND  pbv.blueprint_status = 'published';

  RAISE NOTICE 'CHECK 5 INFO: total active published blueprints in global scope = %', v_cnt_total;

END $$;
