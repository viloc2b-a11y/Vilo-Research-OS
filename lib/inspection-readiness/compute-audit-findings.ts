import type { SupabaseClient } from '@supabase/supabase-js'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type AuditFindingSeverity = 'critical' | 'warning' | 'info'

export type AuditFinding = {
  id: string
  severity: AuditFindingSeverity
  category: string
  title: string
  detail: string
  href: string | null
}

export type AuditSimulationResult = {
  studyId: string
  findings: AuditFinding[]
  criticalCount: number
  warningCount: number
  generatedAt: string
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function severityOrder(s: AuditFindingSeverity): number {
  if (s === 'critical') return 0
  if (s === 'warning') return 1
  return 2
}

function sortFindings(findings: AuditFinding[]): AuditFinding[] {
  return findings.slice().sort((a, b) => {
    const sevDiff = severityOrder(a.severity) - severityOrder(b.severity)
    if (sevDiff !== 0) return sevDiff
    return a.category.localeCompare(b.category)
  })
}

function truncate(text: string, max: number): string {
  return text.length > max ? text.slice(0, max) + '…' : text
}

// ---------------------------------------------------------------------------
// Finding generators
// ---------------------------------------------------------------------------

async function findingsProtocolDeviations(
  supabase: SupabaseClient,
  organizationId: string,
  studyId: string,
): Promise<AuditFinding[]> {
  const findings: AuditFinding[] = []

  try {
    // Critical open deviations
    const { data: criticalRows, error: critError } = await supabase
      .from('protocol_deviations')
      .select('id, description')
      .eq('organization_id', organizationId)
      .eq('study_id', studyId)
      .eq('status', 'open')
      .eq('severity', 'critical')

    if (!critError && criticalRows) {
      criticalRows.forEach((row, i) => {
        findings.push({
          id: `deviation-critical-${i}`,
          severity: 'critical',
          category: 'Deviation',
          title: 'Open critical protocol deviation',
          detail: row.description ? truncate(String(row.description), 80) : `Deviation ID: ${row.id}`,
          href: `/studies/${studyId}/workspace`,
        })
      })
    }

    // Non-critical open deviations grouped
    const { count: nonCritCount, error: nonCritError } = await supabase
      .from('protocol_deviations')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', organizationId)
      .eq('study_id', studyId)
      .eq('status', 'open')
      .neq('severity', 'critical')

    if (!nonCritError && nonCritCount && nonCritCount > 0) {
      findings.push({
        id: 'deviation-non-critical',
        severity: 'warning',
        category: 'Deviation',
        title: `${nonCritCount} open protocol deviation${nonCritCount === 1 ? '' : 's'} without CAPA`,
        detail: 'Non-critical open deviations pending resolution.',
        href: `/studies/${studyId}/workspace`,
      })
    }
  } catch {
    // skip category on unexpected error
  }

  return findings
}

async function findingsCapa(
  supabase: SupabaseClient,
  organizationId: string,
  studyId: string,
): Promise<AuditFinding[]> {
  const findings: AuditFinding[] = []
  const today = new Date().toISOString()
  const openStatuses = ['open', 'in_progress', 'under_review']

  try {
    // Overdue CAPAs — one finding per CAPA
    const { data: overdueRows, error: overdueError } = await supabase
      .from('capa_actions')
      .select('id, corrective_action, due_date')
      .eq('organization_id', organizationId)
      .eq('study_id', studyId)
      .in('capa_status', openStatuses)
      .not('due_date', 'is', null)
      .lt('due_date', today)

    if (!overdueError && overdueRows) {
      overdueRows.forEach((row, i) => {
        const label = row.corrective_action
          ? truncate(String(row.corrective_action), 60)
          : `CAPA ID: ${row.id}`
        findings.push({
          id: `capa-overdue-${i}`,
          severity: 'critical',
          category: 'CAPA',
          title: `CAPA overdue: ${label}`,
          detail: `Due: ${row.due_date}`,
          href: '/capa',
        })
      })
    }

    // Open (not overdue) CAPAs — grouped
    const { count: pendingCount, error: pendingError } = await supabase
      .from('capa_actions')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', organizationId)
      .eq('study_id', studyId)
      .in('capa_status', openStatuses)
      .or(`due_date.is.null,due_date.gte.${today}`)

    if (!pendingError && pendingCount && pendingCount > 0) {
      findings.push({
        id: 'capa-pending',
        severity: 'warning',
        category: 'CAPA',
        title: `${pendingCount} open CAPA action${pendingCount === 1 ? '' : 's'} pending closure`,
        detail: 'Open CAPA actions that are not yet overdue.',
        href: '/capa',
      })
    }
  } catch {
    // skip category on unexpected error
  }

  return findings
}

async function findingsSafety(
  supabase: SupabaseClient,
  organizationId: string,
  studyId: string,
): Promise<AuditFinding[]> {
  const findings: AuditFinding[] = []
  const today = new Date()
  const todayIso = today.toISOString()
  const in3Days = new Date(today.getTime() + 3 * 24 * 60 * 60 * 1000).toISOString()

  try {
    // SAEs with overdue reporting
    const { data: overdueRows, error: overdueError } = await supabase
      .from('safety_events')
      .select('id, reporting_deadline_date')
      .eq('organization_id', organizationId)
      .eq('study_id', studyId)
      .eq('event_type', 'sae')
      .in('event_status', ['open', 'under_review'])
      .not('reporting_deadline_date', 'is', null)
      .lt('reporting_deadline_date', todayIso)

    if (!overdueError && overdueRows) {
      overdueRows.forEach((row, i) => {
        findings.push({
          id: `sae-overdue-${i}`,
          severity: 'critical',
          category: 'Safety',
          title: 'SAE reporting deadline overdue',
          detail: `Reporting deadline was ${row.reporting_deadline_date}.`,
          href: '/safety',
        })
      })
    }

    // SAEs due within 3 days
    const { data: soonRows, error: soonError } = await supabase
      .from('safety_events')
      .select('id, reporting_deadline_date')
      .eq('organization_id', organizationId)
      .eq('study_id', studyId)
      .eq('event_type', 'sae')
      .in('event_status', ['open', 'under_review'])
      .not('reporting_deadline_date', 'is', null)
      .gte('reporting_deadline_date', todayIso)
      .lte('reporting_deadline_date', in3Days)

    if (!soonError && soonRows) {
      soonRows.forEach((row, i) => {
        const deadline = new Date(String(row.reporting_deadline_date))
        const diffMs = deadline.getTime() - today.getTime()
        const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24))
        findings.push({
          id: `sae-soon-${i}`,
          severity: 'warning',
          category: 'Safety',
          title: `SAE reporting due in ${diffDays}d`,
          detail: `Reporting deadline: ${row.reporting_deadline_date}`,
          href: '/safety',
        })
      })
    }
  } catch {
    // skip category on unexpected error
  }

  return findings
}

async function findingsSourceCompleteness(
  supabase: SupabaseClient,
  organizationId: string,
  studyId: string,
): Promise<AuditFinding[]> {
  const findings: AuditFinding[] = []

  try {
    const { count: totalCount, error: totalError } = await supabase
      .from('procedure_executions')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', organizationId)
      .eq('study_id', studyId)
      .eq('execution_status', 'completed')

    if (totalError || !totalCount) return findings

    const { count: submittedCount, error: submittedError } = await supabase
      .from('source_response_sets')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', organizationId)
      .eq('study_id', studyId)
      .in('status', ['submitted', 'signed', 'locked', 'reviewed', 'corrected', 'addended'])

    if (submittedError) return findings

    const submitted = submittedCount ?? 0
    const pct = Math.round((submitted / totalCount) * 100)
    const missing = totalCount - submitted

    if (pct < 70) {
      findings.push({
        id: 'source-completeness-critical',
        severity: 'critical',
        category: 'Source',
        title: `Only ${pct}% of completed procedures have submitted source (${missing} missing)`,
        detail: `${submitted} of ${totalCount} completed procedures have a submitted source response set.`,
        href: '/source',
      })
    } else if (pct < 90) {
      findings.push({
        id: 'source-completeness-warning',
        severity: 'warning',
        category: 'Source',
        title: `Source completeness at ${pct}%`,
        detail: `${submitted} of ${totalCount} completed procedures have a submitted source response set.`,
        href: '/source',
      })
    }
  } catch {
    // skip category on unexpected error
  }

  return findings
}

async function findingsOpenFindings(
  supabase: SupabaseClient,
  organizationId: string,
  studyId: string,
): Promise<AuditFinding[]> {
  const findings: AuditFinding[] = []

  try {
    const { data: responseSets, error: rsError } = await supabase
      .from('source_response_sets')
      .select('id')
      .eq('organization_id', organizationId)
      .eq('study_id', studyId)

    if (rsError || !responseSets || responseSets.length === 0) return findings

    const responseSetIds = responseSets.map((rs) => String(rs.id))

    const { count: openCount, error } = await supabase
      .from('source_response_validation_findings')
      .select('id', { count: 'exact', head: true })
      .in('response_set_id', responseSetIds)
      .eq('status', 'open')

    if (error) return findings

    const count = openCount ?? 0

    if (count > 10) {
      findings.push({
        id: 'source-findings-critical',
        severity: 'critical',
        category: 'Source',
        title: `${count} open findings requiring resolution`,
        detail: 'High number of open source data queries — exceeds acceptable threshold.',
        href: '/source',
      })
    } else if (count > 0) {
      findings.push({
        id: 'source-findings-warning',
        severity: 'warning',
        category: 'Source',
        title: `${count} open quer${count === 1 ? 'y' : 'ies'} outstanding`,
        detail: 'Open source data queries pending resolution.',
        href: '/source',
      })
    }
  } catch {
    // skip category on unexpected error
  }

  return findings
}

async function findingsIrb(
  supabase: SupabaseClient,
  organizationId: string,
  studyId: string,
): Promise<AuditFinding[]> {
  const findings: AuditFinding[] = []
  const today = new Date()
  const todayIso = today.toISOString()
  const in30Days = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString()

  try {
    // Expired IRB approvals
    const { data: expiredRows, error: expiredError } = await supabase
      .from('irb_approvals')
      .select('id, expiration_date')
      .eq('organization_id', organizationId)
      .eq('study_id', studyId)
      .eq('status', 'active')
      .not('expiration_date', 'is', null)
      .lt('expiration_date', todayIso)

    if (!expiredError && expiredRows) {
      expiredRows.forEach((row, i) => {
        findings.push({
          id: `irb-expired-${i}`,
          severity: 'critical',
          category: 'Regulatory',
          title: 'IRB approval expired',
          detail: `Expiration date: ${row.expiration_date}`,
          href: '/regulatory-intelligence/irb',
        })
      })
    }

    // IRB approvals expiring within 30 days
    const { data: soonRows, error: soonError } = await supabase
      .from('irb_approvals')
      .select('id, expiration_date')
      .eq('organization_id', organizationId)
      .eq('study_id', studyId)
      .eq('status', 'active')
      .not('expiration_date', 'is', null)
      .gte('expiration_date', todayIso)
      .lte('expiration_date', in30Days)

    if (!soonError && soonRows) {
      soonRows.forEach((row, i) => {
        const expDate = new Date(String(row.expiration_date))
        const diffMs = expDate.getTime() - today.getTime()
        const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24))
        findings.push({
          id: `irb-expiring-${i}`,
          severity: 'warning',
          category: 'Regulatory',
          title: `IRB approval expires in ${diffDays}d`,
          detail: `Expiration date: ${row.expiration_date}`,
          href: '/regulatory-intelligence/irb',
        })
      })
    }
  } catch {
    // skip category on unexpected error
  }

  return findings
}

async function findingsCredentials(
  supabase: SupabaseClient,
  organizationId: string,
): Promise<AuditFinding[]> {
  const findings: AuditFinding[] = []

  try {
    // Expired credentials grouped by type
    const { data: expiredRows, error: expiredError } = await supabase
      .from('investigator_credentials')
      .select('id, credential_type')
      .eq('organization_id', organizationId)
      .eq('status', 'expired')

    if (!expiredError && expiredRows && expiredRows.length > 0) {
      // Group by credential type
      const byType = new Map<string, number>()
      for (const row of expiredRows) {
        const type = row.credential_type ? String(row.credential_type) : 'Unknown'
        byType.set(type, (byType.get(type) ?? 0) + 1)
      }
      let idx = 0
      for (const [credType, count] of byType) {
        findings.push({
          id: `credentials-expired-${idx++}`,
          severity: 'critical',
          category: 'Regulatory',
          title: `${credType} expired credentials (${count} staff)`,
          detail: `${count} expired ${credType} credential${count === 1 ? '' : 's'} on file.`,
          href: '/regulatory-intelligence/credentials',
        })
      }
    }

    // Expiring soon
    const { count: expiringSoonCount, error: soonError } = await supabase
      .from('investigator_credentials')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', organizationId)
      .eq('status', 'expiring_soon')

    if (!soonError && expiringSoonCount && expiringSoonCount > 0) {
      findings.push({
        id: 'credentials-expiring-soon',
        severity: 'warning',
        category: 'Regulatory',
        title: `${expiringSoonCount} credential${expiringSoonCount === 1 ? '' : 's'} expiring within 30 days`,
        detail: 'Staff credentials approaching expiration.',
        href: '/regulatory-intelligence/credentials',
      })
    }
  } catch {
    // skip category on unexpected error
  }

  return findings
}

async function findingsConsent(
  supabase: SupabaseClient,
  organizationId: string,
  studyId: string,
): Promise<AuditFinding[]> {
  const findings: AuditFinding[] = []

  try {
    // Overdue reconsent
    const { count: overdueCount, error: overdueError } = await supabase
      .from('subject_consent_reconsent_requirements')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', organizationId)
      .eq('study_id', studyId)
      .eq('reconsent_status', 'overdue')

    if (!overdueError && overdueCount && overdueCount > 0) {
      findings.push({
        id: 'consent-overdue',
        severity: 'critical',
        category: 'Consent',
        title: `${overdueCount} subject${overdueCount === 1 ? '' : 's'} with overdue reconsent`,
        detail: 'Subjects who have not completed required reconsent by the deadline.',
        href: `/studies/${studyId}/consent`,
      })
    }

    // Pending reconsent
    const { count: pendingCount, error: pendingError } = await supabase
      .from('subject_consent_reconsent_requirements')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', organizationId)
      .eq('study_id', studyId)
      .eq('reconsent_status', 'pending')

    if (!pendingError && pendingCount && pendingCount > 0) {
      findings.push({
        id: 'consent-pending',
        severity: 'warning',
        category: 'Consent',
        title: `${pendingCount} subject${pendingCount === 1 ? '' : 's'} with pending reconsent`,
        detail: 'Subjects with reconsent required but not yet completed.',
        href: `/studies/${studyId}/consent`,
      })
    }
  } catch {
    // skip category on unexpected error
  }

  return findings
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

export async function computeAuditFindings(args: {
  supabase: SupabaseClient
  organizationId: string
  studyId: string
}): Promise<AuditSimulationResult> {
  const { supabase, organizationId, studyId } = args

  const [
    deviationFindings,
    capaFindings,
    safetyFindings,
    sourceCompletenessFindings,
    openFindingsFindings,
    irbFindings,
    credentialFindings,
    consentFindings,
  ] = await Promise.all([
    findingsProtocolDeviations(supabase, organizationId, studyId),
    findingsCapa(supabase, organizationId, studyId),
    findingsSafety(supabase, organizationId, studyId),
    findingsSourceCompleteness(supabase, organizationId, studyId),
    findingsOpenFindings(supabase, organizationId, studyId),
    findingsIrb(supabase, organizationId, studyId),
    findingsCredentials(supabase, organizationId),
    findingsConsent(supabase, organizationId, studyId),
  ])

  const allFindings = sortFindings([
    ...deviationFindings,
    ...capaFindings,
    ...safetyFindings,
    ...sourceCompletenessFindings,
    ...openFindingsFindings,
    ...irbFindings,
    ...credentialFindings,
    ...consentFindings,
  ])

  const criticalCount = allFindings.filter((f) => f.severity === 'critical').length
  const warningCount = allFindings.filter((f) => f.severity === 'warning').length

  return {
    studyId,
    findings: allFindings,
    criticalCount,
    warningCount,
    generatedAt: new Date().toISOString(),
  }
}
