/**
 * Resolve a PerformanceScope from raw inputs.
 *
 * Phase 7A PR1 — skeleton. Role resolution stays `'unknown'` for now;
 * Phase E (Command UI minimal) wires actual role detection from
 * study_members. Keeping the function shape stable now means PR2/PR3
 * are pure transplants, not API changes.
 *
 * See docs/PHASE7A-READ-LAYER.md §4.2.
 */

import type {
  PerformanceQueryScope,
  PerformanceRole,
  PerformanceScope,
} from '@/lib/performance/types'

export type ResolveScopeInput = {
  organizationIds: string[]
  selectedStudyId: string | null
  userId: string | null
}

export function resolveScope(input: ResolveScopeInput): PerformanceScope {
  const role: PerformanceRole = 'unknown'
  const studyIds = input.selectedStudyId ? [input.selectedStudyId] : null
  return {
    organizationIds: input.organizationIds,
    studyIds,
    selectedStudyId: input.selectedStudyId,
    role,
    userId: input.userId,
  }
}

export function toQueryScope(
  organizationIds: string[],
  studyIds: string[],
): PerformanceQueryScope {
  return { organizationIds, studyIds }
}
