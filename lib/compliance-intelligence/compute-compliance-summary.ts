import type { SupabaseClient } from '@supabase/supabase-js'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ComplianceRiskLevel = 'critical' | 'elevated' | 'moderate' | 'low'

export type SubjectComplianceBreakdown = {
  subjectId: string
  subjectCode: string
  deviationCount: number
  findingCount: number
  queryCount: number
}

export type ComplianceSummary = {
  studyId: string | null
  openDeviations: number
  criticalDeviations: number
  sponsorNotifiableDeviations: number
  irbNotifiableDeviations: number
  openCapa: number
  overdueCapa: number
  openFindings: number
  openQueries: number
  queryBurdenScore: number
  riskLevel: ComplianceRiskLevel
  perSubject?: SubjectComplianceBreakdown[]
}

// ---------------------------------------------------------------------------
// Risk level thresholds
// ---------------------------------------------------------------------------

function computeRiskLevel(args: {
  criticalDeviations: number
  overdueCapa: number
  queryBurdenScore: number
  openDeviations: number
  openCapa: number
}): ComplianceRiskLevel {
  const { criticalDeviations, overdueCapa, queryBurdenScore, openDeviations, openCapa } = args

  if (criticalDeviations > 0 || overdueCapa > 0 || queryBurdenScore >= 70) {
    return 'critical'
  }
  if (openDeviations > 3 || openCapa > 2 || queryBurdenScore >= 40) {
    return 'elevated'
  }
  if (openDeviations > 0 || openCapa > 0 || queryBurdenScore >= 20) {
    return 'moderate'
  }
  return 'low'
}

// ---------------------------------------------------------------------------
// Main compute function
// ---------------------------------------------------------------------------

export async function computeComplianceSummary(args: {
  supabase: SupabaseClient
  organizationId: string
  studyId?: string
}): Promise<ComplianceSummary> {
  const { supabase, organizationId, studyId } = args
  const now = new Date().toISOString()

  // -------------------------------------------------------------------------
  // 1. Protocol deviations
  // -------------------------------------------------------------------------

  let deviationsQuery = supabase
    .from('protocol_deviations')
    .select('id, severity, status, requires_sponsor_notification, requires_irb_notification, subject_id')
    .eq('organization_id', organizationId)

  if (studyId) {
    deviationsQuery = deviationsQuery.eq('study_id', studyId)
  }

  const { data: deviationRows, error: devError } = await deviationsQuery

  if (devError) throw new Error(devError.message)

  const allDeviations = deviationRows ?? []
  const openDeviations = allDeviations.filter((d) => d.status !== 'closed').length
  const criticalDeviations = allDeviations.filter(
    (d) => d.status !== 'closed' && d.severity === 'critical',
  ).length
  const sponsorNotifiableDeviations = allDeviations.filter(
    (d) => d.status !== 'closed' && d.requires_sponsor_notification === true,
  ).length
  const irbNotifiableDeviations = allDeviations.filter(
    (d) => d.status !== 'closed' && d.requires_irb_notification === true,
  ).length

  // -------------------------------------------------------------------------
  // 2. CAPA actions
  // -------------------------------------------------------------------------

  let capaQuery = supabase
    .from('capa_actions')
    .select('id, capa_status, due_date')
    .eq('organization_id', organizationId)

  if (studyId) {
    capaQuery = capaQuery.eq('study_id', studyId)
  }

  const { data: capaRows, error: capaError } = await capaQuery

  if (capaError) throw new Error(capaError.message)

  const allCapa = capaRows ?? []
  const openCapa = allCapa.filter((c) => c.capa_status !== 'closed').length
  const overdueCapa = allCapa.filter((c) => {
    return (
      c.capa_status !== 'closed' &&
      c.due_date != null &&
      (c.due_date as string) < now
    )
  }).length

  // -------------------------------------------------------------------------
  // 3. Source response validation findings (open)
  // -------------------------------------------------------------------------

  let findingsQuery = supabase
    .from('source_response_validation_findings')
    .select('id, subject_id', { count: 'exact' })
    .eq('organization_id', organizationId)
    .eq('status', 'open')

  if (studyId) {
    findingsQuery = findingsQuery.eq('study_id', studyId)
  }

  const { data: findingRows, count: findingsCount, error: findingsError } = await findingsQuery

  if (findingsError) throw new Error(findingsError.message)

  const openFindings = findingsCount ?? (findingRows ?? []).length

  // -------------------------------------------------------------------------
  // 4. Open queries from subject_workflow_actions
  // -------------------------------------------------------------------------

  let queriesQuery = supabase
    .from('subject_workflow_actions')
    .select('id, subject_id', { count: 'exact' })
    .eq('organization_id', organizationId)
    .eq('action_type', 'query')
    .in('status', ['open', 'pending'])

  if (studyId) {
    queriesQuery = queriesQuery.eq('study_id', studyId)
  }

  const { data: queryRows, count: queriesCount, error: queriesError } = await queriesQuery

  if (queriesError) throw new Error(queriesError.message)

  const openQueries = queriesCount ?? (queryRows ?? []).length

  // -------------------------------------------------------------------------
  // 5. Query burden score
  // -------------------------------------------------------------------------

  const rawScore = openFindings * 3 + openQueries * 2 + criticalDeviations * 10
  const queryBurdenScore = Math.min(100, rawScore)

  // -------------------------------------------------------------------------
  // 6. Risk level
  // -------------------------------------------------------------------------

  const riskLevel = computeRiskLevel({
    criticalDeviations,
    overdueCapa,
    queryBurdenScore,
    openDeviations,
    openCapa,
  })

  // -------------------------------------------------------------------------
  // 7. Per-subject breakdown (only when studyId is provided)
  // -------------------------------------------------------------------------

  let perSubject: SubjectComplianceBreakdown[] | undefined

  if (studyId) {
    // Load study subjects for subject_code lookup
    const { data: subjectRows, error: subjectError } = await supabase
      .from('study_subjects')
      .select('id, subject_code')
      .eq('organization_id', organizationId)
      .eq('study_id', studyId)

    if (subjectError) throw new Error(subjectError.message)

    const subjects = subjectRows ?? []
    const subjectMap = new Map<string, string>(
      subjects.map((s) => [s.id as string, s.subject_code as string]),
    )

    // Group deviations by subject_id
    const devBySubject = new Map<string, number>()
    for (const d of allDeviations) {
      if (d.status !== 'closed' && d.subject_id) {
        const sid = d.subject_id as string
        devBySubject.set(sid, (devBySubject.get(sid) ?? 0) + 1)
      }
    }

    // Group findings by subject_id (use the rows returned earlier)
    const findingsBySubject = new Map<string, number>()
    for (const f of findingRows ?? []) {
      const sid = f.subject_id as string | null
      if (sid) {
        findingsBySubject.set(sid, (findingsBySubject.get(sid) ?? 0) + 1)
      }
    }

    // Group queries by subject_id (use the rows returned earlier)
    const queriesBySubject = new Map<string, number>()
    for (const q of queryRows ?? []) {
      const sid = q.subject_id as string | null
      if (sid) {
        queriesBySubject.set(sid, (queriesBySubject.get(sid) ?? 0) + 1)
      }
    }

    // Build set of subjects that appear in any bucket
    const allSubjectIds = new Set([
      ...devBySubject.keys(),
      ...findingsBySubject.keys(),
      ...queriesBySubject.keys(),
    ])

    perSubject = Array.from(allSubjectIds)
      .map((subjectId): SubjectComplianceBreakdown => ({
        subjectId,
        subjectCode: subjectMap.get(subjectId) ?? subjectId,
        deviationCount: devBySubject.get(subjectId) ?? 0,
        findingCount: findingsBySubject.get(subjectId) ?? 0,
        queryCount: queriesBySubject.get(subjectId) ?? 0,
      }))
      .sort(
        (a, b) =>
          b.deviationCount + b.findingCount + b.queryCount -
          (a.deviationCount + a.findingCount + a.queryCount),
      )
  }

  return {
    studyId: studyId ?? null,
    openDeviations,
    criticalDeviations,
    sponsorNotifiableDeviations,
    irbNotifiableDeviations,
    openCapa,
    overdueCapa,
    openFindings,
    openQueries,
    queryBurdenScore,
    riskLevel,
    perSubject,
  }
}
