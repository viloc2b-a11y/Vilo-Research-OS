/**
 * Canonical ops route helpers. No route migrations — stable deep links only.
 */

export function studiesIndexPath() {
  return '/studies'
}

export function studyDetailPath(studyId: string, tab?: string) {
  const base = `/studies/${studyId}`
  return tab ? `${base}?tab=${tab}` : base
}

export function studyWorkspacePath(studyId: string) {
  return `/studies/${studyId}/workspace`
}

export function subjectWorkspacePath(subjectId: string) {
  return `/subjects/${subjectId}/workspace`
}

export function commandCenterPath() {
  return '/command-center'
}

export function operationalCalendarPath(year?: number) {
  const base = '/operational-calendar'
  return year ? `${base}?year=${year}` : base
}

export function subjectChartPath(studyId: string | null, subjectId: string) {
  return studyId ? `/studies/${studyId}/subjects/${subjectId}` : `/subjects/${subjectId}`
}

export type SubjectChartTabOptions = {
  /** Safe internal path (e.g. /visits/{id}) for return navigation from subject tabs. */
  returnTo?: string
}

function appendReturnTo(path: string, options?: SubjectChartTabOptions): string {
  const returnTo = options?.returnTo?.trim()
  if (!returnTo || !returnTo.startsWith('/')) return path
  const sep = path.includes('?') ? '&' : '?'
  return `${path}${sep}returnTo=${encodeURIComponent(returnTo)}`
}

export function subjectChartTabPath(
  studyId: string | null,
  subjectId: string,
  tab: string,
  options?: SubjectChartTabOptions,
) {
  let base: string
  if (studyId && tab === 'visits') {
    base = subjectVisitsPath(studyId, subjectId)
  } else {
    base = `${subjectChartPath(studyId, subjectId)}?tab=${tab}`
  }
  return appendReturnTo(base, options)
}

/** Canonical Clinical Profile (inline tab, not standalone route). */
export function subjectClinicalProfilePath(studyId: string | null, subjectId: string) {
  return subjectChartTabPath(studyId, subjectId, 'clinical-profile')
}

/** Dedicated subject-level ConMeds tab (reuses clinical profile read model). */
export function subjectConMedsTabPath(
  studyId: string | null,
  subjectId: string,
  options?: SubjectChartTabOptions,
) {
  return subjectChartTabPath(studyId, subjectId, 'conmeds', options)
}

/** Subject-level AE / safety tab (registry + operational timeline). */
export function subjectAdverseEventsTabPath(
  studyId: string | null,
  subjectId: string,
  options?: SubjectChartTabOptions,
) {
  return subjectChartTabPath(studyId, subjectId, 'adverse-events', options)
}

/** @deprecated Use subjectAdverseEventsTabPath — kept for existing deep links. */
export function subjectAeTabPath(studyId: string | null, subjectId: string) {
  return subjectAdverseEventsTabPath(studyId, subjectId)
}

/** Subject-level regulatory / deviation signals tab (operational overlay, not formal deviations). */
export function subjectDeviationsTabPath(studyId: string | null, subjectId: string) {
  return subjectChartTabPath(studyId, subjectId, 'deviations')
}

/** Organization team / user management (owner and admin). */
export function adminUsersPath(organizationId?: string) {
  const base = '/admin/users'
  return organizationId ? `${base}?organization_id=${organizationId}` : base
}

/** Legacy standalone route — kept for redirects and revalidation only. */
export function legacySubjectClinicalProfilePath(subjectId: string) {
  return `/subjects/${subjectId}/clinical-profile`
}

export function subjectVisitsPath(studyId: string, subjectId: string) {
  return `/studies/${studyId}/subjects/${subjectId}/visits`
}

export function visitDetailPath(visitId: string, tab?: string) {
  const base = `/visits/${visitId}`
  return tab ? `${base}?tab=${tab}` : base
}

export function visitDocumentsPath(studyId: string, subjectId: string, visitId: string) {
  return `/studies/${studyId}/subjects/${subjectId}/visits/${visitId}/documents`
}

export function sourceCapturePath(procedureExecutionId: string, organizationId?: string) {
  const base = `/source/capture/${procedureExecutionId}`
  if (!organizationId) return base
  return `${base}?organization_id=${organizationId}`
}

export function sourceResponseSetPath(
  responseSetId: string,
  query?: { organization_id?: string; active_only?: string; status?: string; severity?: string },
) {
  const base = `/source/response-set/${responseSetId}`
  if (!query) return base
  const params = new URLSearchParams()
  if (query.organization_id) params.set('organization_id', query.organization_id)
  if (query.active_only) params.set('active_only', query.active_only)
  if (query.status) params.set('status', query.status)
  if (query.severity) params.set('severity', query.severity)
  const qs = params.toString()
  return qs ? `${base}?${qs}` : base
}

export function performanceIndexPath() {
  return '/performance'
}

export function performanceTodayPath() {
  return '/performance/today'
}

export function performanceRisksPath() {
  return '/performance/risks'
}

/** Performance / command center deep links to subject workspace. */
export function performanceSubjectPath(studyId: string, subjectId: string) {
  return subjectChartPath(studyId, subjectId)
}

export function performanceSubjectVisitsPath(studyId: string, subjectId: string) {
  return subjectVisitsPath(studyId, subjectId)
}

export function performanceVisitPath(visitId: string) {
  return visitDetailPath(visitId)
}

/** Paths to revalidate after clinical profile mutations. */
export function subjectChartRevalidatePaths(
  subjectId: string,
  studyId: string | null,
): string[] {
  const paths = [
    `/subjects/${subjectId}`,
    legacySubjectClinicalProfilePath(subjectId),
  ]
  if (studyId) {
    paths.push(subjectChartPath(studyId, subjectId))
  }
  return paths
}
