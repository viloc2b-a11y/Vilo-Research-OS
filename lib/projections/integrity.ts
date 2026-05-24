import { RUNTIME_PROJECTION_VERSION } from '@/lib/projections/constants'

export const PROJECTION_CANONICAL_TRUTH = [
  'operational_events',
  'visits',
  'procedure_executions',
  'source_response_sets',
  'subject_workflow_actions',
  'subject_adverse_events',
] as const

/**
 * Projections are derived caches. Never use for authorization of irreversible actions alone.
 */
export function assertProjectionDerivedOnly(context: string): void {
  if (process.env.NODE_ENV === 'development' && process.env.VILO_ALLOW_PROJECTION_AS_TRUTH === '1') {
    console.warn(
      `[projections] ${context}: VILO_ALLOW_PROJECTION_AS_TRUTH is set — projections must not replace execution tables.`,
    )
  }
}

export function isProjectionStale(
  computedAt: string | null | undefined,
  maxAgeMs: number,
): boolean {
  if (!computedAt) return true
  const age = Date.now() - new Date(computedAt).getTime()
  return Number.isNaN(age) || age > maxAgeMs
}

export function isProjectionVersionCurrent(version: number | null | undefined): boolean {
  return version === RUNTIME_PROJECTION_VERSION
}

export function projectionVersionMismatchWarning(
  storedVersion: number | null | undefined,
): string | null {
  if (storedVersion == null) return 'Projection never computed.'
  if (!isProjectionVersionCurrent(storedVersion)) {
    return `Projection schema v${storedVersion} is stale; current is v${RUNTIME_PROJECTION_VERSION}. Rebuild recommended.`
  }
  return null
}
