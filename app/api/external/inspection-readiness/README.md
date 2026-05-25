# Inspection-readiness API (placeholder)

**Not implemented.** Do not add routes that query runtime projection tables.

When implementing source review for CRA/monitor:

1. `assertCraRouteContext()` + `canReadSubmittedSource()` from `@/lib/external-access/cra-access-policy`
2. `buildSourceReviewDto()` only — never `@/lib/api/source/read-types` `ResponseSetDetailData`
3. `assertCraCannotAccessInternalRuntime(table)` before any Supabase read
4. Study scope: `organization_id` + `study_id` + `study_members.role = monitor` (or org `unblinded_cra`)

See `docs/CRA_ACCESS_BOUNDARY.md` and `lib/external-access/route-conventions.ts`.
