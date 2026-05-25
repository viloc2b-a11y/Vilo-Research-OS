/**
 * Runtime visibility classifications — structural guardrail for site-first architecture.
 *
 * Classification labels intent for data and projections. Enforcement middleware
 * is tracked in docs/PENDING_RUNTIME_PROTECTION_ENFORCEMENTS.md.
 *
 * Does not alter runtime execution paths.
 */

export const RUNTIME_VISIBILITY_CLASS = {
  /** Coordinator/site operational truth; never default-exported externally. */
  SITE_ONLY: 'site_only',
  /** Internal derived state for site operations (projections, orchestration, traces). */
  INTERNAL_OPERATIONAL: 'internal_operational',
  /** May be transformed into a controlled external packet after policy gates. */
  DERIVED_EXTERNAL: 'derived_external',
  /** Highly sensitive; external export blocked pending explicit policy. */
  RESTRICTED: 'restricted',
  /** Immutable audit lineage; export only via formal audit workflow. */
  AUDIT_LOCKED: 'audit_locked',
} as const

export const RUNTIME_VISIBILITY_CLASSES = [
  RUNTIME_VISIBILITY_CLASS.SITE_ONLY,
  RUNTIME_VISIBILITY_CLASS.INTERNAL_OPERATIONAL,
  RUNTIME_VISIBILITY_CLASS.DERIVED_EXTERNAL,
  RUNTIME_VISIBILITY_CLASS.RESTRICTED,
  RUNTIME_VISIBILITY_CLASS.AUDIT_LOCKED,
] as const

export type RuntimeVisibilityClass = (typeof RUNTIME_VISIBILITY_CLASSES)[number]

/** Default classification for core runtime tables/projections (prevention-first). */
export const DEFAULT_PROJECTION_VISIBILITY = RUNTIME_VISIBILITY_CLASS.INTERNAL_OPERATIONAL

/** Classifications that must never be exposed raw to external actors. */
export const NEVER_RAW_EXTERNAL_VISIBILITY: readonly RuntimeVisibilityClass[] = [
  RUNTIME_VISIBILITY_CLASS.SITE_ONLY,
  RUNTIME_VISIBILITY_CLASS.INTERNAL_OPERATIONAL,
  RUNTIME_VISIBILITY_CLASS.RESTRICTED,
  RUNTIME_VISIBILITY_CLASS.AUDIT_LOCKED,
]

export function isRawExternalExposureAllowed(visibility: RuntimeVisibilityClass): boolean {
  return visibility === RUNTIME_VISIBILITY_CLASS.DERIVED_EXTERNAL
}

export function assertSiteControlledVisibility(
  visibility: RuntimeVisibilityClass,
): { allowed: boolean; reason: string } {
  if (visibility === RUNTIME_VISIBILITY_CLASS.DERIVED_EXTERNAL) {
    return {
      allowed: true,
      reason: 'Derived external visibility requires exposure policy gates.',
    }
  }
  return {
    allowed: false,
    reason: `Visibility class "${visibility}" is not eligible for direct external exposure.`,
  }
}
