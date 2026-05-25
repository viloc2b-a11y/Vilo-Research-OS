export {
  DENIED_RUNTIME_API_PREFIXES,
  DENIED_RUNTIME_TABLE,
  DENIED_RUNTIME_TABLES,
  type DeniedRuntimeTable,
} from '@/lib/external-access/denied-runtime-resources'

export type {
  RuntimeActorClassification,
  RuntimeActorKind,
} from '@/lib/external-access/actor-classification'
export { classifyRuntimeActor } from '@/lib/external-access/actor-classification'

export {
  AUDITED_RUNTIME_SURFACES,
  AUDITED_SOURCE_API_ROUTES,
  EXTERNAL_DENIED_ROUTES,
  EXTERNAL_DTO_ONLY_ROUTES,
} from '@/lib/external-access/route-audit'

export {
  RUNTIME_ISOLATION_CODE,
  RuntimeIsolationError,
  EXTERNAL_RELEASED_RESPONSE_SET_STATUSES,
  assertExternalDtoOnlyResponse,
  assertInternalRuntimeActor,
  assertResponseSetStatusReleasableToExternal,
  assertRuntimeProjectionQueryAllowed,
  classifyActorForOrganization,
  denyExternalRawSourceRead,
  denyExternalReplayRead,
  denyExternalSourceMutation,
} from '@/lib/external-access/runtime-isolation'

export {
  guardCoordinatorLoaderAccess,
  guardRuntimeTableQuery,
  RUNTIME_QUERY_RESOURCE,
} from '@/lib/external-access/query-guards'

export {
  mapResponseSetDetailToSourceReviewDto,
  type ResponseSetReviewLabels,
} from '@/lib/external-access/map-response-set-to-review-dto'

export {
  assertCraCannotAccessInternalRuntime,
  assertCraRouteContext,
  canAccessInternalRuntimeAsMembership,
  canCreateFinding,
  canReadFindingResponse,
  canReadSourceEvidence,
  canReadSubmittedSource,
  denyRuntimeIntelligenceAccess,
  type CraAccessContext,
  type CraRuntimeAccessViolation,
} from '@/lib/external-access/cra-access-policy'

export {
  assertSourceReviewDtoHasNoInternalRuntimeFields,
  assertNoExternalRuntimeLeak,
  buildSourceReviewDto,
  FORBIDDEN_EXTERNAL_DTO_KEYS,
  type SourceReviewCorrectionStatus,
  type SourceReviewDto,
  type SourceReviewDtoInput,
  type SourceReviewFieldRow,
} from '@/lib/external-access/source-review-dto'

export { CRA_EXTERNAL_ROUTE_CONVENTIONS } from '@/lib/external-access/route-conventions'

export {
  assertSourceReviewDtoExposureAllowed,
  canExposeSourceReviewDto,
  isFinalizedForExternalReview,
} from '@/lib/external-access/site-defense-gate'
