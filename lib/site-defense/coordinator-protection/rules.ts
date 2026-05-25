/**
 * Coordinator protection rules — reduce burden, hide noise, surface next action only.
 * Site-internal; never exposed to CRA/monitor DTOs.
 */

export const COORDINATOR_PROTECTION_RULES = {
  /** Cap visible queue items to avoid cognitive overload. */
  maxVisibleActions: 5,
  /** Hide duplicate bucket/action rows after dedupe. */
  collapseDuplicateActions: true,
  /** Prefer prevention buckets over generic operational noise. */
  prioritizePreventionBuckets: true,
  /** Plain-language next action labels only (no stack traces / projection ids). */
  hideTechnicalComplexity: true,
  /** Do not surface raw risk weights in coordinator UI payloads. */
  exposePriorityInternallyOnly: true,
  /** External actors never receive coordinator protection queue. */
  externalActorsDenied: true,
} as const

export type CoordinatorProtectionRuleKey = keyof typeof COORDINATOR_PROTECTION_RULES
