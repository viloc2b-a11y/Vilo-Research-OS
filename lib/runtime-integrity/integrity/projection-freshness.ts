import {
  isProjectionStale,
  isProjectionVersionCurrent,
  projectionVersionMismatchWarning,
} from '@/lib/projections/integrity'
import { DEFAULT_PROJECTION_MAX_AGE_MS } from '@/lib/runtime-integrity/constants'
import type { SupabaseClient } from '@supabase/supabase-js'

export type ProjectionFreshnessIssue = {
  projection: string
  scopeId: string
  issue: 'missing' | 'stale' | 'version_mismatch'
  detail: string
  computedAt?: string | null
  storedVersion?: number | null
}

export async function checkVisitProjectionFreshness(input: {
  supabase: SupabaseClient
  visitId: string
  organizationId: string
  maxAgeMs?: number
}): Promise<ProjectionFreshnessIssue[]> {
  const maxAge = input.maxAgeMs ?? DEFAULT_PROJECTION_MAX_AGE_MS
  const issues: ProjectionFreshnessIssue[] = []

  const { data: visitRow } = await input.supabase
    .from('visit_readiness_projections')
    .select('computed_at, projection_version')
    .eq('visit_id', input.visitId)
    .maybeSingle()

  if (!visitRow) {
    issues.push({
      projection: 'visit_readiness_projections',
      scopeId: input.visitId,
      issue: 'missing',
      detail: 'Visit readiness projection not materialized.',
    })
    return issues
  }

  const computedAt = visitRow.computed_at as string
  const version = visitRow.projection_version as number

  if (isProjectionStale(computedAt, maxAge)) {
    issues.push({
      projection: 'visit_readiness_projections',
      scopeId: input.visitId,
      issue: 'stale',
      detail: `Projection older than ${Math.round(maxAge / 60000)} minutes.`,
      computedAt,
      storedVersion: version,
    })
  }

  const versionWarning = projectionVersionMismatchWarning(version)
  if (versionWarning) {
    issues.push({
      projection: 'visit_readiness_projections',
      scopeId: input.visitId,
      issue: 'version_mismatch',
      detail: versionWarning,
      computedAt,
      storedVersion: version,
    })
  }

  const { data: visit } = await input.supabase
    .from('visits')
    .select('study_subject_id')
    .eq('id', input.visitId)
    .maybeSingle()

  if (visit?.study_subject_id) {
    const subjectId = visit.study_subject_id as string
    const { data: subjectRow } = await input.supabase
      .from('subject_runtime_projections')
      .select('computed_at, projection_version')
      .eq('study_subject_id', subjectId)
      .maybeSingle()

    if (!subjectRow) {
      issues.push({
        projection: 'subject_runtime_projections',
        scopeId: subjectId,
        issue: 'missing',
        detail: 'Subject runtime projection not materialized.',
      })
    } else if (isProjectionStale(subjectRow.computed_at as string, maxAge)) {
      issues.push({
        projection: 'subject_runtime_projections',
        scopeId: subjectId,
        issue: 'stale',
        detail: 'Subject projection stale relative to visit.',
        computedAt: subjectRow.computed_at as string,
        storedVersion: subjectRow.projection_version as number,
      })
    }
  }

  return issues
}

export async function checkSubjectProjectionFreshness(input: {
  supabase: SupabaseClient
  studySubjectId: string
  maxAgeMs?: number
}): Promise<ProjectionFreshnessIssue[]> {
  const maxAge = input.maxAgeMs ?? DEFAULT_PROJECTION_MAX_AGE_MS
  const issues: ProjectionFreshnessIssue[] = []

  const { data: row } = await input.supabase
    .from('subject_runtime_projections')
    .select('computed_at, projection_version')
    .eq('study_subject_id', input.studySubjectId)
    .maybeSingle()

  if (!row) {
    issues.push({
      projection: 'subject_runtime_projections',
      scopeId: input.studySubjectId,
      issue: 'missing',
      detail: 'Subject runtime projection not materialized.',
    })
    return issues
  }

  if (isProjectionStale(row.computed_at as string, maxAge)) {
    issues.push({
      projection: 'subject_runtime_projections',
      scopeId: input.studySubjectId,
      issue: 'stale',
      detail: 'Subject projection cache is stale.',
      computedAt: row.computed_at as string,
      storedVersion: row.projection_version as number,
    })
  }

  const versionWarning = projectionVersionMismatchWarning(row.projection_version as number)
  if (versionWarning) {
    issues.push({
      projection: 'subject_runtime_projections',
      scopeId: input.studySubjectId,
      issue: 'version_mismatch',
      detail: versionWarning,
      computedAt: row.computed_at as string,
      storedVersion: row.projection_version as number,
    })
  }

  return issues
}
