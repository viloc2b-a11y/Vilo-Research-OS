# Pending External Runtime RLS Enforcement

**Phase 16E-1** enforces isolation at the **API route and TypeScript policy layers**. Database RLS hardening is documented here for a future migration pass — not implemented in this phase.

## Goals

- External actors (`unblinded_cra`, `study_members.monitor`, policy aliases) cannot `SELECT` runtime projection tables directly via Supabase client.
- Monitor-safe reads use **DTO-only SQL views**, not base tables.
- Fail closed when JWT role cannot be classified as site-internal.

## Planned RLS policies

### Deny external SELECT on projection tables

Apply to:

- `runtime_traces`, `execution_spans`, `workflow_telemetry_events`
- `visit_coordinator_orchestration_projections`
- `subject_coordinator_orchestration_projections`
- `visit_runtime_automation_projections`, `subject_runtime_automation_projections`
- `visit_readiness_projections`, `subject_runtime_projections`, `study_execution_projections`
- `visit_financial_runtime_projections`, `subject_financial_runtime_projections`
- `operational_intelligence_projections`

Policy pattern:

```sql
-- Pseudocode: site-internal org roles only
USING (
  public.user_has_internal_org_role(organization_id)
  AND NOT public.user_is_external_monitor(organization_id, study_id)
);
```

### DTO-only SQL views (future)

Create views such as:

- `external_source_review_v` — columns matching `SourceReviewDto` only
- `external_evidence_release_v` — finalized_for_external_review rows only

Grants: `SELECT` for authenticated users where `user_is_external_monitor` and `site_review_completed`.

### Replay / lineage denial

- Deny external `SELECT` on chronology checksum fields in manifest RPCs at SQL layer.
- History RPC remains internal role only.

### Helper functions

- `user_is_external_monitor(organization_id, study_id)`
- `user_has_internal_org_role(organization_id)`
- `response_set_finalized_for_external(source_response_set_id)`

## Alignment with application layer

| Layer | Status (16E-1) |
|-------|----------------|
| Route enforcement | Implemented |
| DTO mapper + assertions | Implemented |
| Query guards (`guardRuntimeTableQuery`) | Implemented |
| Coordinator loader org filter | Implemented (`load-site-operations`) |
| Supabase RLS on projections | **Pending** |
| DTO-only views | **Pending** |

## Rollout order

1. Deploy route/policy enforcement (16E-1) — current
2. Add SQL helper functions + monitor role detection
3. Enable RLS on projection tables (staging pilot org first)
4. Introduce external views; switch inspection-readiness API to views
5. Remove redundant raw-table paths for external JWT sessions

## Non-goals

- CRA dashboard or sponsor portal tables
- Export of raw `work_queue` JSON to external sessions
