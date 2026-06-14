import type { SupabaseClient } from '@supabase/supabase-js'
import type {
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

  const overallRisk = computeOverallRisk([irbStatus, staffCredentialRisk, subjectConsentRisk])

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
    overallRisk,
  }
}
