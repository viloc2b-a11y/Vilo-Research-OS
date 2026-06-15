import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  DelegationComplianceAlert,
  DocumentReadiness,
  DocumentReadinessItem,
  DocumentReadinessStatus,
  IRBApprovalRow,
  InvestigatorCredentialRow,
  RegulatoryRisk,
  StudyRegulatorySnapshot,
} from './regulatory-types'
import { loadIRBApprovals } from './load-irb-approvals'
import { loadInvestigatorCredentials } from './load-investigator-credentials'

// ---------------------------------------------------------------------------
// Date helpers
// ---------------------------------------------------------------------------

/** Calendar-day difference from today (UTC) to a date string. Negative = past. */
function daysUntil(dateIso: string, now = new Date()): number {
  const target = new Date(dateIso)
  const todayUtc = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  const targetUtc = Date.UTC(target.getUTCFullYear(), target.getUTCMonth(), target.getUTCDate())
  return Math.floor((targetUtc - todayUtc) / (24 * 60 * 60 * 1000))
}

// ---------------------------------------------------------------------------
// IRB risk
// ---------------------------------------------------------------------------

function computeIRBRisk(
  approvals: IRBApprovalRow[],
  now: Date,
): { irbStatus: RegulatoryRisk; expiringIRBApprovals: IRBApprovalRow[] } {
  const active = approvals.filter((a) => a.status === 'active')

  const expiredActive = active.filter(
    (a) => a.expirationDate && daysUntil(a.expirationDate, now) < 0,
  )

  const expiring = active.filter(
    (a) =>
      a.expirationDate &&
      daysUntil(a.expirationDate, now) >= 0 &&
      daysUntil(a.expirationDate, now) <= 60,
  )

  let irbStatus: RegulatoryRisk = 'ok'
  if (expiredActive.length > 0) {
    irbStatus = 'critical'
  } else if (expiring.length > 0) {
    irbStatus = 'warning'
  }

  return { irbStatus, expiringIRBApprovals: expiring }
}

// ---------------------------------------------------------------------------
// Staff credential risk
// Compute expiring_soon status in memory (30-day window), do NOT mutate DB.
// ---------------------------------------------------------------------------

function resolveCredentialStatus(
  cred: InvestigatorCredentialRow,
  now: Date,
): InvestigatorCredentialRow['status'] {
  if (cred.status === 'waived') return 'waived'
  if (!cred.expirationDate) return cred.status

  const days = daysUntil(cred.expirationDate, now)
  if (days < 0) return 'expired'
  if (days <= 30) return 'expiring_soon'
  return 'current'
}

function computeCredentialRisk(
  credentials: InvestigatorCredentialRow[],
  now: Date,
): {
  staffCredentialRisk: RegulatoryRisk
  expiringCredentials: InvestigatorCredentialRow[]
  expiredCredentials: InvestigatorCredentialRow[]
} {
  const withComputedStatus = credentials.map((c) => ({
    ...c,
    status: resolveCredentialStatus(c, now),
  }))

  const expired = withComputedStatus.filter((c) => c.status === 'expired')
  const expiring = withComputedStatus.filter((c) => c.status === 'expiring_soon')

  let staffCredentialRisk: RegulatoryRisk = 'ok'
  if (expired.length > 0) {
    staffCredentialRisk = 'critical'
  } else if (expiring.length > 0) {
    staffCredentialRisk = 'warning'
  }

  return { staffCredentialRisk, expiringCredentials: expiring, expiredCredentials: expired }
}

// ---------------------------------------------------------------------------
// Consent risk
// Uses subject_consent_reconsent_requirements (from migration 0149).
// ---------------------------------------------------------------------------

async function computeConsentRisk(args: {
  supabase: SupabaseClient
  studyId: string
}): Promise<{ subjectConsentRisk: RegulatoryRisk; subjectsNeedingReconsent: number }> {
  const { supabase, studyId } = args

  const { count, error } = await supabase
    .from('subject_consent_reconsent_requirements')
    .select('*', { count: 'exact', head: true })
    .eq('study_id', studyId)
    .eq('reconsent_required', true)
    .eq('reconsent_status', 'pending')

  // If the table doesn't exist yet or query fails, degrade gracefully
  if (error) {
    return { subjectConsentRisk: 'ok', subjectsNeedingReconsent: 0 }
  }

  const subjectsNeedingReconsent = count ?? 0

  let subjectConsentRisk: RegulatoryRisk = 'ok'
  if (subjectsNeedingReconsent > 0) {
    subjectConsentRisk = 'warning'
  }

  return { subjectConsentRisk, subjectsNeedingReconsent }
}

// ---------------------------------------------------------------------------
// E6 — Document readiness checklist
// ---------------------------------------------------------------------------

const CREDENTIAL_CATEGORY_MAP: Record<
  InvestigatorCredentialRow['credentialType'],
  DocumentReadinessItem['category']
> = {
  cv: 'cv',
  medical_license: 'medical_license',
  gcp_certificate: 'gcp_certificate',
  iata_certificate: 'gcp_certificate',
  protocol_training: 'protocol_training',
  financial_disclosure_1572: 'form_1572',
  fdf: 'form_1572',
  other: 'gcp_certificate',
}

function credentialToReadinessStatus(
  cred: InvestigatorCredentialRow,
  now: Date,
): DocumentReadinessStatus {
  const resolved = resolveCredentialStatus(cred, now)
  if (resolved === 'expired') return 'expired'
  if (resolved === 'expiring_soon') return 'expiring_soon'
  return 'present'
}

function computeDocumentReadiness(
  approvals: IRBApprovalRow[],
  credentials: InvestigatorCredentialRow[],
  now: Date,
): DocumentReadiness {
  const items: DocumentReadinessItem[] = []

  // IRB approval
  const activeApproval = approvals.find((a) => a.status === 'active')
  if (!activeApproval) {
    items.push({ category: 'irb_approval', label: 'IRB Approval', status: 'missing', detail: 'No active IRB approval on file.' })
  } else {
    const days = activeApproval.expirationDate ? daysUntil(activeApproval.expirationDate, now) : null
    const status: DocumentReadinessStatus =
      days === null ? 'present'
      : days < 0 ? 'expired'
      : days <= 60 ? 'expiring_soon'
      : 'present'
    items.push({
      category: 'irb_approval',
      label: 'IRB Approval',
      status,
      detail: days !== null ? `Expires in ${days}d (${activeApproval.expirationDate})` : null,
    })
  }

  // Key credential categories to check
  const categories: DocumentReadinessItem['category'][] = [
    'gcp_certificate',
    'cv',
    'medical_license',
    'protocol_training',
    'form_1572',
  ]

  for (const category of categories) {
    const matching = credentials.filter(
      (c) => CREDENTIAL_CATEGORY_MAP[c.credentialType] === category,
    )
    if (matching.length === 0) {
      items.push({ category, label: category.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase()), status: 'missing', detail: 'Not on file.' })
    } else {
      const worstStatus = matching.reduce<DocumentReadinessStatus>((acc, cred) => {
        const s = credentialToReadinessStatus(cred, now)
        if (s === 'expired') return 'expired'
        if (s === 'expiring_soon' && acc !== 'expired') return 'expiring_soon'
        return acc === 'missing' ? 'present' : acc
      }, 'present')
      items.push({
        category,
        label: category.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase()),
        status: worstStatus,
        detail: null,
      })
    }
  }

  const hasCritical = items.some((i) => i.status === 'missing' || i.status === 'expired')
  const hasGap = items.some((i) => i.status === 'expiring_soon')
  const overallStatus = hasCritical ? 'critical_gaps' : hasGap ? 'gaps' : 'ready'

  return { items, overallStatus }
}

// ---------------------------------------------------------------------------
// E5 — Training risk
// Reads from study_training_assignments (migration 0147 — new runtime).
// ---------------------------------------------------------------------------

const INCOMPLETE_TRAINING_STATUSES = [
  'Assigned',
  'Pending Trainee Signature',
  'Pending Trainer Signature',
  'Pending PI Acknowledgment',
  'Reopened',
]

async function computeTrainingRisk(args: {
  supabase: SupabaseClient
  organizationId: string
  studyId: string
  now: Date
}): Promise<{ trainingRisk: RegulatoryRisk; incompleteTrainingCount: number; overdueTrainingCount: number }> {
  const { supabase, organizationId, studyId, now } = args
  const today = now.toISOString().slice(0, 10)

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
    return { trainingRisk: 'ok', incompleteTrainingCount: 0, overdueTrainingCount: 0 }
  }

  const incompleteTrainingCount = incompleteCount ?? 0
  const overdueTrainingCount = overdueCount ?? 0

  let trainingRisk: RegulatoryRisk = 'ok'
  if (overdueTrainingCount > 0) trainingRisk = 'critical'
  else if (incompleteTrainingCount > 0) trainingRisk = 'warning'

  return { trainingRisk, incompleteTrainingCount, overdueTrainingCount }
}

// ---------------------------------------------------------------------------
// E6 — Binder readiness risk
// Reads latest record from study_data_readiness_reviews (migration 0173).
// ---------------------------------------------------------------------------

async function computeBinderRisk(args: {
  supabase: SupabaseClient
  organizationId: string
  studyId: string
}): Promise<{ binderRisk: RegulatoryRisk; lastBinderReviewStatus: string | null; lastBinderReviewedAt: string | null }> {
  const { supabase, organizationId, studyId } = args

  const { data, error } = await supabase
    .from('study_data_readiness_reviews')
    .select('status, created_at')
    .eq('organization_id', organizationId)
    .eq('study_id', studyId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error || !data) {
    return { binderRisk: 'ok', lastBinderReviewStatus: null, lastBinderReviewedAt: null }
  }

  const lastBinderReviewStatus = String(data.status)
  const lastBinderReviewedAt = String(data.created_at)

  let binderRisk: RegulatoryRisk = 'ok'
  if (lastBinderReviewStatus === 'blocked') binderRisk = 'critical'
  else if (lastBinderReviewStatus === 'ready_with_warnings') binderRisk = 'warning'

  return { binderRisk, lastBinderReviewStatus, lastBinderReviewedAt }
}

// ---------------------------------------------------------------------------
// E4 — Delegation compliance: flag active delegations with expired credentials
// ---------------------------------------------------------------------------

async function computeDelegationCompliance(args: {
  supabase: SupabaseClient
  organizationId: string
  studyId: string
  credentials: InvestigatorCredentialRow[]
  now: Date
}): Promise<DelegationComplianceAlert[]> {
  const { supabase, organizationId, studyId, credentials, now } = args
  const today = now.toISOString().slice(0, 10)

  const { data, error } = await supabase
    .from('study_delegation_log')
    .select('id, staff_user_id, delegation_status, delegation_stop_date')
    .eq('organization_id', organizationId)
    .eq('study_id', studyId)
    .eq('delegation_status', 'Active')
    .or(`is_ongoing.eq.true,delegation_stop_date.gt.${today}`)
    .limit(50)

  if (error || !data?.length) return []

  const activeStaffIds = new Set(data.map((d: Record<string, unknown>) => d.staff_user_id as string))
  const delegationById = new Map(
    data.map((d: Record<string, unknown>) => [d.staff_user_id as string, d]),
  )

  const alerts: DelegationComplianceAlert[] = []

  for (const cred of credentials) {
    if (!activeStaffIds.has(cred.userId)) continue
    const status = resolveCredentialStatus(cred, now)
    if (status !== 'expired' && status !== 'expiring_soon') continue

    const delegation = delegationById.get(cred.userId)
    if (!delegation) continue

    alerts.push({
      staffUserId: cred.userId,
      delegationLogId: delegation.id as string,
      credentialType: cred.credentialType,
      credentialStatus: status,
      detail: cred.expirationDate
        ? `${cred.credentialType} ${status === 'expired' ? 'expired' : 'expiring'} ${cred.expirationDate}`
        : `${cred.credentialType} status: ${status}`,
    })
  }

  return alerts
}

// ---------------------------------------------------------------------------
// Overall risk
// ---------------------------------------------------------------------------

function computeOverallRisk(dimensions: RegulatoryRisk[]): RegulatoryRisk {
  if (dimensions.includes('critical')) return 'critical'
  if (dimensions.includes('warning')) return 'warning'
  return 'ok'
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export async function computeRegulatorySnapshot(args: {
  supabase: SupabaseClient
  organizationId: string
  studyId: string
}): Promise<StudyRegulatorySnapshot> {
  const { supabase, organizationId, studyId } = args
  const now = new Date()

  const [approvals, credentials, consentRisk] = await Promise.all([
    loadIRBApprovals({ supabase, organizationId, studyId }),
    loadInvestigatorCredentials({ supabase, organizationId, studyId }),
    computeConsentRisk({ supabase, studyId }),
  ])

  const activeIRBApprovals = approvals.filter((a) => a.status === 'active')
  const { irbStatus, expiringIRBApprovals } = computeIRBRisk(approvals, now)
  const { staffCredentialRisk, expiringCredentials, expiredCredentials } =
    computeCredentialRisk(credentials, now)
  const { subjectConsentRisk, subjectsNeedingReconsent } = consentRisk

  const [documentReadiness, delegationAlerts, trainingResult, binderResult] = await Promise.all([
    Promise.resolve(computeDocumentReadiness(approvals, credentials, now)),
    computeDelegationCompliance({ supabase, organizationId, studyId, credentials, now }),
    computeTrainingRisk({ supabase, organizationId, studyId, now }),
    computeBinderRisk({ supabase, organizationId, studyId }),
  ])

  const { trainingRisk, incompleteTrainingCount, overdueTrainingCount } = trainingResult
  const { binderRisk, lastBinderReviewStatus, lastBinderReviewedAt } = binderResult

  const delegationRisk: RegulatoryRisk = delegationAlerts.some(
    (a) => a.credentialStatus === 'expired',
  )
    ? 'critical'
    : delegationAlerts.length > 0
      ? 'warning'
      : 'ok'

  const overallRisk = computeOverallRisk([
    irbStatus,
    staffCredentialRisk,
    subjectConsentRisk,
    delegationRisk,
    trainingRisk,
    binderRisk,
  ])

  return {
    studyId,
    irbStatus,
    activeIRBApprovals,
    expiringIRBApprovals,
    staffCredentialRisk,
    expiringCredentials,
    expiredCredentials,
    subjectConsentRisk,
    subjectsNeedingReconsent,
    documentReadiness,
    delegationAlerts,
    trainingRisk,
    incompleteTrainingCount,
    overdueTrainingCount,
    binderRisk,
    lastBinderReviewStatus,
    lastBinderReviewedAt,
    overallRisk,
  }
}
