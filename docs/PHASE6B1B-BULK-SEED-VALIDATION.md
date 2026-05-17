# Phase 6B.1B — Bulk seed validation (repo DOCX sources)

**Run at:** 2026-05-17T01:57:09.757Z

## Summary

| Result | Count |
|--------|-------|
| PASS | 52 |
| FAIL | 0 |
| BLOCKED | 0 |

**Overall:** GREEN

## Checks

| Name | Status | Detail |
|------|--------|--------|
| table_pathology_library | PASS | pathology_library |
| table_medication_library | PASS | medication_library |
| table_pathology_medication_links | PASS | pathology_medication_links |
| table_subject_medical_history | PASS | subject_medical_history |
| table_subject_concomitant_medications | PASS | subject_concomitant_medications |
| seed_headache | PASS | Headache (R51.9) |
| seed_metformin | PASS | Metformin |
| bulk_pathology_count_gt_100 | PASS | pathology=493 (run npm run db:seed-phase6b1b-from-repo-files if low) |
| bulk_medication_count_gt_100 | PASS | medication=260 |
| bulk_link_count | PASS | links=59 |
| pathology_required_headache | PASS | Headache |
| pathology_required_migraine | PASS | Migraine |
| pathology_required_hypertension | PASS | Hypertension |
| pathology_required_gerd | PASS | GERD |
| pathology_required_osteoarthritis | PASS | Osteoarthritis |
| pathology_required_asthma | PASS | Asthma |
| pathology_required_depression | PASS | Depression |
| pathology_required_glaucoma | PASS | Glaucoma |
| pathology_required_hepatitis_c | PASS | Hepatitis C |
| pathology_required_breast_cancer | PASS | Breast cancer |
| medication_required_metformin | PASS | Metformin |
| medication_required_lisinopril | PASS | Lisinopril |
| medication_required_albuterol | PASS | Albuterol |
| medication_required_ibuprofen | PASS | Ibuprofen |
| index_pathology_library_common_name_idx | PASS | pathology_library |
| index_pathology_library_medical_name_idx | PASS | pathology_library |
| index_pathology_library_icd10_code_idx | PASS | pathology_library |
| index_pathology_library_system_idx | PASS | pathology_library |
| index_pathology_library_common_name_trgm_idx | PASS | pathology_library |
| index_pathology_library_synonyms_trgm_idx | PASS | pathology_library |
| index_medication_library_medication_name_idx | PASS | medication_library |
| index_medication_library_brand_name_idx | PASS | medication_library |
| index_medication_library_drug_class_idx | PASS | medication_library |
| index_subject_medical_history_org_subject_idx | PASS | subject_medical_history |
| index_subject_concomitant_medications_org_subject_idx | PASS | subject_concomitant_medications |
| subject_medical_history.organization_id_not_null | PASS | tenant column required |
| subject_medical_history.study_subject_fk | PASS | references study_subjects |
| subject_concomitant_medications.organization_id_not_null | PASS | tenant column required |
| subject_concomitant_medications.study_subject_fk | PASS | references study_subjects |
| rls_enabled_pathology_library | PASS | RLS on |
| rls_enabled_medication_library | PASS | RLS on |
| rls_enabled_pathology_medication_links | PASS | RLS on |
| rls_enabled_subject_medical_history | PASS | RLS on |
| rls_enabled_subject_concomitant_medications | PASS | RLS on |
| subject_medical_history_rls_org_scoped | PASS | 4 policies reference organization_id |
| subject_concomitant_medications_rls_org_scoped | PASS | 4 policies reference organization_id |
| pathology_library_rls_read_policy | PASS | 1 policy(ies) |
| medication_library_rls_read_policy | PASS | 1 policy(ies) |
| pathology_medication_links_rls_read_policy | PASS | 1 policy(ies) |
| search_synonym_head | PASS | Migraine, Headache, Concussion, Jaw swelling |
| search_synonym_afib | PASS | Atrial fibrillation |
| search_synonym_acid_reflux | PASS | GERD, GERDGastro-esophageal reflux disease without esophagitis, GERD with esophagitis |

## Seed command

```bash
npm run db:seed-phase6b1b-from-repo-files
npm run db:validate-phase6b1-patient-libraries
```

**Sources:** `vilo-os/Medicamentos.docx`, `vilo-os/patology catalog.docx`
