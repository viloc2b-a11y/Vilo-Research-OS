import type { PerformanceQueryScope, RawSignal } from '@/lib/performance/types'
import { exactCount } from '@/lib/performance/read-layer/query/count-helpers'
import {
  ACTIVE_VISIT_STATUSES,
  MAX_STUDIES_FOR_CARD_COUNT_QUERIES,
  RISK_VISIT_STATUSES,
} from '@/lib/performance/read-layer/query/query-limits'
import type { SupabaseServerClient } from '@/lib/performance/read-layer/query/supabase-client'
import { filterDashboardTestDataRows } from '@/lib/dashboard-test-data'

export type StudyRow = {
  id: string
  name: string
  status: string
  slug?: string | null
  created_source?: string | null
}

export type StudyCountsRow = {
  studyId: string
  subjectCount: number
  enrolledCount: number
  screeningCount: number
  randomizedCount: number
  screenFailedCount: number
  attributedSubjectCount: number
  unattributedSubjectCount: number
  activeVisitCount: number
  missedVisitCount: number
  openQueryCount: number
  blockedProcedureCount: number
  enrollmentTarget: number | null
  enrollmentEndDate: string | null
  budgetEvidenceDocumentCount: number
  contractEvidenceDocumentCount: number
  activeBudgetReferenceCount: number
  activeContractReferenceCount: number
}

type EnrollmentConfigRow = {
  study_id: string
  enrollment_target: number | null
  enrollment_end_date: string | null
}

export type StudySignals = {
  studies: RawSignal<StudyRow>
  studyCounts: RawSignal<StudyCountsRow>
}

export async function loadStudiesList(
  client: SupabaseServerClient,
  organizationIds: string[],
): Promise<RawSignal<StudyRow>> {
  const { data, error } = await client
    .from('studies')
    .select('id, name, slug, status, created_source')
    .in('organization_id', organizationIds)
    .neq('status', 'archived')
    .order('name', { ascending: true })

  if (error) {
    return { source: 'studies', rows: [], error: { source: 'studies', message: error.message } }
  }

  return { source: 'studies', rows: filterDashboardTestDataRows((data ?? []) as StudyRow[]), error: null }
}

async function countSubjectsForStudy(
  client: SupabaseServerClient,
  scope: PerformanceQueryScope,
  studyId: string,
  statuses?: readonly string[],
) {
  return exactCount(() => {
    let query = client
      .from('study_subjects')
      .select('*', { count: 'exact', head: true })
      .in('organization_id', scope.organizationIds)
      .eq('study_id', studyId)

    if (statuses?.length) {
      query = query.in('enrollment_status', [...statuses])
    }

    return query
  })
}

async function countVisitsForStudy(
  client: SupabaseServerClient,
  scope: PerformanceQueryScope,
  studyId: string,
  visitStatuses?: readonly string[],
) {
  return exactCount(() => {
    let query = client
      .from('visits')
      .select('*', { count: 'exact', head: true })
      .in('organization_id', scope.organizationIds)
      .eq('study_id', studyId)

    if (visitStatuses?.length) {
      query = query.in('visit_status', [...visitStatuses])
    }

    return query
  })
}

async function countOpenQueriesForStudy(
  client: SupabaseServerClient,
  scope: PerformanceQueryScope,
  studyId: string,
) {
  const workflow = await exactCount(() =>
    client
      .from('subject_workflow_actions')
      .select('*', { count: 'exact', head: true })
      .in('organization_id', scope.organizationIds)
      .eq('study_id', studyId)
      .eq('action_type', 'query')
      .in('status', ['open', 'in_progress']),
  )

  const snapshot = await exactCount(() =>
    client
      .from('visit_snapshot_queries')
      .select('*', { count: 'exact', head: true })
      .in('organization_id', scope.organizationIds)
      .eq('study_id', studyId)
      .in('query_status', ['open', 'answered']),
  )

  return {
    count: workflow.count + snapshot.count,
    error: [workflow.error, snapshot.error].filter(Boolean).join('; ') || null,
  }
}

async function countBlockedProceduresForStudy(
  client: SupabaseServerClient,
  scope: PerformanceQueryScope,
  studyId: string,
) {
  return exactCount(() =>
    client
      .from('procedure_executions')
      .select('*', { count: 'exact', head: true })
      .in('organization_id', scope.organizationIds)
      .eq('study_id', studyId)
      .eq('validation_status', 'blocked'),
  )
}

async function countDocumentDomainForStudy(
  client: SupabaseServerClient,
  scope: PerformanceQueryScope,
  studyId: string,
  domain: 'budget_analysis' | 'contract_analysis',
) {
  return exactCount(() =>
    client
      .from('document_intelligence_domains')
      .select('id', { count: 'exact', head: true })
      .in('organization_id', scope.organizationIds)
      .eq('study_id', studyId)
      .eq('domain', domain)
      .eq('status', 'active'),
  )
}

async function countActiveDocumentReferenceForStudy(
  client: SupabaseServerClient,
  scope: PerformanceQueryScope,
  studyId: string,
  domain: 'budget_analysis' | 'contract_analysis',
) {
  return exactCount(() =>
    client
      .from('document_intelligence_active_references')
      .select('id', { count: 'exact', head: true })
      .in('organization_id', scope.organizationIds)
      .eq('study_id', studyId)
      .eq('active_reference_domain', domain)
      .eq('is_active_reference', true),
  )
}

export async function loadStudyCardCounts(
  client: SupabaseServerClient,
  scope: PerformanceQueryScope,
  studyIds: string[],
): Promise<{
  counts: StudyCountsRow[]
  errors: { source: string; message: string }[]
  skipped: boolean
}> {
  const errors: { source: string; message: string }[] = []

  if (studyIds.length > MAX_STUDIES_FOR_CARD_COUNT_QUERIES) {
    return {
      counts: studyIds.map((studyId) => ({
        studyId,
        subjectCount: 0,
        enrolledCount: 0,
        screeningCount: 0,
        randomizedCount: 0,
        screenFailedCount: 0,
        attributedSubjectCount: 0,
        unattributedSubjectCount: 0,
        activeVisitCount: 0,
        missedVisitCount: 0,
        openQueryCount: 0,
        blockedProcedureCount: 0,
        enrollmentTarget: null,
        enrollmentEndDate: null,
        budgetEvidenceDocumentCount: 0,
        contractEvidenceDocumentCount: 0,
        activeBudgetReferenceCount: 0,
        activeContractReferenceCount: 0,
      })),
      errors: [
        {
          source: 'study_card_counts',
          message: `Study list exceeds ${MAX_STUDIES_FOR_CARD_COUNT_QUERIES} studies; apply a study filter for per-study metrics.`,
        },
      ],
      skipped: true,
    }
  }

  const { data: configs, error: configError } = await client
    .from('study_enrollment_configs')
    .select('study_id, enrollment_target, enrollment_end_date')
    .in('organization_id', scope.organizationIds)
    .in('study_id', studyIds)

  if (configError) {
    errors.push({ source: 'study_enrollment_configs', message: configError.message })
  }

  const configByStudyId = new Map(
    ((configs ?? []) as EnrollmentConfigRow[]).map((config) => [config.study_id, config]),
  )

  const rows = await Promise.all(
    studyIds.map(async (studyId) => {
      const [
        subjects,
        enrolled,
        screening,
        randomized,
        screenFailed,
        attributed,
        unattributed,
        active,
        missed,
        queries,
        blocked,
        budgetEvidence,
        contractEvidence,
        activeBudgetReference,
        activeContractReference,
      ] = await Promise.all([
        countSubjectsForStudy(client, scope, studyId),
        countSubjectsForStudy(client, scope, studyId, ['enrolled']),
        countSubjectsForStudy(client, scope, studyId, ['screening']),
        countSubjectsForStudy(client, scope, studyId, ['randomized']),
        countSubjectsForStudy(client, scope, studyId, ['screen_failed']),
        exactCount(() =>
          client
            .from('study_subjects')
            .select('*', { count: 'exact', head: true })
            .in('organization_id', scope.organizationIds)
            .eq('study_id', studyId)
            .not('recruitment_source', 'is', null),
        ),
        exactCount(() =>
          client
            .from('study_subjects')
            .select('*', { count: 'exact', head: true })
            .in('organization_id', scope.organizationIds)
            .eq('study_id', studyId)
            .is('recruitment_source', null),
        ),
        countVisitsForStudy(client, scope, studyId, ACTIVE_VISIT_STATUSES),
        countVisitsForStudy(client, scope, studyId, RISK_VISIT_STATUSES),
        countOpenQueriesForStudy(client, scope, studyId),
        countBlockedProceduresForStudy(client, scope, studyId),
        countDocumentDomainForStudy(client, scope, studyId, 'budget_analysis'),
        countDocumentDomainForStudy(client, scope, studyId, 'contract_analysis'),
        countActiveDocumentReferenceForStudy(client, scope, studyId, 'budget_analysis'),
        countActiveDocumentReferenceForStudy(client, scope, studyId, 'contract_analysis'),
      ])

      for (const [source, result] of [
        ['study_subjects', subjects],
        ['study_subjects_enrolled', enrolled],
        ['study_subjects_screening', screening],
        ['study_subjects_randomized', randomized],
        ['study_subjects_screen_failed', screenFailed],
        ['study_subjects_attributed', attributed],
        ['study_subjects_unattributed', unattributed],
        ['visits_active', active],
        ['visits_missed', missed],
        ['workflow_queries', queries],
        ['procedures_blocked', blocked],
        ['budget_evidence_documents', budgetEvidence],
        ['contract_evidence_documents', contractEvidence],
        ['active_budget_references', activeBudgetReference],
        ['active_contract_references', activeContractReference],
      ] as const) {
        if (result.error) {
          errors.push({ source: `${source}:${studyId}`, message: result.error })
        }
      }

      const config = configByStudyId.get(studyId)

      return {
        studyId,
        subjectCount: subjects.count,
        enrolledCount: enrolled.count,
        screeningCount: screening.count,
        randomizedCount: randomized.count,
        screenFailedCount: screenFailed.count,
        attributedSubjectCount: attributed.count,
        unattributedSubjectCount: unattributed.count,
        activeVisitCount: active.count,
        missedVisitCount: missed.count,
        openQueryCount: queries.count,
        blockedProcedureCount: blocked.count,
        enrollmentTarget: config?.enrollment_target ?? null,
        enrollmentEndDate: config?.enrollment_end_date ?? null,
        budgetEvidenceDocumentCount: budgetEvidence.count,
        contractEvidenceDocumentCount: contractEvidence.count,
        activeBudgetReferenceCount: activeBudgetReference.count,
        activeContractReferenceCount: activeContractReference.count,
      }
    }),
  )

  return { counts: rows, errors, skipped: false }
}

export async function loadStudySignals(
  client: SupabaseServerClient,
  organizationIds: string[],
  queryScope: PerformanceQueryScope,
  studyIds: string[],
): Promise<StudySignals & { studyCountErrors: { source: string; message: string }[] }> {
  const studies = await loadStudiesList(client, organizationIds)
  const { counts, errors } = await loadStudyCardCounts(client, queryScope, studyIds)

  return {
    studies,
    studyCounts: { source: 'study_card_counts', rows: counts, error: null },
    studyCountErrors: errors,
  }
}
