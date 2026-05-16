# Phase 4A — Catalog validation (scripts/validate-phase4a.mjs)

**Run at:** 2026-05-16T03:05:47.831Z

## Summary

| Result | Count |
|--------|-------|
| PASS | 7 |
| FAIL | 0 |
| BLOCKED | 0 |

**Phase 4A catalog:** tables and core column present.

## Checks

| Name | Status | Detail |
|------|--------|--------|
| table_source_definitions | PASS | source_definitions |
| table_source_definition_versions | PASS | source_definition_versions |
| table_source_fields | PASS | source_fields |
| table_procedure_source_bindings | PASS | procedure_source_bindings |
| procedure_executions.source_definition_version_id | PASS | column exists (nullable FK) |
| phase4a_helper_functions | PASS | phase4a_jsonb_octet_length, phase4a_sdv_is_published_binding_target |
| rls_enabled_new_tables | PASS | source_definitions, source_definition_versions, source_fields, procedure_source_bindings |
