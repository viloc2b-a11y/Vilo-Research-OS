# CRA / Monitor Access Boundary

**Status:** Policy + DTO enforcement layer (Phase 16E). No CRA dashboard or sponsor portal.

Vilo OS is **site-first** and **coordinator-first**. CRA, CRO, and monitor users are **external actors**. They review coordinator-entered source and site-approved evidence only — never site runtime intelligence.

## Allowed reads (read-only, study/site scoped)

| Capability | Notes |
|------------|--------|
| Submitted source response sets | Status `submitted` / site-approved review states only |
| Field labels + submitted values | SDV minimum necessary |
| Procedure execution status | Only to contextualize submitted source (e.g. submitted vs signed) |
| Approved correction / addendum history | Site-approved packets only |
| Findings create/query | Only when site enables `siteFindingsEnabled` |
| Site-approved finding responses | Monitor-visible after site release |

Implementation: `lib/external-access/cra-access-policy.ts`, `lib/external-access/source-review-dto.ts`.

## Denied reads (fail closed)

| Category | Examples |
|----------|----------|
| Runtime traces | `runtime_traces`, `execution_spans` |
| Workflow telemetry | `workflow_telemetry_events` |
| Coordinator orchestration | `visit_coordinator_orchestration_projections`, subject orchestration |
| Automation projections | Visit/subject runtime automation tables |
| Operational intelligence | OI projection tables |
| Financial runtime | Visit/subject financial runtime projections |
| Internal work queues | Command center queue surfaces |
| Integrity hash internals | Chronology checksums, hash payloads in external DTOs |
| Coordinator surveillance | Burden, overload, productivity metadata |
| Pre-monitor remediation | Internal remediation signals before site review |
| Internal why-blocked | Unless explicitly released by site policy |

Constants: `lib/external-access/denied-runtime-resources.ts`.

## Why runtime intelligence is site-only

Runtime traces, orchestration, automation proposals, financial runtime, and operational intelligence exist to help **the site** coordinate visits and remediate issues. Exposing them to monitors would:

- Leak coordinator workload and performance inference
- Reveal pre-review remediation and internal blocker reasoning
- Enable sponsor surveillance of site operations rather than inspection of **submitted clinical source**

External visibility must be **derived**, **limited**, **auditable**, and **site-controlled** (see `docs/RUNTIME_SOVEREIGNTY_PRINCIPLES.md`, `docs/EXTERNAL_VISIBILITY_POLICY.md`).

## Site-controlled release principle

Nothing in runtime projections is automatically exportable. Future inspection-readiness exports require:

1. Site review and approval
2. `buildSourceReviewDto()` (or successor) — never raw API read shapes
3. Exposure policy template `INSPECTION_READINESS_EXPOSURE_TEMPLATE` in `lib/runtime-protection`

## External roles

| Policy id | Storage today |
|-----------|----------------|
| `cra_monitor` | Org role `unblinded_cra` |
| `external_monitor` | `study_members.role = monitor` |
| `sponsor_viewer` | Policy alias; future org/study role |

See `lib/rbac/external-actors.ts`.

## Phase 16E-1 enforcement (implemented)

- **Route layer:** All `/api/source/*` routes call `enforceInternalSourceRoute` or `enforceSourceReadIsolation` (`lib/api/source/runtime-isolation-enforcement.ts`).
- **External reads:** `GET /api/source/response-set/[id]` returns `SourceReviewDto` only when actor is external; manifest/history/findings denied.
- **Mutations:** External and uncertain actors receive `403` on all source POST routes.
- **Query guards:** `lib/external-access/query-guards.ts` — projection queries blocked for external actors.
- **RLS backlog:** `docs/PENDING_EXTERNAL_RUNTIME_RLS_ENFORCEMENT.md`

## Future controlled external visibility

- Dedicated routes under `app/api/external/inspection-readiness/` (not built)
- Route conventions: `lib/external-access/route-conventions.ts`
- Supabase RLS on projection tables (pending — see RLS doc above)

## Non-goals (this phase)

- CRA dashboard
- Sponsor portal
- Direct runtime table queries from external routes
