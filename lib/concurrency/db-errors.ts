import { coordinatorMessageFromError } from '@/lib/runtime-errors/coordinator-facing'

/**
 * H5 Phase 3 / 16A-2.7 — Coordinator-safe DB error translation.
 * Delegates to translateRuntimeError + domain-specific legacy overrides.
 */
export function mapRuntimeDbErrorToCoordinatorMessage(
  error: unknown,
  fallbackMessage = 'Action failed.',
): string {
  if (!error) return fallbackMessage
  return coordinatorMessageFromError(error, { fallbackMessage })
}
