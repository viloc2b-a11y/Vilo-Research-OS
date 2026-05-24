import { computeVisitReadinessProjection } from '@/lib/projections/compute/visit-readiness'
import { computeSubjectRuntimeProjection } from '@/lib/projections/compute/subject-runtime'
import { computeStudyExecutionProjection } from '@/lib/projections/compute/study-execution'
import { OBS_HOOK_SIGNAL } from '@/lib/observability/hook-signals'
import { observeProjectionRefreshed } from '@/lib/observability/hooks/observe-projection-refresh'
import {
  PROJECTION_KINDS,
  PROJECTION_REFRESH_MODES,
  RUNTIME_PROJECTION_VERSION,
} from '@/lib/projections/constants'
import { assertProjectionDerivedOnly } from '@/lib/projections/integrity'
import {
  upsertVisitReadinessProjection,
  upsertSubjectRuntimeProjection,
  upsertStudyExecutionProjection,
} from '@/lib/projections/persist'
import type {
  CascadeRefreshResult,
  ProjectionRefreshResult,
} from '@/lib/projections/types'
import type { SupabaseClient } from '@supabase/supabase-js'

async function logProjectionRefresh(
  supabase: SupabaseClient,
  input: {
    organizationId: string | null
    scope: 'visit' | 'subject' | 'study' | 'organization'
    scopeId: string
    projectionKind: string
    refreshMode: string
    rowsAffected: number
    error?: string | null
  },
): Promise<void> {
  const startedAt = new Date().toISOString()
  const { error } = await supabase.from('runtime_projection_refresh_log').insert({
    organization_id: input.organizationId,
    scope: input.scope,
    scope_id: input.scopeId,
    projection_kind: input.projectionKind,
    refresh_mode: input.refreshMode,
    projection_version: RUNTIME_PROJECTION_VERSION,
    rows_affected: input.rowsAffected,
    started_at: startedAt,
    completed_at: new Date().toISOString(),
    error: input.error ?? null,
  })
  if (error) {
    console.warn('[projections] refresh log insert failed', error.message)
  }
}

export async function refreshVisitReadinessProjection(
  supabase: SupabaseClient,
  visitId: string,
  organizationId: string,
  options?: { refreshMode?: string },
): Promise<ProjectionRefreshResult> {
  assertProjectionDerivedOnly('refreshVisitReadinessProjection')
  try {
    const computed = await computeVisitReadinessProjection(supabase, visitId, organizationId, {
      persistSafetyGovernance: true,
    })
    if (!computed) {
      return { ok: false, projectionVersion: RUNTIME_PROJECTION_VERSION, rowsAffected: 0, error: 'Visit not found.' }
    }
    await upsertVisitReadinessProjection(supabase, computed)
    await logProjectionRefresh(supabase, {
      organizationId,
      scope: 'visit',
      scopeId: visitId,
      projectionKind: PROJECTION_KINDS.VISIT_READINESS,
      refreshMode: options?.refreshMode ?? PROJECTION_REFRESH_MODES.TARGETED,
      rowsAffected: 1,
    })
    const { data: visitRow } = await supabase
      .from('visits')
      .select('study_id, study_subject_id')
      .eq('id', visitId)
      .maybeSingle()
    observeProjectionRefreshed({
      supabase,
      organizationId,
      signal: OBS_HOOK_SIGNAL.VISIT_READINESS_PROJECTION_REFRESHED,
      scopeId: visitId,
      visitId,
      studyId: (visitRow?.study_id as string) ?? null,
      studySubjectId: (visitRow?.study_subject_id as string) ?? null,
      projectionVersion: RUNTIME_PROJECTION_VERSION,
      refreshMode: options?.refreshMode ?? PROJECTION_REFRESH_MODES.TARGETED,
      ok: true,
      rowsAffected: 1,
    })
    return { ok: true, projectionVersion: RUNTIME_PROJECTION_VERSION, rowsAffected: 1 }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    await logProjectionRefresh(supabase, {
      organizationId,
      scope: 'visit',
      scopeId: visitId,
      projectionKind: PROJECTION_KINDS.VISIT_READINESS,
      refreshMode: options?.refreshMode ?? PROJECTION_REFRESH_MODES.TARGETED,
      rowsAffected: 0,
      error: message,
    })
    observeProjectionRefreshed({
      supabase,
      organizationId,
      signal: OBS_HOOK_SIGNAL.VISIT_READINESS_PROJECTION_REFRESHED,
      scopeId: visitId,
      visitId,
      projectionVersion: RUNTIME_PROJECTION_VERSION,
      refreshMode: options?.refreshMode ?? PROJECTION_REFRESH_MODES.TARGETED,
      ok: false,
      rowsAffected: 0,
      error: message,
    })
    return { ok: false, projectionVersion: RUNTIME_PROJECTION_VERSION, rowsAffected: 0, error: message }
  }
}

export async function refreshSubjectRuntimeProjection(
  supabase: SupabaseClient,
  studySubjectId: string,
  organizationId: string,
  options?: { refreshMode?: string },
): Promise<ProjectionRefreshResult> {
  assertProjectionDerivedOnly('refreshSubjectRuntimeProjection')
  try {
    const computed = await computeSubjectRuntimeProjection(
      supabase,
      studySubjectId,
      organizationId,
      { persistOperationalIntelligence: true },
    )
    if (!computed) {
      return {
        ok: false,
        projectionVersion: RUNTIME_PROJECTION_VERSION,
        rowsAffected: 0,
        error: 'Subject not found.',
      }
    }
    await upsertSubjectRuntimeProjection(supabase, computed)
    await logProjectionRefresh(supabase, {
      organizationId,
      scope: 'subject',
      scopeId: studySubjectId,
      projectionKind: PROJECTION_KINDS.SUBJECT_RUNTIME,
      refreshMode: options?.refreshMode ?? PROJECTION_REFRESH_MODES.TARGETED,
      rowsAffected: 1,
    })
    observeProjectionRefreshed({
      supabase,
      organizationId,
      signal: OBS_HOOK_SIGNAL.SUBJECT_RUNTIME_PROJECTION_REFRESHED,
      scopeId: studySubjectId,
      studySubjectId,
      studyId: computed.studyId,
      projectionVersion: RUNTIME_PROJECTION_VERSION,
      refreshMode: options?.refreshMode ?? PROJECTION_REFRESH_MODES.TARGETED,
      ok: true,
      rowsAffected: 1,
    })
    return { ok: true, projectionVersion: RUNTIME_PROJECTION_VERSION, rowsAffected: 1 }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    await logProjectionRefresh(supabase, {
      organizationId,
      scope: 'subject',
      scopeId: studySubjectId,
      projectionKind: PROJECTION_KINDS.SUBJECT_RUNTIME,
      refreshMode: options?.refreshMode ?? PROJECTION_REFRESH_MODES.TARGETED,
      rowsAffected: 0,
      error: message,
    })
    observeProjectionRefreshed({
      supabase,
      organizationId,
      signal: OBS_HOOK_SIGNAL.SUBJECT_RUNTIME_PROJECTION_REFRESHED,
      scopeId: studySubjectId,
      studySubjectId,
      projectionVersion: RUNTIME_PROJECTION_VERSION,
      refreshMode: options?.refreshMode ?? PROJECTION_REFRESH_MODES.TARGETED,
      ok: false,
      rowsAffected: 0,
      error: message,
    })
    return { ok: false, projectionVersion: RUNTIME_PROJECTION_VERSION, rowsAffected: 0, error: message }
  }
}

export async function refreshStudyExecutionProjection(
  supabase: SupabaseClient,
  studyId: string,
  organizationId: string,
  options?: { refreshMode?: string },
): Promise<ProjectionRefreshResult> {
  assertProjectionDerivedOnly('refreshStudyExecutionProjection')
  try {
    const computed = await computeStudyExecutionProjection(supabase, studyId, organizationId)
    if (!computed) {
      return { ok: false, projectionVersion: RUNTIME_PROJECTION_VERSION, rowsAffected: 0, error: 'Study not found.' }
    }
    await upsertStudyExecutionProjection(supabase, computed)
    await logProjectionRefresh(supabase, {
      organizationId,
      scope: 'study',
      scopeId: studyId,
      projectionKind: PROJECTION_KINDS.STUDY_EXECUTION,
      refreshMode: options?.refreshMode ?? PROJECTION_REFRESH_MODES.TARGETED,
      rowsAffected: 1,
    })
    observeProjectionRefreshed({
      supabase,
      organizationId,
      signal: OBS_HOOK_SIGNAL.STUDY_EXECUTION_PROJECTION_REFRESHED,
      scopeId: studyId,
      studyId,
      projectionVersion: RUNTIME_PROJECTION_VERSION,
      refreshMode: options?.refreshMode ?? PROJECTION_REFRESH_MODES.TARGETED,
      ok: true,
      rowsAffected: 1,
    })
    return { ok: true, projectionVersion: RUNTIME_PROJECTION_VERSION, rowsAffected: 1 }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    await logProjectionRefresh(supabase, {
      organizationId,
      scope: 'study',
      scopeId: studyId,
      projectionKind: PROJECTION_KINDS.STUDY_EXECUTION,
      refreshMode: options?.refreshMode ?? PROJECTION_REFRESH_MODES.TARGETED,
      rowsAffected: 0,
      error: message,
    })
    observeProjectionRefreshed({
      supabase,
      organizationId,
      signal: OBS_HOOK_SIGNAL.STUDY_EXECUTION_PROJECTION_REFRESHED,
      scopeId: studyId,
      studyId,
      projectionVersion: RUNTIME_PROJECTION_VERSION,
      refreshMode: options?.refreshMode ?? PROJECTION_REFRESH_MODES.TARGETED,
      ok: false,
      rowsAffected: 0,
      error: message,
    })
    return { ok: false, projectionVersion: RUNTIME_PROJECTION_VERSION, rowsAffected: 0, error: message }
  }
}

/**
 * Refresh visit → subject → study (coordinator operational chain).
 */
export async function refreshProjectionsCascadeForVisit(
  supabase: SupabaseClient,
  visitId: string,
  organizationId: string,
): Promise<CascadeRefreshResult> {
  const visitResult = await refreshVisitReadinessProjection(supabase, visitId, organizationId, {
    refreshMode: PROJECTION_REFRESH_MODES.CASCADE,
  })

  const { data: visit } = await supabase
    .from('visits')
    .select('study_subject_id, study_id')
    .eq('id', visitId)
    .eq('organization_id', organizationId)
    .maybeSingle()

  if (!visit) {
    return { visit: visitResult }
  }

  const subjectResult = await refreshSubjectRuntimeProjection(
    supabase,
    visit.study_subject_id as string,
    organizationId,
    { refreshMode: PROJECTION_REFRESH_MODES.CASCADE },
  )

  const studyResult = await refreshStudyExecutionProjection(
    supabase,
    visit.study_id as string,
    organizationId,
    { refreshMode: PROJECTION_REFRESH_MODES.CASCADE },
  )

  return { visit: visitResult, subject: subjectResult, study: studyResult }
}
