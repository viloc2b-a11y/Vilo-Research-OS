/**
 * Exposure policy typing — site-controlled external visibility contract.
 *
 * Types and validators only. No export pipelines or runtime hooks in this module.
 */

import {
  RUNTIME_VISIBILITY_CLASS,
  type RuntimeVisibilityClass,
  assertSiteControlledVisibility,
} from '@/lib/runtime-protection/visibility'

export const EXTERNAL_ACTOR_TYPE = {
  SPONSOR: 'sponsor',
  CRO: 'cro',
  CRA_MONITOR: 'cra_monitor',
  REGULATOR: 'regulator',
  AUDITOR: 'auditor',
} as const

export const EXTERNAL_ACTOR_TYPES = [
  EXTERNAL_ACTOR_TYPE.SPONSOR,
  EXTERNAL_ACTOR_TYPE.CRO,
  EXTERNAL_ACTOR_TYPE.CRA_MONITOR,
  EXTERNAL_ACTOR_TYPE.REGULATOR,
  EXTERNAL_ACTOR_TYPE.AUDITOR,
] as const

export type ExternalActorType = (typeof EXTERNAL_ACTOR_TYPES)[number]

/**
 * Policy gate for any external-facing artifact derived from runtime.
 * All fields express site sovereignty defaults unless explicitly overridden in spec.
 */
export type RuntimeExposurePolicy = {
  /** Human-readable policy id for specs and audit. */
  policyId: string
  /** Visibility classification of source material. */
  visibilityClass: RuntimeVisibilityClass
  /** Site must review/approve before release. */
  requiresSiteReview: boolean
  /** PHI and identifiers must be stripped or aggregated. */
  requiresDeidentification: boolean
  /** Minimum hours between operational event and external release (0 = site discretion only). */
  minimumDelayHours: number
  /** Only transformed/aggregated packets — never raw projection rows. */
  derivedOnly: boolean
  /** Whether this policy may ever produce an export artifact. */
  exportable: boolean
  /** External actor categories allowed when exportable is true. */
  externalActorTypes: ExternalActorType[]
  /** Operational justification text required at site approval time. */
  siteBenefitJustificationRequired: boolean
}

/** Default deny policy — use until a feature passes architecture review. */
export const DEFAULT_DENY_EXPOSURE_POLICY: RuntimeExposurePolicy = {
  policyId: 'default_deny_external',
  visibilityClass: RUNTIME_VISIBILITY_CLASS.INTERNAL_OPERATIONAL,
  requiresSiteReview: true,
  requiresDeidentification: true,
  minimumDelayHours: 24,
  derivedOnly: true,
  exportable: false,
  externalActorTypes: [],
  siteBenefitJustificationRequired: true,
}

/** Template for inspection-readiness packets (still site-controlled). */
export const INSPECTION_READINESS_EXPOSURE_TEMPLATE: RuntimeExposurePolicy = {
  policyId: 'inspection_readiness_derived',
  visibilityClass: RUNTIME_VISIBILITY_CLASS.DERIVED_EXTERNAL,
  requiresSiteReview: true,
  requiresDeidentification: true,
  minimumDelayHours: 0,
  derivedOnly: true,
  exportable: true,
  externalActorTypes: [EXTERNAL_ACTOR_TYPE.CRA_MONITOR, EXTERNAL_ACTOR_TYPE.AUDITOR],
  siteBenefitJustificationRequired: true,
}

export type ExposurePolicyValidationIssue = {
  code: string
  message: string
}

export function validateExposurePolicy(
  policy: RuntimeExposurePolicy,
): { ok: true } | { ok: false; issues: ExposurePolicyValidationIssue[] } {
  const issues: ExposurePolicyValidationIssue[] = []

  const visibilityCheck = assertSiteControlledVisibility(policy.visibilityClass)
  if (!visibilityCheck.allowed && policy.exportable) {
    issues.push({
      code: 'VISIBILITY_NOT_EXPORTABLE',
      message: visibilityCheck.reason,
    })
  }

  if (policy.exportable && policy.externalActorTypes.length === 0) {
    issues.push({
      code: 'NO_EXTERNAL_ACTORS',
      message: 'Exportable policies must declare allowed external_actor_types.',
    })
  }

  if (!policy.derivedOnly && policy.exportable) {
    issues.push({
      code: 'RAW_EXPORT_FORBIDDEN',
      message: 'exportable requires derivedOnly=true (no raw runtime exposure).',
    })
  }

  if (policy.exportable && !policy.requiresSiteReview) {
    issues.push({
      code: 'SITE_REVIEW_REQUIRED',
      message: 'External export requires requiresSiteReview=true.',
    })
  }

  if (policy.exportable && !policy.requiresDeidentification) {
    issues.push({
      code: 'DEIDENTIFICATION_REQUIRED',
      message: 'External export requires requiresDeidentification=true.',
    })
  }

  if (policy.exportable && !policy.siteBenefitJustificationRequired) {
    issues.push({
      code: 'SITE_BENEFIT_REQUIRED',
      message: 'External export requires siteBenefitJustificationRequired=true.',
    })
  }

  if (policy.minimumDelayHours < 0) {
    issues.push({
      code: 'INVALID_DELAY',
      message: 'minimumDelayHours must be >= 0.',
    })
  }

  if (issues.length > 0) return { ok: false, issues }
  return { ok: true }
}

/** Reject policies that would enable sponsor/monitor-first surveillance patterns. */
export function rejectsSurveillancePolicy(policy: RuntimeExposurePolicy): boolean {
  if (!policy.derivedOnly) return true
  if (!policy.requiresSiteReview) return true
  if (policy.minimumDelayHours < 0) return true
  if (
    policy.exportable
    && policy.externalActorTypes.includes(EXTERNAL_ACTOR_TYPE.SPONSOR)
    && !policy.siteBenefitJustificationRequired
  ) {
    return true
  }
  return false
}
