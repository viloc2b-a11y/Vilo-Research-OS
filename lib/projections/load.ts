import { computeVisitReadinessProjection } from '@/lib/projections/compute/visit-readiness'
import { computeSubjectRuntimeProjection } from '@/lib/projections/compute/subject-runtime'
import { computeStudyExecutionProjection } from '@/lib/projections/compute/study-execution'
import { PROJECTION_DEFAULT_MAX_AGE_MS } from '@/lib/projections/constants'
import {
  assertProjectionDerivedOnly,
  isProjectionStale,
  projectionVersionMismatchWarning,
} from '@/lib/projections/integrity'
import type {
  VisitReadinessProjection,
  SubjectRuntimeProjection,
  StudyExecutionProjection,
} from '@/lib/projections/types'
import type { SupabaseClient } from '@supabase/supabase-js'

function mapVisitRow(row: Record<string, unknown>): VisitReadinessProjection {
  return {
    visitId: row.visit_id as string,
    organizationId: row.organization_id as string,
    studyId: row.study_id as string,
    studySubjectId: row.study_subject_id as string,
    computedAt: row.computed_at as string,
    projectionVersion: row.projection_version as number,
    readinessStatus: row.readiness_status as VisitReadinessProjection['readinessStatus'],
    pendingProcedureCount: row.pending_procedure_count as number,
    unsignedProcedureCount: row.unsigned_procedure_count as number,
    unresolvedFindingCount: row.unresolved_finding_count as number,
    missingSourceCount: row.missing_source_count as number,
    safetyBlockerCount: row.safety_blocker_count as number,
    visitCompletionReady: row.visit_completion_ready as boolean,
    coordinatorSignReady: row.coordinator_sign_ready as boolean,
    investigatorSignReady: row.investigator_sign_ready as boolean,
    blockerCount: row.blocker_count as number,
    blockers: (row.blockers as VisitReadinessProjection['blockers']) ?? [],
    snapshot: (row.snapshot as Record<string, unknown>) ?? {},
  }
}

function mapSubjectRow(row: Record<string, unknown>): SubjectRuntimeProjection {
  return {
    studySubjectId: row.study_subject_id as string,
    organizationId: row.organization_id as string,
    studyId: row.study_id as string,
    computedAt: row.computed_at as string,
    projectionVersion: row.projection_version as number,
    longitudinalState: row.longitudinal_state as SubjectRuntimeProjection['longitudinalState'],
    operationalHealth: row.operational_health as SubjectRuntimeProjection['operationalHealth'],
    unresolvedSafetyCount: row.unresolved_safety_count as number,
    missedVisitCount: row.missed_visit_count as number,
    pendingWorkflowCount: row.pending_workflow_count as number,
    incompleteSourceCount: row.incomplete_source_count as number,
    openVisitCount: row.open_visit_count as number,
    blockerCount: row.blocker_count as number,
    blockers: (row.blockers as SubjectRuntimeProjection['blockers']) ?? [],
    snapshot: (row.snapshot as Record<string, unknown>) ?? {},
  }
}

function mapStudyRow(row: Record<string, unknown>): StudyExecutionProjection {
  return {
    studyId: row.study_id as string,
    organizationId: row.organization_id as string,
    computedAt: row.computed_at as string,
    projectionVersion: row.projection_version as number,
    operationalRiskLevel: row.operational_risk_level as StudyExecutionProjection['operationalRiskLevel'],
    enrolledSubjectCount: row.enrolled_subject_count as number,
    activeSubjectCount: row.active_subject_count as number,
    incompleteSourceCount: row.incomplete_source_count as number,
    openWorkflowCount: row.open_workflow_count as number,
    openQueryCount: row.open_query_count as number,
    missedVisitCount: row.missed_visit_count as number,
    unresolvedSafetyCount: row.unresolved_safety_count as number,
    protocolExecutionBurdenScore: row.protocol_execution_burden_score as number,
    sourceCompletionBurdenScore: row.source_completion_burden_score as number,
    blockerCount: row.blocker_count as number,
    blockers: (row.blockers as StudyExecutionProjection['blockers']) ?? [],
    snapshot: (row.snapshot as Record<string, unknown>) ?? {},
  }
}

export type LoadProjectionOptions = {
  /** Recompute when cached row is missing, stale, or version mismatch. */
  refreshIfStale?: boolean
  maxAgeMs?: number
}

export async function loadVisitReadinessProjection(
  supabase: SupabaseClient,
  visitId: string,
  organizationId: string,
  options?: LoadProjectionOptions,
): Promise<VisitReadinessProjection | null> {
  assertProjectionDerivedOnly('loadVisitReadinessProjection')

  const { data, error } = await supabase
    .from('visit_readiness_projections')
    .select('*')
    .eq('visit_id', visitId)
    .maybeSingle()

  if (error) throw new Error(error.message)

  const maxAge = options?.maxAgeMs ?? PROJECTION_DEFAULT_MAX_AGE_MS
  const stale =
    !data ||
    isProjectionStale(data.computed_at as string, maxAge) ||
    Boolean(projectionVersionMismatchWarning(data.projection_version as number))

  if (data && !stale) {
    return mapVisitRow(data as Record<string, unknown>)
  }

  if (options?.refreshIfStale === false && data) {
    return mapVisitRow(data as Record<string, unknown>)
  }

  return computeVisitReadinessProjection(supabase, visitId, organizationId)
}

export async function loadSubjectRuntimeProjection(
  supabase: SupabaseClient,
  studySubjectId: string,
  organizationId: string,
  options?: LoadProjectionOptions,
): Promise<SubjectRuntimeProjection | null> {
  assertProjectionDerivedOnly('loadSubjectRuntimeProjection')

  const { data, error } = await supabase
    .from('subject_runtime_projections')
    .select('*')
    .eq('study_subject_id', studySubjectId)
    .maybeSingle()

  if (error) throw new Error(error.message)

  const maxAge = options?.maxAgeMs ?? PROJECTION_DEFAULT_MAX_AGE_MS
  const stale =
    !data ||
    isProjectionStale(data.computed_at as string, maxAge) ||
    Boolean(projectionVersionMismatchWarning(data.projection_version as number))

  if (data && !stale) {
    return mapSubjectRow(data as Record<string, unknown>)
  }

  if (options?.refreshIfStale === false && data) {
    return mapSubjectRow(data as Record<string, unknown>)
  }

  return computeSubjectRuntimeProjection(supabase, studySubjectId, organizationId)
}

export async function loadStudyExecutionProjection(
  supabase: SupabaseClient,
  studyId: string,
  organizationId: string,
  options?: LoadProjectionOptions,
): Promise<StudyExecutionProjection | null> {
  assertProjectionDerivedOnly('loadStudyExecutionProjection')

  const { data, error } = await supabase
    .from('study_execution_projections')
    .select('*')
    .eq('study_id', studyId)
    .maybeSingle()

  if (error) throw new Error(error.message)

  const maxAge = options?.maxAgeMs ?? PROJECTION_DEFAULT_MAX_AGE_MS
  const stale =
    !data ||
    isProjectionStale(data.computed_at as string, maxAge) ||
    Boolean(projectionVersionMismatchWarning(data.projection_version as number))

  if (data && !stale) {
    return mapStudyRow(data as Record<string, unknown>)
  }

  if (options?.refreshIfStale === false && data) {
    return mapStudyRow(data as Record<string, unknown>)
  }

  return computeStudyExecutionProjection(supabase, studyId, organizationId)
}
