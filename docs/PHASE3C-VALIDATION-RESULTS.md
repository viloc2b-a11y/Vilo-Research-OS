# Phase 3C — Visit lifecycle RPC validation results

**Run at:** 2026-05-16T01:52:22.571Z

## Summary

| Result | Count |
|--------|-------|
| PASS | 15 |
| FAIL | 0 |
| BLOCKED | 0 |

**Phase 3C status:** GREEN — visit complete + lock + isolation checks executed.

## Checks

| Check | Status | Detail |
|-------|--------|--------|
| fixture_reset_visit_lifecycle | PASS | f3f5949b-624a-47b8-8ab8-9ef919d9a5bc / d0598454-eac9-4fb9-8793-36c15a3f36bc |
| cannot_complete_visit_with_incomplete_required_procedures | PASS | {"ok":false,"error":"required procedures for this visit are not all completed or verified","visit_id":"f3f5949b-624a-47b8-8ab8-9ef919d9a5bc","idempotent":false,"visit_status":"scheduled","operational_event_id":null} |
| rpc_complete_procedure_execution_prerequisite | PASS | {"ok":true,"error":null,"study_id":"6bae715a-8536-4000-8d24-22b6a3dbb8c9","visit_id":"f3f5949b-624a-47b8-8ab8-9ef919d9a5bc","idempotent":false,"organization_id":"f7cf7d2b-49cd-4bcd-9e15-2675966c3e1e","execution_status":"completed","operational_event_id":"294189c9-da8c-4125-aec0-03c52e30c93a","procedure_execution_id":"d0598454-eac9-4fb9-8793-36c15a3f36bc"} |
| procedure_completed_event_emitted_once | PASS | delta=1 before=0 after=1 |
| rpc_user_a_first_complete_visit | PASS | {"ok":true,"error":null,"study_id":"6bae715a-8536-4000-8d24-22b6a3dbb8c9","visit_id":"f3f5949b-624a-47b8-8ab8-9ef919d9a5bc","idempotent":false,"visit_status":"completed","organization_id":"f7cf7d2b-49cd-4bcd-9e15-2675966c3e1e","operational_event_id":"642c2ef2-0dac-4a61-a15c-4c8598610db2"} |
| visit_completed_event_emitted_once | PASS | delta=1 before=0 after=1 |
| second_complete_visit_idempotent_no_extra_event | PASS | {"rpc":{"ok":true,"error":null,"study_id":"6bae715a-8536-4000-8d24-22b6a3dbb8c9","visit_id":"f3f5949b-624a-47b8-8ab8-9ef919d9a5bc","idempotent":true,"visit_status":"completed","organization_id":"f7cf7d2b-49cd-4bcd-9e15-2675966c3e1e","operational_event_id":"642c2ef2-0dac-4a61-a15c-4c8598610db2"},"countAfter":1} |
| rpc_first_lock_visit | PASS | {"ok":true,"error":null,"study_id":"6bae715a-8536-4000-8d24-22b6a3dbb8c9","visit_id":"f3f5949b-624a-47b8-8ab8-9ef919d9a5bc","idempotent":false,"visit_status":"locked","organization_id":"f7cf7d2b-49cd-4bcd-9e15-2675966c3e1e","operational_event_id":"dfcf0dec-13bb-4a0c-bb8d-ef9feafed4b2"} |
| visit_locked_event_emitted_once | PASS | delta=1 before=0 after=1 |
| lock_visit_sets_procedure_execution_to_verified | PASS | {"execution_status":"verified"} |
| second_lock_visit_idempotent_no_extra_event | PASS | {"rpc":{"ok":true,"error":null,"study_id":"6bae715a-8536-4000-8d24-22b6a3dbb8c9","visit_id":"f3f5949b-624a-47b8-8ab8-9ef919d9a5bc","idempotent":true,"visit_status":"locked","organization_id":"f7cf7d2b-49cd-4bcd-9e15-2675966c3e1e","operational_event_id":"dfcf0dec-13bb-4a0c-bb8d-ef9feafed4b2"},"countAfter":1} |
| procedure_completion_blocked_when_visit_locked | PASS | {"ok":false,"error":"procedure completion is not allowed while visit status is locked","idempotent":false,"visit_status":"locked","execution_status":"pending","operational_event_id":null,"procedure_execution_id":"d0598454-eac9-4fb9-8793-36c15a3f36bc"} |
| user_b_cannot_complete_or_lock_org_a_visit | PASS | complete={"ok":false,"error":"visit not found or access denied","visit_id":"f3f5949b-624a-47b8-8ab8-9ef919d9a5bc","idempotent":false,"visit_status":null,"operational_event_id":null} lock={"ok":false,"error":"visit not found or access denied","visit_id":"f3f5949b-624a-47b8-8ab8-9ef919d9a5bc","idempotent":false,"visit_status":null,"operational_event_id":null} |
| user_c_org_only_cannot_complete_or_lock_visit | PASS | complete={"ok":false,"error":"visit not found or access denied","visit_id":"f3f5949b-624a-47b8-8ab8-9ef919d9a5bc","idempotent":false,"visit_status":null,"operational_event_id":null} lock={"ok":false,"error":"visit not found or access denied","visit_id":"f3f5949b-624a-47b8-8ab8-9ef919d9a5bc","idempotent":false,"visit_status":null,"operational_event_id":null} |
| event_counts_procedure_visit_complete_match_expectation | PASS | PROCEDURE_COMPLETED=1 VISIT_COMPLETED=1 VISIT_LOCKED=1 |

## Commands

`npm run db:validate-phase3c`
