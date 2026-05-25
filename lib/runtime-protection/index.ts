/**
 * Runtime protection — site sovereignty types and policy validators (no execution hooks).
 */

export {
  RUNTIME_VISIBILITY_CLASS,
  RUNTIME_VISIBILITY_CLASSES,
  DEFAULT_PROJECTION_VISIBILITY,
  NEVER_RAW_EXTERNAL_VISIBILITY,
  isRawExternalExposureAllowed,
  assertSiteControlledVisibility,
  type RuntimeVisibilityClass,
} from '@/lib/runtime-protection/visibility'

export {
  EXTERNAL_ACTOR_TYPE,
  EXTERNAL_ACTOR_TYPES,
  DEFAULT_DENY_EXPOSURE_POLICY,
  INSPECTION_READINESS_EXPOSURE_TEMPLATE,
  validateExposurePolicy,
  rejectsSurveillancePolicy,
  type ExternalActorType,
  type RuntimeExposurePolicy,
  type ExposurePolicyValidationIssue,
} from '@/lib/runtime-protection/exposure-policy'
