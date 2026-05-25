import { computeVisitReadinessProjection } from '@/lib/projections/compute/visit-readiness'
import { computeSubjectRuntimeProjection } from '@/lib/projections/compute/subject-runtime'
import { computeStudyExecutionProjection } from '@/lib/projections/compute/study-execution'
import {
  PROJECTION_KINDS,
  PROJECTION_REFRESH_MODES,
  RUNTIME_PROJECTION_VERSION,
} from '@/lib/projections/constants'
import {
  upsertVisitReadinessProjection,
  upsertSubjectRuntimeProjection,
  upsertStudyExecutionProjection,
} from '@/lib/projections/persist'
import type { ProjectionRefreshResult } from '@/lib/projections/types'
import type { SupabaseClient } from '@supabase/supabase-js'

export type RebuildStudyProjectionsResult = {
  ok: boolean
  visitsRefreshed: number
  subjectsRefreshed: number
  studyRefreshed: boolean
  errors: string[]
}

/**
 * Full rebuild from execution tables (not event replay).
 * Recomputes all visit + subject projections for a study, then study aggregate.
 */
export async function rebuildStudyProjections(
  supabase: SupabaseClient,
  studyId: string,
  organizationId: string,
): Promise<RebuildStudyProjectionsResult> {
  const errors: string[] = []
  let visitsRefreshed = 0
  let subjectsRefreshed = 0

  const { data: visits, error: visitErr } = await supabase
    .from('visits')
    .select('id')
    .eq('study_id', studyId)
    .eq('organization_id', organizationId)

  if (visitErr) {
    return {
      ok: false,
      visitsRefreshed: 0,
      subjectsRefreshed: 0,
      studyRefreshed: false,
      errors: [visitErr.message],
    }
  }

  for (const row of visits ?? []) {
    try {
      const computed = await computeVisitReadinessProjection(
        supabase,
        row.id as string,
        organizationId,
      )
      if (computed) {
        await upsertVisitReadinessProjection(computed)
        visitsRefreshed += 1
      }
    } catch (err) {
      errors.push(`visit ${row.id}: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  const { data: subjects, error: subErr } = await supabase
    .from('study_subjects')
    .select('id')
    .eq('study_id', studyId)
    .eq('organization_id', organizationId)

  if (subErr) {
    errors.push(subErr.message)
  } else {
    for (const row of subjects ?? []) {
      try {
        const computed = await computeSubjectRuntimeProjection(
          supabase,
          row.id as string,
          organizationId,
        )
        if (computed) {
          await upsertSubjectRuntimeProjection(computed)
          subjectsRefreshed += 1
        }
      } catch (err) {
        errors.push(`subject ${row.id}: ${err instanceof Error ? err.message : String(err)}`)
      }
    }
  }

  let studyRefreshed = false
  try {
    const studyComputed = await computeStudyExecutionProjection(
      supabase,
      studyId,
      organizationId,
    )
    if (studyComputed) {
      await upsertStudyExecutionProjection(studyComputed)
      studyRefreshed = true
    }
  } catch (err) {
    errors.push(`study: ${err instanceof Error ? err.message : String(err)}`)
  }

  await supabase.from('runtime_projection_refresh_log').insert({
    organization_id: organizationId,
    scope: 'study',
    scope_id: studyId,
    projection_kind: PROJECTION_KINDS.ALL,
    refresh_mode: PROJECTION_REFRESH_MODES.REBUILD,
    projection_version: RUNTIME_PROJECTION_VERSION,
    rows_affected: visitsRefreshed + subjectsRefreshed + (studyRefreshed ? 1 : 0),
    completed_at: new Date().toISOString(),
  })

  return {
    ok: errors.length === 0,
    visitsRefreshed,
    subjectsRefreshed,
    studyRefreshed,
    errors,
  }
}

export async function rebuildVisitProjection(
  supabase: SupabaseClient,
  visitId: string,
  organizationId: string,
): Promise<ProjectionRefreshResult> {
  const { refreshProjectionsCascadeForVisit } = await import('@/lib/projections/refresh')
  const result = await refreshProjectionsCascadeForVisit(supabase, visitId, organizationId)
  const ok = Boolean(result.visit?.ok && result.subject?.ok && result.study?.ok)
  return {
    ok,
    projectionVersion: RUNTIME_PROJECTION_VERSION,
    rowsAffected: (result.visit?.rowsAffected ?? 0) + (result.subject?.rowsAffected ?? 0) + (result.study?.rowsAffected ?? 0),
    error: result.visit?.error ?? result.subject?.error ?? result.study?.error,
  }
}
