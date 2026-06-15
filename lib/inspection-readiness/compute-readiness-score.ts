import type { SupabaseClient } from '@supabase/supabase-js'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ReadinessDimension = {
  name: string
  score: number
  status: 'pass' | 'warning' | 'fail'
  detail: string
}

export type InspectionReadinessScore = {
  studyId: string
  overallScore: number
  riskLevel: 'inspection-ready' | 'needs-attention' | 'not-ready'
  dimensions: ReadinessDimension[]
  generatedAt: string
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function clamp(value: number): number {
  return Math.max(0, Math.min(100, value))
}

function dimensionStatus(
  score: number,
  failThreshold: number,
  warnThreshold: number,
): 'pass' | 'warning' | 'fail' {
  if (score < failThreshold) return 'fail'
  if (score < warnThreshold) return 'warning'
  return 'pass'
}

// ---------------------------------------------------------------------------
// Dimension 1 — Source Completeness
// % of completed procedures with a submitted source response set
// ---------------------------------------------------------------------------

async function computeSourceCompleteness(
  supabase: SupabaseClient,
  organizationId: string,
  studyId: string,
): Promise<ReadinessDimension> {
  const name = 'Source Completeness'

  const { count: completedCount, error: completedError } = await supabase
    .from('procedure_executions')
    .select('id', { count: 'exact', head: true })
    .eq('organization_id', organizationId)
    .eq('study_id', studyId)
    .eq('execution_status', 'completed')

  if (completedError) {
    return {
      name,
      score: 0,
      status: 'fail',
      detail: `Could not load procedure execution data: ${completedError.message}`,
    }
  }

  const total = completedCount ?? 0

  if (total === 0) {
    return {
      name,
      score: 100,
      status: 'pass',
      detail: 'No completed procedures — nothing to check.',
    }
  }

  const { count: withResponseCount, error: responseError } = await supabase
    .from('source_response_sets')
    .select('id', { count: 'exact', head: true })
    .eq('organization_id', organizationId)
    .eq('study_id', studyId)
    .in('status', ['submitted', 'pending_review', 'reviewed', 'signed', 'locked', 'corrected', 'addended'])

  if (responseError) {
    return {
      name,
      score: 0,
      status: 'fail',
      detail: `Could not load response set data: ${responseError.message}`,
    }
  }

  const submitted = withResponseCount ?? 0
  const pct = submitted / total
  const score = clamp(Math.round(pct * 100))
  const status = dimensionStatus(score, 70, 90)

  return {
    name,
    score,
    status,
    detail: `${submitted} of ${total} completed procedures have a submitted response set (${score}%).`,
  }
}

// ---------------------------------------------------------------------------
// Dimension 2 — Open Findings / Queries
// source_response_validation_findings has no study_id — filter via response set
// ---------------------------------------------------------------------------

async function computeOpenFindings(
  supabase: SupabaseClient,
  organizationId: string,
  studyId: string,
): Promise<ReadinessDimension> {
  const name = 'Open Findings / Queries'

  // Fetch open response set IDs for this study first, then count open findings
  const { data: responseSets, error: rsError } = await supabase
    .from('source_response_sets')
    .select('id')
    .eq('organization_id', organizationId)
    .eq('study_id', studyId)

  if (rsError) {
    return {
      name,
      score: 0,
      status: 'fail',
      detail: `Could not load response set data: ${rsError.message}`,
    }
  }

  const responseSetIds = (responseSets ?? []).map((rs) => String(rs.id))

  if (responseSetIds.length === 0) {
    return {
      name,
      score: 100,
      status: 'pass',
      detail: 'No response sets found — no findings to check.',
    }
  }

  const { count: openCount, error } = await supabase
    .from('source_response_validation_findings')
    .select('id', { count: 'exact', head: true })
    .in('response_set_id', responseSetIds)
    .eq('status', 'open')

  if (error) {
    return {
      name,
      score: 0,
      status: 'fail',
      detail: `Could not load findings data: ${error.message}`,
    }
  }

  const count = openCount ?? 0
  const score = clamp(100 - count * 5)
  const status = count > 10 ? 'fail' : count > 0 ? 'warning' : 'pass'

  return {
    name,
    score,
    status,
    detail:
      count === 0
        ? 'No open findings.'
        : `${count} open finding${count === 1 ? '' : 's'} requiring resolution.`,
  }
}

// ---------------------------------------------------------------------------
// Dimension 3 — Protocol Deviations
// ---------------------------------------------------------------------------

async function computeProtocolDeviations(
  supabase: SupabaseClient,
  organizationId: string,
  studyId: string,
): Promise<ReadinessDimension> {
  const name = 'Protocol Deviations'

  const [openResult, criticalResult] = await Promise.all([
    supabase
      .from('protocol_deviations')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', organizationId)
      .eq('study_id', studyId)
      .eq('status', 'open'),
    supabase
      .from('protocol_deviations')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', organizationId)
      .eq('study_id', studyId)
      .eq('severity', 'critical'),
  ])

  if (openResult.error || criticalResult.error) {
    const msg =
      openResult.error?.message ?? criticalResult.error?.message ?? 'unavailable'
    return { name, score: 0, status: 'fail', detail: `Could not load deviation data: ${msg}` }
  }

  const openCount = openResult.count ?? 0
  const criticalCount = criticalResult.count ?? 0
  const score = clamp(100 - openCount * 10 - criticalCount * 20)
  const status = criticalCount > 0 ? 'fail' : openCount > 0 ? 'warning' : 'pass'

  const details: string[] = []
  if (openCount > 0) details.push(`${openCount} open deviation${openCount === 1 ? '' : 's'}`)
  if (criticalCount > 0) details.push(`${criticalCount} critical`)

  return {
    name,
    score,
    status,
    detail: details.length > 0 ? details.join(', ') + '.' : 'No open or critical deviations.',
  }
}

// ---------------------------------------------------------------------------
// Dimension 4 — CAPA Status
// ---------------------------------------------------------------------------

async function computeCapaStatus(
  supabase: SupabaseClient,
  organizationId: string,
  studyId: string,
): Promise<ReadinessDimension> {
  const name = 'CAPA Status'

  const now = new Date().toISOString()
  const openStatuses = ['open', 'in_progress', 'under_review']

  const [openResult, overdueResult] = await Promise.all([
    supabase
      .from('capa_actions')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', organizationId)
      .eq('study_id', studyId)
      .in('capa_status', openStatuses),
    supabase
      .from('capa_actions')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', organizationId)
      .eq('study_id', studyId)
      .in('capa_status', openStatuses)
      .not('due_date', 'is', null)
      .lt('due_date', now),
  ])

  if (openResult.error || overdueResult.error) {
    const msg =
      openResult.error?.message ?? overdueResult.error?.message ?? 'unavailable'
    return { name, score: 0, status: 'fail', detail: `Could not load CAPA data: ${msg}` }
  }

  const openCount = openResult.count ?? 0
  const overdueCount = overdueResult.count ?? 0
  const score = clamp(100 - openCount * 10 - overdueCount * 20)
  const status = overdueCount > 0 ? 'fail' : openCount > 0 ? 'warning' : 'pass'

  const details: string[] = []
  if (openCount > 0) details.push(`${openCount} open CAPA action${openCount === 1 ? '' : 's'}`)
  if (overdueCount > 0) details.push(`${overdueCount} overdue`)

  return {
    name,
    score,
    status,
    detail: details.length > 0 ? details.join(', ') + '.' : 'No open CAPA actions.',
  }
}

// ---------------------------------------------------------------------------
// Dimension 5 — Safety Events
// Uses the safety_events table (AE/SAE registry) introduced in migration 0185
// ---------------------------------------------------------------------------

async function computeSafetyEvents(
  supabase: SupabaseClient,
  organizationId: string,
  studyId: string,
): Promise<ReadinessDimension> {
  const name = 'Safety Events'

  const { count: openCount, error } = await supabase
    .from('safety_events')
    .select('id', { count: 'exact', head: true })
    .eq('organization_id', organizationId)
    .eq('study_id', studyId)
    .in('event_status', ['open', 'under_review'])

  if (error) {
    return {
      name,
      score: 0,
      status: 'fail',
      detail: `Could not load safety event data: ${error.message}`,
    }
  }

  const count = openCount ?? 0
  const score = clamp(100 - count * 15)
  const status = count > 0 ? 'fail' : 'pass'

  return {
    name,
    score,
    status,
    detail:
      count === 0
        ? 'No open or under-review safety events.'
        : `${count} unresolved safety event${count === 1 ? '' : 's'} (AE/SAE).`,
  }
}

// ---------------------------------------------------------------------------
// Dimension 6 — Signature Completeness
// Uses operational_signature_requests (pending vs signed)
// If the table is unavailable, returns score 100 with a "not tracked" note
// ---------------------------------------------------------------------------

async function computeSignatureCompleteness(
  supabase: SupabaseClient,
  organizationId: string,
  studyId: string,
): Promise<ReadinessDimension> {
  const name = 'Signature Completeness'

  const { count: totalCount, error: probeError } = await supabase
    .from('operational_signature_requests')
    .select('id', { count: 'exact', head: true })
    .eq('organization_id', organizationId)
    .eq('study_id', studyId)

  if (probeError) {
    return {
      name,
      score: 100,
      status: 'pass',
      detail: 'Signature completeness not tracked.',
    }
  }

  const total = totalCount ?? 0

  if (total === 0) {
    return {
      name,
      score: 100,
      status: 'pass',
      detail: 'No signature requests found.',
    }
  }

  const { count: signedCount } = await supabase
    .from('operational_signature_requests')
    .select('id', { count: 'exact', head: true })
    .eq('organization_id', organizationId)
    .eq('study_id', studyId)
    .eq('status', 'signed')

  const signed = signedCount ?? 0
  const pct = signed / total
  const score = clamp(Math.round(pct * 100))
  const status = dimensionStatus(score, 70, 90)

  return {
    name,
    score,
    status,
    detail: `${signed} of ${total} signature requests completed (${score}%).`,
  }
}

// ---------------------------------------------------------------------------
// Dimension 7 — Training Compliance
// Uses study_training_assignments (migration 0147 — new training runtime).
// ---------------------------------------------------------------------------

const INCOMPLETE_TRAINING_STATUSES = [
  'Assigned',
  'Pending Trainee Signature',
  'Pending Trainer Signature',
  'Pending PI Acknowledgment',
  'Reopened',
]

async function computeTrainingCompliance(
  supabase: SupabaseClient,
  organizationId: string,
  studyId: string,
): Promise<ReadinessDimension> {
  const name = 'Training Compliance'
  const today = new Date().toISOString().slice(0, 10)

  const [{ count: incompleteCount, error: incErr }, { count: overdueCount, error: ovErr }] =
    await Promise.all([
      supabase
        .from('study_training_assignments')
        .select('id', { count: 'exact', head: true })
        .eq('organization_id', organizationId)
        .eq('study_id', studyId)
        .in('training_status', INCOMPLETE_TRAINING_STATUSES),
      supabase
        .from('study_training_assignments')
        .select('id', { count: 'exact', head: true })
        .eq('organization_id', organizationId)
        .eq('study_id', studyId)
        .in('training_status', INCOMPLETE_TRAINING_STATUSES)
        .not('due_date', 'is', null)
        .lt('due_date', today),
    ])

  if (incErr || ovErr) {
    return { name, score: 100, status: 'pass', detail: 'Training compliance data unavailable.' }
  }

  const incomplete = incompleteCount ?? 0
  const overdue = overdueCount ?? 0

  if (incomplete === 0) {
    return { name, score: 100, status: 'pass', detail: 'All training assignments complete.' }
  }

  const score = clamp(100 - overdue * 15 - Math.max(0, incomplete - overdue) * 5)
  const status = overdue > 0 ? 'fail' : incomplete > 3 ? 'warning' : 'pass'
  const parts: string[] = []
  if (overdue > 0) parts.push(`${overdue} overdue`)
  if (incomplete > overdue) parts.push(`${incomplete - overdue} pending`)

  return { name, score, status, detail: parts.join(', ') + ' training assignment' + (incomplete === 1 ? '' : 's') + '.' }
}

// ---------------------------------------------------------------------------
// Dimension 8 — Binder Readiness
// Uses latest study_data_readiness_reviews record (migration 0173).
// ---------------------------------------------------------------------------

async function computeBinderReadiness(
  supabase: SupabaseClient,
  organizationId: string,
  studyId: string,
): Promise<ReadinessDimension> {
  const name = 'Binder Readiness'

  const { data, error } = await supabase
    .from('study_data_readiness_reviews')
    .select('status, created_at')
    .eq('organization_id', organizationId)
    .eq('study_id', studyId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    return { name, score: 100, status: 'pass', detail: 'Binder readiness data unavailable.' }
  }

  if (!data) {
    return { name, score: 100, status: 'pass', detail: 'No binder readiness review on file.' }
  }

  const reviewStatus = String(data.status)
  const reviewedAt = new Date(String(data.created_at)).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  })

  if (reviewStatus === 'blocked') {
    return { name, score: 0, status: 'fail', detail: `Binder blocked as of ${reviewedAt}.` }
  }
  if (reviewStatus === 'ready_with_warnings') {
    return { name, score: 70, status: 'warning', detail: `Ready with warnings as of ${reviewedAt}.` }
  }
  return { name, score: 100, status: 'pass', detail: `Ready as of ${reviewedAt}.` }
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

export async function computeInspectionReadinessScore(args: {
  supabase: SupabaseClient
  organizationId: string
  studyId: string
}): Promise<InspectionReadinessScore> {
  const { supabase, organizationId, studyId } = args

  const [
    sourceCompleteness,
    openFindings,
    protocolDeviations,
    capaStatus,
    safetyEvents,
    signatureCompleteness,
    trainingCompliance,
    binderReadiness,
  ] = await Promise.all([
    computeSourceCompleteness(supabase, organizationId, studyId),
    computeOpenFindings(supabase, organizationId, studyId),
    computeProtocolDeviations(supabase, organizationId, studyId),
    computeCapaStatus(supabase, organizationId, studyId),
    computeSafetyEvents(supabase, organizationId, studyId),
    computeSignatureCompleteness(supabase, organizationId, studyId),
    computeTrainingCompliance(supabase, organizationId, studyId),
    computeBinderReadiness(supabase, organizationId, studyId),
  ])

  const dimensions: ReadinessDimension[] = [
    sourceCompleteness,
    openFindings,
    protocolDeviations,
    capaStatus,
    safetyEvents,
    signatureCompleteness,
    trainingCompliance,
    binderReadiness,
  ]

  const overallScore = Math.round(
    dimensions.reduce((sum, d) => sum + d.score, 0) / dimensions.length,
  )

  const failCount = dimensions.filter((d) => d.status === 'fail').length

  let riskLevel: InspectionReadinessScore['riskLevel']
  if (overallScore >= 85 && failCount === 0) {
    riskLevel = 'inspection-ready'
  } else if (overallScore >= 60 && failCount <= 1) {
    riskLevel = 'needs-attention'
  } else {
    riskLevel = 'not-ready'
  }

  return {
    studyId,
    overallScore,
    riskLevel,
    dimensions,
    generatedAt: new Date().toISOString(),
  }
}
