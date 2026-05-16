# Phase 3B — RPC validation results

**Run at:** 2026-05-16T01:26:03.100Z

## Summary

| Result | Count |
|--------|-------|
| PASS | 8 |
| FAIL | 0 |
| BLOCKED | 0 |

**Phase 3B status:** GREEN — RPC idempotency + isolation checks executed.

## Checks

| Check | Status | Detail |
|-------|--------|--------|
| fixture_reset_procedure_pending | PASS | d0598454-eac9-4fb9-8793-36c15a3f36bc |
| count_proc_completed_baseline_after_reset | PASS | 0 |
| rpc_user_a_first_completes | PASS | idempotent=false event=43b49323-97fb-4cfc-b02f-f7db80200fe9 |
| rpc_first_call_exactly_one_procedure_completed_row | PASS | delta=1 before=0 after=1 |
| rpc_user_a_second_idempotent | PASS | event=43b49323-97fb-4cfc-b02f-f7db80200fe9 |
| rpc_second_call_no_extra_procedure_completed | PASS | same_count=true n=1 |
| rpc_user_b_cannot_complete_org_a_procedure | PASS | {"ok":false,"error":"procedure execution not found or access denied","idempotent":false,"execution_status":null,"operational_event_id":null,"procedure_execution_id":"d0598454-eac9-4fb9-8793-36c15a3f36bc"} |
| rpc_user_c_org_only_cannot_complete_no_study_membership | PASS | {"ok":false,"error":"procedure execution not found or access denied","idempotent":false,"execution_status":null,"operational_event_id":null,"procedure_execution_id":"d0598454-eac9-4fb9-8793-36c15a3f36bc"} |

## Commands

`npm run db:validate-phase3b`
