# Service role audit (Phase 16A-2.7)

Generated: 2026-05-24T17:23:08.276Z

Total findings: 31
Coordinator-facing high risk: 0

| File | Usage | Purpose | Risk | Recommendation |
| --- | --- | --- | --- | --- |
| `lib\admin\users\auth-lookup.ts` | createServiceClient | Org admin user management | low | Admin-only; document service-role requirement. |
| `lib\admin\users\load-organization-members.ts` | SERVICE_ROLE | Org admin user management | low | Admin-only; document service-role requirement. |
| `lib\audit\log.ts` | createServiceClient | Supporting library or infrastructure | low | No action unless used from coordinator APIs. |
| `lib\subject\visit-documents\actions.ts` | createServiceClient | Storage upload/download for visit documents | medium | Review RLS vs storage policies; avoid expanding service-role scope into source capture. |
| `lib\supabase\server.ts` | SERVICE_ROLE | Supporting library or infrastructure | low | No action unless used from coordinator APIs. |
| `scripts\bootstrap-org-owner.mjs` | SERVICE_ROLE | Ops/seed/E2E script (non-coordinator runtime) | low | Acceptable for staging automation; keep out of request path. |
| `scripts\phase11-runtime-e2e-validation.ts` | SERVICE_ROLE | Ops/seed/E2E script (non-coordinator runtime) | low | Acceptable for staging automation; keep out of request path. |
| `scripts\phase11-runtime-pilot-fixture.ts` | SERVICE_ROLE | Ops/seed/E2E script (non-coordinator runtime) | low | Acceptable for staging automation; keep out of request path. |
| `scripts\phase15-coordinator-dry-run.ts` | SERVICE_ROLE | Ops/seed/E2E script (non-coordinator runtime) | low | Acceptable for staging automation; keep out of request path. |
| `scripts\phase15b-capture-proof.ts` | SERVICE_ROLE | Ops/seed/E2E script (non-coordinator runtime) | low | Acceptable for staging automation; keep out of request path. |
| `scripts\phase15b-pe-query-smoke.mjs` | SERVICE_ROLE | Ops/seed/E2E script (non-coordinator runtime) | low | Acceptable for staging automation; keep out of request path. |
| `scripts\phase15b-procedure-linkage-diagnostic.mjs` | SERVICE_ROLE | Ops/seed/E2E script (non-coordinator runtime) | low | Acceptable for staging automation; keep out of request path. |
| `scripts\phase15c-coordinator-access-diagnostic.mjs` | SERVICE_ROLE | Ops/seed/E2E script (non-coordinator runtime) | low | Acceptable for staging automation; keep out of request path. |
| `scripts\phase15c-coordinator-capture-proof.ts` | SERVICE_ROLE | Ops/seed/E2E script (non-coordinator runtime) | low | Acceptable for staging automation; keep out of request path. |
| `scripts\phase16a27-service-role-audit.ts` | service_role | Ops/seed/E2E script (non-coordinator runtime) | low | Acceptable for staging automation; keep out of request path. |
| `scripts\phase9a-staging-hygiene.mjs` | SERVICE_ROLE | Ops/seed/E2E script (non-coordinator runtime) | low | Acceptable for staging automation; keep out of request path. |
| `scripts\provision-synthetic.mjs` | SERVICE_ROLE | Ops/seed/E2E script (non-coordinator runtime) | low | Acceptable for staging automation; keep out of request path. |
| `scripts\seed-operational-calendar-coordinator.mjs` | SERVICE_ROLE | Ops/seed/E2E script (non-coordinator runtime) | low | Acceptable for staging automation; keep out of request path. |
| `scripts\seed-rbac-blinding-qa.mjs` | SERVICE_ROLE | Ops/seed/E2E script (non-coordinator runtime) | low | Acceptable for staging automation; keep out of request path. |
| `scripts\seed-source-capture-blinding-qa.mjs` | SERVICE_ROLE | Ops/seed/E2E script (non-coordinator runtime) | low | Acceptable for staging automation; keep out of request path. |
| `scripts\seed-vpi-risk-scenarios.mjs` | SERVICE_ROLE | Ops/seed/E2E script (non-coordinator runtime) | low | Acceptable for staging automation; keep out of request path. |
| `scripts\validate-active-membership-rls.mjs` | SERVICE_ROLE | Ops/seed/E2E script (non-coordinator runtime) | low | Acceptable for staging automation; keep out of request path. |
| `scripts\validate-infrastructure.mjs` | SERVICE_ROLE | Ops/seed/E2E script (non-coordinator runtime) | low | Acceptable for staging automation; keep out of request path. |
| `scripts\validate-operational-calendar.mjs` | SERVICE_ROLE | Ops/seed/E2E script (non-coordinator runtime) | low | Acceptable for staging automation; keep out of request path. |
| `scripts\validate-phase2.mjs` | service_role | Ops/seed/E2E script (non-coordinator runtime) | low | Acceptable for staging automation; keep out of request path. |
| `scripts\validate-phase3b.mjs` | SERVICE_ROLE | Ops/seed/E2E script (non-coordinator runtime) | low | Acceptable for staging automation; keep out of request path. |
| `scripts\validate-phase3c.mjs` | SERVICE_ROLE | Ops/seed/E2E script (non-coordinator runtime) | low | Acceptable for staging automation; keep out of request path. |
| `scripts\validate-rbac-blinding-qa.mjs` | SERVICE_ROLE | Ops/seed/E2E script (non-coordinator runtime) | low | Acceptable for staging automation; keep out of request path. |
| `scripts\validate-source-capture-blinding-qa.ts` | SERVICE_ROLE | Ops/seed/E2E script (non-coordinator runtime) | low | Acceptable for staging automation; keep out of request path. |
| `scripts\_pilot-migration-preflight-supabase.mjs` | SERVICE_ROLE | Ops/seed/E2E script (non-coordinator runtime) | low | Acceptable for staging automation; keep out of request path. |
| `scripts\_pilot-phase16-post-submit-audit.mjs` | SERVICE_ROLE | Ops/seed/E2E script (non-coordinator runtime) | low | Acceptable for staging automation; keep out of request path. |

## Result

No coordinator-facing runtime/source paths use service role without justification.