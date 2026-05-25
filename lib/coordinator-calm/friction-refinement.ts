/**
 * Friction-driven calm refinement recommendations (internal-only, no scoring).
 */

import type { CoordinatorFrictionProjection } from '@/lib/coordinator-friction'
import type { ObservationProjection } from '@/lib/coordinator-observation'
import { isCoordinatorHostileLanguage, toCoordinatorSafeOperationalLanguage } from '@/lib/coordinator-calm/language'

export type CalmRefinementRecommendationKind =
  | 'suppress_warning'
  | 'collapse_queue_duplicate'
  | 'terminology_refinement'
  | 'elevate_recovery_action'

export type CalmRefinementRecommendation = {
  visibility: 'site_internal_only'
  kind: CalmRefinementRecommendationKind
  reason: string
  suggestion: string
  workflowId?: string
}

export type FrictionRefinementInput = {
  friction?: CoordinatorFrictionProjection | null
  observation?: ObservationProjection | null
  queueLabels?: string[]
}

export function deriveCalmRefinementRecommendations(
  input: FrictionRefinementInput,
): CalmRefinementRecommendation[] {
  const recommendations: CalmRefinementRecommendation[] = []

  for (const event of input.friction?.events ?? []) {
    if (event.type === 'repeated_navigation' || event.type === 'workflow_return_loop') {
      recommendations.push({
        visibility: 'site_internal_only',
        kind: 'collapse_queue_duplicate',
        reason: 'Repeated navigation detected for the same workflow.',
        suggestion: 'Collapse duplicate queue items and surface a single recovery next step.',
        workflowId: event.workflowId,
      })
    }
    if (event.type === 'unresolved_blocker' || event.type === 'stalled_source_completion') {
      recommendations.push({
        visibility: 'site_internal_only',
        kind: 'elevate_recovery_action',
        reason: event.whatBlocksCompletion,
        suggestion: toCoordinatorSafeOperationalLanguage(event.whatShouldHappenNext),
        workflowId: event.workflowId,
      })
    }
    if (event.type === 'repeated_open_without_completion') {
      recommendations.push({
        visibility: 'site_internal_only',
        kind: 'suppress_warning',
        reason: 'Low-actionability reopen loop without new blockers.',
        suggestion: 'Suppress stale informational warnings; keep one prevention action visible.',
        workflowId: event.workflowId,
      })
    }
  }

  for (const signal of input.friction?.recoverySignals ?? []) {
    if (signal.name === 'likely_operational_confusion') {
      recommendations.push({
        visibility: 'site_internal_only',
        kind: 'terminology_refinement',
        reason: signal.reason,
        suggestion: 'Simplify next-action copy; avoid audit-heavy terms on command center.',
      })
    }
  }

  for (const clarity of input.observation?.claritySignals ?? []) {
    if (
      clarity.name === 'terminology_confusion'
      || clarity.name === 'unclear_next_action'
    ) {
      recommendations.push({
        visibility: 'site_internal_only',
        kind: 'terminology_refinement',
        reason: clarity.reason,
        suggestion: 'Apply operational calm language guide to visit and source surfaces.',
      })
    }
    if (clarity.name === 'repeated_help_needed' || clarity.name === 'repeated_reopen_pattern') {
      recommendations.push({
        visibility: 'site_internal_only',
        kind: 'suppress_warning',
        reason: clarity.reason,
        suggestion: 'Reduce warning density; group related recovery actions.',
      })
    }
  }

  for (const label of input.queueLabels ?? []) {
    if (isCoordinatorHostileLanguage(label)) {
      recommendations.push({
        visibility: 'site_internal_only',
        kind: 'terminology_refinement',
        reason: `Hostile coordinator language detected: "${label}"`,
        suggestion: toCoordinatorSafeOperationalLanguage(label),
      })
    }
  }

  const byKey = new Map<string, CalmRefinementRecommendation>()
  for (const rec of recommendations) {
    const key = `${rec.kind}:${rec.workflowId ?? ''}:${rec.suggestion}`
    if (!byKey.has(key)) byKey.set(key, rec)
  }
  return Array.from(byKey.values())
}
