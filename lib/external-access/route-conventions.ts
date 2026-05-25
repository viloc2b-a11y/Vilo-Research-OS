/**
 * Future CRA / inspection-readiness HTTP routes (not implemented — policy only).
 *
 * When adding e.g. app/api/external/inspection-readiness/source-review/[id]/route.ts:
 * - Call assertCraRouteContext() and canReadSubmittedSource() from cra-access-policy.
 * - Return only buildSourceReviewDto() output — never ResponseSetDetailData or manifest/history raw.
 * - Never query DENIED_RUNTIME_TABLES or command-center loaders.
 * - Enforce study_id + organization_id scope from session + study_members.
 * - Read-only: no mutations except canCreateFinding when siteFindingsEnabled.
 */

export const CRA_EXTERNAL_ROUTE_CONVENTIONS = `
CRA external routes MUST:
1. import assertCraRouteContext, canReadSubmittedSource from @/lib/external-access/cra-access-policy
2. import buildSourceReviewDto from @/lib/external-access/source-review-dto
3. call assertCraCannotAccessInternalRuntime before any DB read — fail closed on denied tables
4. never import visit/subject orchestration, financial runtime, or runtime-traces modules
5. scope by organizationId + studyId + study_members monitor role
`.trim()
