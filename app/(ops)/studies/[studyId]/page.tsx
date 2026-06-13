// app/(ops)/studies/[studyId]/page.tsx
// Phase 7C — Study Workspace
// Full workspace shell with 9 operational tabs.
// Real data from DB for study + subjects; remaining tabs are operational stubs.

import Link from 'next/link'
import { revalidatePath } from 'next/cache'
import { notFound, redirect } from 'next/navigation'
import {
  ChevronLeft,
  CalendarDays,
  Users,
  FileText,
  Shield,
  Layers,
  FlaskConical,
  ClipboardList,
  ChevronRight,
  AlertTriangle,
  Clock,
  Check,
  Timer,
} from 'lucide-react'
import { createServerClient } from '@/lib/supabase/server'
import {
  hasActiveOrganizationMembership,
  requireActiveOrganizationAccess,
} from '@/lib/auth/membership-access'
import { getOrganizationMemberships, getSessionUser } from '@/lib/auth/session'
import { canMutateOrganizationData } from '@/lib/rbac/permissions'
import { publishSourcePackageFromArtifacts } from '@/lib/source-publish/actions'
import { ProtocolSetupPanel } from '@/components/studies/ProtocolSetupPanel'
import { StudyVisitSourceContinuityPanel } from '@/components/coordinator-operations/StudyVisitSourceContinuityPanel'
import { OperationalTableScroll } from '@/components/runtime-ui/OperationalTableScroll'
import { StudyDataReadinessCard } from '@/components/studies/study-data-readiness-card'
import { canExecuteStudyRuntime } from '@/lib/studies/runtime-readiness'
import { loadProtocolSetupModel } from '@/lib/studies/load-protocol-setup'
import { loadLatestStudyDataReadinessReview } from '@/lib/site-intelligence/study-data-readiness-actions'
import { resolveSubjectProtocolFields } from '@/lib/subject/subject-protocol-fields'
import { SubjectProtocolFields } from '@/components/subject/SubjectProtocolFields'
import { loadStudyVisits } from '@/lib/visits/loadStudyVisits'
import type { StudyVisitRow } from '@/lib/visits/loadStudyVisits'
import { loadStudySubjectCommandCenter } from '@/lib/studies/load-study-subject-command-center'
import { StudySubjectCommandCenter } from '@/components/coordinator-operations/StudySubjectCommandCenter'
import type { SupabaseClient } from '@supabase/supabase-js'
import { StudyLabsSearchCenter } from '@/components/longitudinal-labs/study-labs-search-center'
import { NeedsReviewQueue } from '@/components/longitudinal-labs/needs-review-queue'

type StudyWorkspaceProps = {
  params: Promise<{ studyId: string }>
  searchParams: Promise<{
    tab?: string
    binding?: string
    reason?: string
    publish?: string
    publishReason?: string
    subject?: string
    subjectReason?: string
    action?: string
  }>
}

const TABS = [
  { id: 'overview',    label: 'Overview',     icon: Layers },
  { id: 'subjects',    label: 'Subjects',     icon: Users },
  { id: 'visits',      label: 'Visits',       icon: CalendarDays },
  { id: 'regulatory',  label: 'Regulatory',   icon: Shield },
  { id: 'labs',        label: 'Labs',         icon: FlaskConical },
  { id: 'needs-review', label: 'Needs Review', icon: ClipboardList },
  { id: 'documents',   label: 'Documents',    icon: FileText },
] as const

type TabId = typeof TABS[number]['id']

const SUBJECT_ANCHOR_OPTION_LIMIT = 100
const SUBJECT_PREVIEW_LIMIT = 5

type ReadinessSeverity = 'blocker' | 'warning' | 'info'

type ReadinessFinding = {
  id: string
  severity: ReadinessSeverity
  label: string
  detail: string
  nextAction: string
}

type ReadinessContinuityRow = {
  id: string
  visitLabel: string
  procedureLabel: string
  bindingState: string
  executableState: string
  blocker: string
  nextAction: string
  severity: ReadinessSeverity
}

type ExecutionReadinessModel = {
  canExecute: boolean
  checkedAt: string
  packageStatus: string
  packageDetail: string
  packageConsistency: string
  visitDefinitionCount: number | null
  requiredProcedureCount: number | null
  sourceBindingCount: number | null
  findings: ReadinessFinding[]
  continuityRows: ReadinessContinuityRow[]
}

type PublishedSourceOption = {
  id: string
  sourceLabel: string
  sourceVersion: string
  packageContext: string
  studyVersionId: string | null
  studyVersionContext: string
}

type SourceBindingRow = {
  id: string
  visitLabel: string
  procedureLabel: string
  requiredLabel: string
  procedureDefinitionId: string
  procedureStudyVersionId: string | null
  procedureStudyVersionContext: string
  currentSourceDefinitionVersionId: string | null
  bindingState: string
  boundSourceLabel: string
  boundSourceVersion: string
  packageContext: string
  sourceStudyVersionContext: string
  hasStudyVersionMismatch: boolean
}

type SourceBindingModel = {
  rows: SourceBindingRow[]
  publishedSources: PublishedSourceOption[]
  error: string | null
}

type StudyVersionOption = {
  id: string
  label: string
}

type SourcePublishContinuityModel = {
  lifecycleState: string
  validationState: string
  packageReadiness: string
  approvalState: string
  blockers: string[]
  nextAction: string
  latestPackageDetail: string
  publishedSdvCount: number
  studyVersions: StudyVersionOption[]
  error: string | null
}

function one<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null
  return value ?? null
}

function readinessToneClass(severity: ReadinessSeverity) {
  switch (severity) {
    case 'blocker':
      return 'border-red-200 bg-red-50 text-red-900'
    case 'warning':
      return 'border-amber-200 bg-amber-50 text-amber-900'
    default:
      return 'border-border bg-card text-foreground'
  }
}

function countLabel(value: number | null, singular: string, plural: string) {
  if (value === null) return 'Unavailable'
  return `${value} ${value === 1 ? singular : plural}`
}

function textOrDash(value: unknown): string {
  return typeof value === 'string' && value.trim() ? value.trim() : '—'
}

function packageIdFromMeta(meta: unknown): string | null {
  if (!meta || typeof meta !== 'object' || Array.isArray(meta)) return null
  const value = (meta as { package_id?: unknown }).package_id
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function formText(formData: FormData, key: string): string {
  const value = formData.get(key)
  return typeof value === 'string' ? value.trim() : ''
}

function redirectBindingResult(studyId: string, status: 'saved' | 'error', reason?: string): never {
  const params = new URLSearchParams({ tab: 'overview', binding: status })
  if (reason) params.set('reason', reason.slice(0, 240))
  redirect(`/studies/${studyId}?${params.toString()}#source-bindings`)
}

function redirectSubjectCreateResult(studyId: string, reason: string): never {
  const params = new URLSearchParams({
    tab: 'subjects',
    subject: 'error',
    subjectReason: reason.slice(0, 240),
  })
  redirect(`/studies/${studyId}?${params.toString()}#add-subject`)
}

async function saveProcedureSourceBinding(formData: FormData): Promise<void> {
  'use server'

  const studyId = formText(formData, 'studyId')
  const organizationId = formText(formData, 'organizationId')
  const procedureDefinitionId = formText(formData, 'procedureDefinitionId')
  const sourceDefinitionVersionId = formText(formData, 'sourceDefinitionVersionId')

  if (!studyId || !organizationId) {
    redirect('/studies')
  }

  if (!procedureDefinitionId || !sourceDefinitionVersionId) {
    redirectBindingResult(studyId, 'error', 'Choose a procedure and a published source version.')
  }

  const access = await requireActiveOrganizationAccess(organizationId)
  if (!access.ok) {
    redirectBindingResult(studyId, 'error', access.message)
  }

  const supabase = await createServerClient()

  const { data: procedure, error: procedureError } = await supabase
    .from('procedure_definitions')
    .select('id')
    .eq('id', procedureDefinitionId)
    .eq('study_id', studyId)
    .eq('organization_id', organizationId)
    .maybeSingle()

  if (procedureError || !procedure) {
    redirectBindingResult(
      studyId,
      'error',
      procedureError?.message ?? 'Procedure definition is not available for this study.',
    )
  }

  const { data: sourceVersion, error: sourceVersionError } = await supabase
    .from('source_definition_versions')
    .select('id')
    .eq('id', sourceDefinitionVersionId)
    .eq('study_id', studyId)
    .eq('organization_id', organizationId)
    .eq('lifecycle_status', 'published')
    .maybeSingle()

  if (sourceVersionError || !sourceVersion) {
    redirectBindingResult(
      studyId,
      'error',
      sourceVersionError?.message ?? 'Only published source definition versions from this study can be bound.',
    )
  }

  const { error: bindingError } = await supabase
    .from('procedure_source_bindings')
    .upsert(
      {
        organization_id: organizationId,
        study_id: studyId,
        procedure_definition_id: procedureDefinitionId,
        default_source_definition_version_id: sourceDefinitionVersionId,
      },
      { onConflict: 'study_id,procedure_definition_id' },
    )

  if (bindingError) {
    redirectBindingResult(studyId, 'error', bindingError.message)
  }

  revalidatePath(`/studies/${studyId}`)
  revalidatePath(`/studies/${studyId}?tab=overview`)
  redirectBindingResult(studyId, 'saved')
}

async function createStudySubject(formData: FormData): Promise<void> {
  'use server'

  const studyId = formText(formData, 'studyId')
  const organizationId = formText(formData, 'organizationId')
  const subjectIdentifier = formText(formData, 'subjectIdentifier')

  if (!studyId || !organizationId) {
    redirect('/studies')
  }

  if (!subjectIdentifier) {
    redirectSubjectCreateResult(studyId, 'Subject identifier is required.')
  }

  const user = await getSessionUser()
  if (!user) {
    redirectSubjectCreateResult(studyId, 'Sign in required.')
  }

  const memberships = await getOrganizationMemberships(user.id)
  const canAccess = hasActiveOrganizationMembership(memberships, organizationId)
  if (!canAccess) {
    redirectSubjectCreateResult(studyId, 'You are not a member of this organization.')
  }
  if (!canMutateOrganizationData(memberships, organizationId)) {
    redirectSubjectCreateResult(studyId, 'Your role is read-only for this organization.')
  }

  const supabase = await createServerClient()
  const protocolFields = await resolveSubjectProtocolFields(supabase, {
    studyId,
    organizationId,
    subjectRoleRaw: formText(formData, 'subject_role') || null,
    householdIdRaw: formText(formData, 'household_id') || null,
    anchorSubjectIdRaw: formText(formData, 'anchor_subject_id') || null,
    generateHousehold: formData.get('generate_household') === 'on',
  })
  if (!protocolFields.ok) {
    redirectSubjectCreateResult(studyId, protocolFields.message)
  }

  const { data: subject, error } = await supabase
    .from('study_subjects')
    .insert({
      organization_id: organizationId,
      study_id: studyId,
      subject_identifier: subjectIdentifier,
      enrollment_status: 'screening',
      subject_role: protocolFields.subject_role,
      household_id: protocolFields.household_id,
      anchor_subject_id: protocolFields.anchor_subject_id,
    })
    .select('id')
    .single()

  if (error) {
    const isDuplicate =
      error.code === '23505' ||
      error.message.toLowerCase().includes('duplicate key')
    redirectSubjectCreateResult(
      studyId,
      isDuplicate
        ? 'Subject identifier already exists in this study.'
        : 'Subject could not be created. Review study access and try again.',
    )
  }

  revalidatePath(`/studies/${studyId}`)
  redirect(`/studies/${studyId}/subjects/${subject.id}`)
}

// ============================================================================
// Subject row
// ============================================================================

function SubjectRow({ subject, studyId }: {
  subject: { id: string; subject_identifier: string; enrollment_status: string | null }
  studyId: string
}) {
  const status = subject.enrollment_status ?? 'unknown'
  const statusColor: Record<string, string> = {
    screening: 'status-badge-watch',
    screen_failed: 'status-badge-risk',
    enrolled:  'border border-border bg-muted text-muted-foreground',
    randomized: 'border border-border bg-muted text-muted-foreground',
    completed: 'bg-muted text-muted-foreground',
    withdrawn: 'status-badge-risk',
    unknown:   'bg-muted text-muted-foreground',
  }

  return (
    <Link
      href={`/studies/${studyId}/subjects/${subject.id}`}
      className="flex items-center gap-4 px-4 py-3 hover:bg-accent transition-colors border-b border-border/60 last:border-0 group"
    >
      <div className="w-8 h-8 rounded-lg bg-accent/40 flex items-center justify-center text-primary text-xs font-bold flex-shrink-0">
        {subject.subject_identifier?.slice(0, 2).toUpperCase() ?? '—'}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground">
          Subject {subject.subject_identifier}
        </p>
      </div>
      <span className={`status-badge ${statusColor[status] ?? 'bg-muted text-muted-foreground'}`}>
        {status}
      </span>
      <ChevronRight className="w-3.5 h-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
    </Link>
  )
}

function AddSubjectForm({
  studyId,
  organizationId,
  errorReason,
  anchorOptions,
}: {
  studyId: string
  organizationId: string
  errorReason?: string
  anchorOptions: { id: string; label: string }[]
}) {
  return (
    <form id="add-subject" action={createStudySubject} className="rounded-md border border-border p-4 space-y-4">
      <input type="hidden" name="studyId" value={studyId} />
      <input type="hidden" name="organizationId" value={organizationId} />
      <div className="flex flex-wrap items-end gap-3">
        <label className="min-w-[220px] flex-1 space-y-1 text-xs font-medium text-muted-foreground">
          Subject identifier
          <input
            name="subjectIdentifier"
            className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground"
            placeholder="Site subject ID"
            required
          />
        </label>
        <button
          type="submit"
          className="h-9 rounded-md border border-border px-3 text-xs font-medium text-foreground hover:bg-accent"
        >
          Add subject
        </button>
      </div>
      <SubjectProtocolFields anchorOptions={anchorOptions} showGenerateHousehold />
      <p className="text-xs text-muted-foreground">
        New subjects are created in Screening for this study.
      </p>
      {errorReason ? (
        <p className="mt-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-900">
          {errorReason}
        </p>
      ) : null}
    </form>
  )
}

// ============================================================================
// Visit status helpers
// ============================================================================

function visitStatusStyle(status: string) {
  switch (status) {
    case 'in_progress':
    case 'checked_in':  return { dot: 'bg-amber-400',    badge: 'bg-amber-50 text-amber-700 border-amber-100',   label: 'In Progress' }
    case 'completed':   return { dot: 'bg-primary',   badge: 'bg-accent/40 text-primary border-primary/30',   label: 'Completed' }
    case 'locked':      return { dot: 'bg-primary',   badge: 'bg-accent/40 text-primary border-primary/30',   label: 'Locked' }
    case 'missed':      return { dot: 'bg-red-500',     badge: 'bg-red-50 text-red-700 border-red-100',            label: 'Missed' }
    case 'out_of_window': return { dot: 'bg-red-400',  badge: 'bg-red-50 text-red-600 border-red-100',            label: 'Out of Window' }
    default:            return { dot: 'bg-blue-400',    badge: 'bg-blue-50 text-blue-700 border-blue-100',         label: 'Scheduled' }
  }
}

function VisitRow({ visit }: { visit: StudyVisitRow }) {
  const style = visitStatusStyle(visit.visitStatus)
  const hasProcs = visit.totalProcedures > 0
  const allDone  = hasProcs && visit.completedProcedures === visit.totalProcedures

  return (
    <div className="flex items-center gap-4 px-4 py-3 border-b border-border/60 last:border-0 hover:bg-accent transition-colors group">
      {/* Status dot */}
      <div className={`w-2 h-2 rounded-full flex-shrink-0 ${style.dot}`} />

      {/* Subject + visit */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="text-sm font-medium text-foreground">{visit.subjectIdentifier}</span>
          <span className="text-xs text-muted-foreground">·</span>
          <span className="text-sm text-foreground">{visit.visitName}</span>
          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${style.badge}`}>
            {style.label}
          </span>
        </div>
        <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
          {visit.scheduledDate && (
            <span className="flex items-center gap-1">
              <CalendarDays className="w-3 h-3" />
              {visit.scheduledDate}
            </span>
          )}
          {visit.windowStart && visit.windowEnd && (
            <span>Window: {visit.windowStart} – {visit.windowEnd}</span>
          )}
          {hasProcs && (
            <span className={`flex items-center gap-1 ${allDone ? 'text-primary' : 'text-amber-600'}`}>
              {allDone ? <Check className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
              {visit.completedProcedures}/{visit.totalProcedures} procedures
            </span>
          )}
        </div>
      </div>

      {/* CTA */}
      <Link
        href={visit.hrefVisit}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white opacity-0 group-hover:opacity-100 transition-all"
        
      >
        Enter Visit <ChevronRight className="w-3 h-3" />
      </Link>
      <Link href={visit.hrefSubject} className="text-[10px] text-muted-foreground hover:text-primary transition-colors opacity-0 group-hover:opacity-100">
        Subject →
      </Link>
    </div>
  )
}

type VisitsTabResult = Awaited<ReturnType<typeof loadStudyVisits>> | null

function VisitGroup({ title, visits, icon, emptyMsg }: {
  title: string
  visits: StudyVisitRow[]
  icon: React.ReactNode
  emptyMsg?: string
}) {
  if (visits.length === 0 && !emptyMsg) return null
  return (
    <div className="vilo-card overflow-hidden mb-4">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border/60 bg-accent">
        {icon}
        <span className="text-xs font-semibold text-foreground">{title}</span>
        <span className="text-[10px] text-muted-foreground">({visits.length})</span>
      </div>
      {visits.length === 0 ? (
        <div className="px-4 py-4 text-xs text-muted-foreground">{emptyMsg}</div>
      ) : (
        visits.map(v => <VisitRow key={v.visitId} visit={v} />)
      )}
    </div>
  )
}

function VisitsTab({ studyVisits }: { studyVisits: VisitsTabResult }) {
  if (!studyVisits) {
    return (
      <div className="p-6 text-center">
        <p className="text-sm text-muted-foreground">Unable to load visits.</p>
      </div>
    )
  }
  if (studyVisits.error) {
    return (
      <div className="p-6">
        <p className="text-sm text-destructive">{studyVisits.error}</p>
      </div>
    )
  }

  const total = studyVisits.rows.length

  return (
    <div className="p-6 max-w-[1100px]">
      {/* Summary bar */}
      <div className="flex items-center gap-6 mb-5 p-4 vilo-card">
        <div className="text-center">
          <p className="text-lg font-bold text-foreground">{total}</p>
          <p className="text-[10px] text-muted-foreground">Total Visits</p>
        </div>
        {studyVisits.inProgress.length > 0 && <>
          <div className="w-px h-8 bg-border" />
          <div className="text-center">
            <p className="text-lg font-bold text-amber-500">{studyVisits.inProgress.length}</p>
            <p className="text-[10px] text-muted-foreground">In Progress</p>
          </div>
        </>}
        {studyVisits.today.length > 0 && <>
          <div className="w-px h-8 bg-border" />
          <div className="text-center">
            <p className="text-lg font-bold text-blue-500">{studyVisits.today.length}</p>
            <p className="text-[10px] text-muted-foreground">Today</p>
          </div>
        </>}
        {studyVisits.overdue.length > 0 && <>
          <div className="w-px h-8 bg-border" />
          <div className="text-center">
            <p className="text-lg font-bold text-red-500">{studyVisits.overdue.length}</p>
            <p className="text-[10px] text-muted-foreground">Overdue / At Risk</p>
          </div>
        </>}
        <div className="w-px h-8 bg-border" />
        <div className="text-center">
          <p className="text-lg font-bold text-primary">{studyVisits.completed.length}</p>
          <p className="text-[10px] text-muted-foreground">Completed</p>
        </div>
        <div className="w-px h-8 bg-border" />
        <div className="text-center">
          <p className="text-lg font-bold text-muted-foreground">{studyVisits.upcoming.length}</p>
          <p className="text-[10px] text-muted-foreground">Upcoming</p>
        </div>
      </div>

      {total === 0 ? (
        <div className="vilo-card p-12 text-center">
          <CalendarDays className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm font-medium text-foreground mb-1">No visits found</p>
          <p className="text-xs text-muted-foreground">Visit schedules will appear here once generated.</p>
        </div>
      ) : (
        <>
          <VisitGroup
            title="In Progress"
            visits={studyVisits.inProgress}
            icon={<Timer className="w-3.5 h-3.5 text-amber-500" />}
          />
          <VisitGroup
            title="Today"
            visits={studyVisits.today}
            icon={<CalendarDays className="w-3.5 h-3.5 text-blue-500" />}
          />
          <VisitGroup
            title="Overdue / At Risk"
            visits={studyVisits.overdue}
            icon={<AlertTriangle className="w-3.5 h-3.5 text-red-500" />}
          />
          <VisitGroup
            title="Upcoming"
            visits={studyVisits.upcoming}
            icon={<Clock className="w-3.5 h-3.5 text-muted-foreground" />}
            emptyMsg="No upcoming visits scheduled."
          />
          <VisitGroup
            title="Completed"
            visits={studyVisits.completed}
            icon={<Check className="w-3.5 h-3.5 text-primary" />}
          />
        </>
      )}
    </div>
  )
}

// ============================================================================
// Tab content
// ============================================================================

function GuidanceChecklist({
  title,
  description,
  items,
}: {
  title: string
  description: string
  items: string[]
}) {
  return (
    <div className="p-6 max-w-[900px]">
      <div className="vilo-card p-5">
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
        <p className="mt-2 text-sm text-muted-foreground">{description}</p>
        <ul className="mt-4 space-y-2">
          {items.map((item) => (
            <li key={item} className="flex gap-2 text-sm text-muted-foreground">
              <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

async function loadExecutionReadinessModel({
  supabase,
  studyId,
  organizationId,
}: {
  supabase: SupabaseClient
  studyId: string
  organizationId: string
}): Promise<ExecutionReadinessModel> {
  const readiness = await canExecuteStudyRuntime({ supabase, studyId, organizationId })
  const blockerFindings = readiness.blockers.map((blocker, index) => ({
    id: `runtime-blocker-${index}`,
    severity: 'blocker' as const,
    label: 'Runtime execution blocker',
    detail: blocker,
    nextAction: blocker.includes('source binding') || blocker.includes('without source')
      ? 'Use Procedure Source Bindings below to choose a published source definition version.'
      : blocker.includes('source package') || blocker.includes('Package')
        ? 'Resolve source package publish or consistency before enrollment or randomization.'
        : 'Resolve the runtime definition before enrollment or randomization.',
  }))
  const warningFindings = readiness.warnings.map((warning, index) => ({
    id: `runtime-warning-${index}`,
    severity: 'warning' as const,
    label: 'Runtime execution warning',
    detail: warning,
    nextAction: 'Review this warning before execution. It does not block the computed gate.',
  }))

  return {
    canExecute: readiness.canExecute,
    checkedAt: readiness.checkedAt,
    packageStatus: readiness.packageStatus,
    packageDetail: readiness.packageDetail,
    packageConsistency: readiness.packageConsistency,
    visitDefinitionCount: readiness.visitDefinitionCount,
    requiredProcedureCount: readiness.requiredProcedureCount,
    sourceBindingCount: readiness.sourceBindingCount,
    findings: [...blockerFindings, ...warningFindings],
    continuityRows: readiness.continuityRows,
  }
}

async function loadSourceBindingModel({
  supabase,
  studyId,
  organizationId,
}: {
  supabase: SupabaseClient
  studyId: string
  organizationId: string
}): Promise<SourceBindingModel> {
  const [
    procedureMapsResult,
    bindingsResult,
    publishedSourcesResult,
    packagesResult,
  ] = await Promise.all([
    supabase
      .from('visit_def_procedure_map')
      .select(`
        id,
        visit_definition_id,
        procedure_definition_id,
        is_required,
        sort_order,
        visit_definitions(id, code, label, study_version_id),
        procedure_definitions(id, code, label, study_version_id)
      `)
      .eq('study_id', studyId)
      .eq('organization_id', organizationId)
      .order('sort_order', { ascending: true }),
    supabase
      .from('procedure_source_bindings')
      .select(`
        id,
        procedure_definition_id,
        default_source_definition_version_id,
        source_definition_versions(
          id,
          source_definition_id,
          version_label,
          lifecycle_status,
          study_version_id,
          meta,
          source_definitions(code, label)
        )
      `)
      .eq('study_id', studyId)
      .eq('organization_id', organizationId),
    supabase
      .from('source_definition_versions')
      .select(`
        id,
        source_definition_id,
        version_label,
        lifecycle_status,
        study_version_id,
        meta,
        source_definitions(code, label)
      `)
      .eq('study_id', studyId)
      .eq('organization_id', organizationId)
      .eq('lifecycle_status', 'published')
      .order('published_at', { ascending: false })
      .order('created_at', { ascending: false }),
    supabase
      .from('source_publish_packages')
      .select('package_id, study_version_id, validation_status, persisted_at')
      .eq('study_id', studyId)
      .eq('organization_id', organizationId)
      .not('persisted_at', 'is', null)
      .order('persisted_at', { ascending: false }),
  ])

  const errors = [
    procedureMapsResult.error?.message,
    bindingsResult.error?.message,
    publishedSourcesResult.error?.message,
    packagesResult.error?.message,
  ].filter(Boolean)

  if (errors.length > 0) {
    return { rows: [], publishedSources: [], error: errors.join(' ') }
  }

  type VersionIdRow = { study_version_id?: string | null }
  const versionIds = new Set<string>()
  for (const row of (procedureMapsResult.data ?? []) as VersionIdRow[]) {
    const visit = one((row as { visit_definitions?: unknown }).visit_definitions) as VersionIdRow | null
    const procedure = one((row as { procedure_definitions?: unknown }).procedure_definitions) as VersionIdRow | null
    if (visit?.study_version_id) versionIds.add(visit.study_version_id)
    if (procedure?.study_version_id) versionIds.add(procedure.study_version_id)
  }
  for (const row of (publishedSourcesResult.data ?? []) as VersionIdRow[]) {
    if (row.study_version_id) versionIds.add(row.study_version_id)
  }
  for (const row of (packagesResult.data ?? []) as VersionIdRow[]) {
    if (row.study_version_id) versionIds.add(row.study_version_id)
  }

  const versionLabels = new Map<string, string>()
  if (versionIds.size > 0) {
    const { data: versions } = await supabase
      .from('study_versions')
      .select('id, version_label')
      .eq('study_id', studyId)
      .in('id', [...versionIds])

    for (const version of versions ?? []) {
      versionLabels.set(version.id as string, textOrDash(version.version_label))
    }
  }

  const packageById = new Map(
    (packagesResult.data ?? []).map((pkg) => [
      String(pkg.package_id),
      {
        validationStatus: textOrDash(pkg.validation_status),
        persistedAt: textOrDash(pkg.persisted_at),
        studyVersionId: (pkg.study_version_id as string | null) ?? null,
      },
    ]),
  )

  function studyVersionContext(studyVersionId: string | null | undefined) {
    if (!studyVersionId) return 'Study version unavailable'
    return versionLabels.get(studyVersionId) ?? `Study version ${studyVersionId.slice(0, 8)}`
  }

  function sourceLabelFrom(row: {
    source_definitions?: unknown
    source_definition_id?: string | null
  }) {
    const sourceDefinition = one(row.source_definitions) as {
      code?: string | null
      label?: string | null
    } | null
    return sourceDefinition?.label ?? sourceDefinition?.code ?? row.source_definition_id ?? 'Published source'
  }

  function sourcePackageContext(row: {
    meta?: unknown
    study_version_id?: string | null
  }) {
    const packageId = packageIdFromMeta(row.meta)
    if (!packageId) return 'Package context unavailable'
    const pkg = packageById.get(packageId)
    if (!pkg) return `Package ${packageId}`
    const versionContext = studyVersionContext(pkg.studyVersionId ?? row.study_version_id)
    return `Package ${packageId} · ${pkg.validationStatus} · ${versionContext}`
  }

  const publishedSources: PublishedSourceOption[] = ((publishedSourcesResult.data ?? []) as Array<{
    id: string
    version_label?: string | null
    study_version_id?: string | null
    meta?: unknown
    source_definition_id?: string | null
    source_definitions?: unknown
  }>).map((source) => ({
    id: source.id,
    sourceLabel: sourceLabelFrom(source),
    sourceVersion: textOrDash(source.version_label),
    packageContext: sourcePackageContext(source),
    studyVersionId: source.study_version_id ?? null,
    studyVersionContext: studyVersionContext(source.study_version_id),
  }))

  const bindingByProcedure = new Map(
    ((bindingsResult.data ?? []) as Array<{
      procedure_definition_id: string
      default_source_definition_version_id: string
      source_definition_versions?: unknown
    }>).map((binding) => [binding.procedure_definition_id, binding]),
  )

  const rows: SourceBindingRow[] = ((procedureMapsResult.data ?? []) as Array<{
    id: string
    procedure_definition_id: string
    is_required?: boolean | null
    visit_definitions?: unknown
    procedure_definitions?: unknown
  }>).map((row) => {
    const visit = one(row.visit_definitions) as {
      code?: string | null
      label?: string | null
      study_version_id?: string | null
    } | null
    const procedure = one(row.procedure_definitions) as {
      code?: string | null
      label?: string | null
      study_version_id?: string | null
    } | null
    const binding = bindingByProcedure.get(row.procedure_definition_id)
    const boundSource = one(binding?.source_definition_versions) as {
      id?: string | null
      source_definition_id?: string | null
      version_label?: string | null
      lifecycle_status?: string | null
      study_version_id?: string | null
      meta?: unknown
      source_definitions?: unknown
    } | null
    const procedureStudyVersionId = procedure?.study_version_id ?? null
    const sourceStudyVersionId = boundSource?.study_version_id ?? null
    const hasStudyVersionMismatch = Boolean(
      procedureStudyVersionId &&
      sourceStudyVersionId &&
      procedureStudyVersionId !== sourceStudyVersionId,
    )

    return {
      id: row.id,
      visitLabel: visit?.label ?? visit?.code ?? 'Visit definition missing',
      procedureLabel: procedure?.label ?? procedure?.code ?? 'Procedure definition missing',
      requiredLabel: row.is_required ? 'Required' : 'Optional',
      procedureDefinitionId: row.procedure_definition_id,
      procedureStudyVersionId,
      procedureStudyVersionContext: studyVersionContext(procedureStudyVersionId),
      currentSourceDefinitionVersionId: boundSource?.id ?? binding?.default_source_definition_version_id ?? null,
      bindingState: boundSource
        ? boundSource.lifecycle_status === 'published'
          ? 'Bound'
          : `Bound but ${boundSource.lifecycle_status ?? 'not published'}`
        : 'Missing',
      boundSourceLabel: boundSource ? sourceLabelFrom(boundSource) : 'No source bound',
      boundSourceVersion: boundSource ? textOrDash(boundSource.version_label) : '—',
      packageContext: boundSource ? sourcePackageContext(boundSource) : '—',
      sourceStudyVersionContext: boundSource ? studyVersionContext(boundSource.study_version_id) : '—',
      hasStudyVersionMismatch,
    }
  })

  return { rows, publishedSources, error: null }
}

async function loadSourcePublishContinuityModel({
  supabase,
  studyId,
  organizationId,
}: {
  supabase: SupabaseClient
  studyId: string
  organizationId: string
}): Promise<SourcePublishContinuityModel> {
  const [versionsResult, packageResult, sdvCountResult] = await Promise.all([
    supabase
      .from('study_versions')
      .select('id, version_label, created_at')
      .eq('study_id', studyId)
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: false }),
    supabase
      .from('source_publish_packages')
      .select('package_id, validation_status, publish_ready, persisted_at, study_version_id')
      .eq('study_id', studyId)
      .eq('organization_id', organizationId)
      .not('persisted_at', 'is', null)
      .order('persisted_at', { ascending: false })
      .limit(1),
    supabase
      .from('source_definition_versions')
      .select('id', { count: 'exact', head: true })
      .eq('study_id', studyId)
      .eq('organization_id', organizationId)
      .eq('lifecycle_status', 'published'),
  ])

  const errors = [
    versionsResult.error?.message,
    packageResult.error?.message,
    sdvCountResult.error?.message,
  ].filter((message): message is string => Boolean(message))
  if (errors.length > 0) {
    return {
      lifecycleState: 'Unavailable',
      validationState: 'Unavailable',
      packageReadiness: 'Unavailable',
      approvalState: 'Unavailable',
      blockers: errors,
      nextAction: 'Resolve publish visibility errors before attempting publish.',
      latestPackageDetail: 'Package truth unavailable.',
      publishedSdvCount: 0,
      studyVersions: [],
      error: errors.join(' '),
    }
  }

  const studyVersions = (versionsResult.data ?? []).map((version) => ({
    id: version.id as string,
    label: textOrDash(version.version_label),
  }))
  const latestPackage = packageResult.data?.[0] ?? null
  const publishedSdvCount = sdvCountResult.count ?? 0
  const blockers: string[] = []

  if (studyVersions.length === 0) {
    blockers.push('No study version exists for this study.')
  }

  if (latestPackage && publishedSdvCount > 0) {
    return {
      lifecycleState: 'Persisted/published',
      validationState: textOrDash(latestPackage.validation_status),
      packageReadiness: latestPackage.publish_ready ? 'publish_ready=true' : 'publish_ready=false',
      approvalState: 'Approved evidence required by RPC and persisted package exists.',
      blockers,
      nextAction: 'Bind published source definition versions to required procedures below.',
      latestPackageDetail: `Package ${String(latestPackage.package_id)} · persisted ${String(latestPackage.persisted_at)}`,
      publishedSdvCount,
      studyVersions,
      error: null,
    }
  }

  return {
    lifecycleState: 'Draft or publish blocked',
    validationState: 'Not validated in app yet',
    packageReadiness: 'Requires approved publish package JSON',
    approvalState: 'Requires approval JSON with decision=approved and publish_eligible=true',
    blockers,
    nextAction: blockers.length > 0
      ? 'Resolve blockers above before publishing.'
      : 'Paste approved package artifacts and publish. The app will validate and call the existing publish RPC.',
    latestPackageDetail: latestPackage
      ? `Latest persisted package unavailable for binding · package ${String(latestPackage.package_id)}`
      : 'No persisted source package found.',
    publishedSdvCount,
    studyVersions,
    error: null,
  }
}

function ExecutionReadinessSection({ model }: { model: ExecutionReadinessModel }) {
  const blockers = model.findings.filter((finding) => finding.severity === 'blocker')
  const warnings = model.findings.filter((finding) => finding.severity === 'warning')

  return (
    <section id="execution-readiness" className="vilo-card min-w-0 w-full max-w-none">
      <div className="border-b border-border/60 px-5 py-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-foreground">Execution Readiness</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Read-only runtime checks. Administrative study status is separate from execution readiness.
            </p>
          </div>
          <span className="rounded-md border border-border px-2.5 py-1 text-xs text-muted-foreground">
            READY_FOR_EXECUTION: {model.canExecute ? 'Yes' : 'No'} · computed only
          </span>
        </div>
      </div>

      {blockers.length > 0 ? (
        <div className="border-b border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-950">
          <p className="font-medium">Enrollment/randomization warning</p>
          <p className="mt-1 text-xs">
            Runtime is incomplete. Enrollment, randomization, and schedule generation are blocked by the computed execution gate.
          </p>
        </div>
      ) : null}

      <div className="grid gap-3 border-b border-border/60 p-5 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-md border border-border p-3">
          <p className="text-xs font-medium text-muted-foreground">Publish truth</p>
          <p className="mt-1 text-sm font-semibold text-foreground">{model.packageStatus}</p>
          <p className="mt-1 text-xs text-muted-foreground">{model.packageDetail}</p>
        </div>
        <div className="rounded-md border border-border p-3">
          <p className="text-xs font-medium text-muted-foreground">Package consistency</p>
          <p className="mt-1 text-sm font-semibold text-foreground">{model.packageConsistency}</p>
          <p className="mt-1 text-xs text-muted-foreground">Phase 4C consistency helper result.</p>
        </div>
        <div className="rounded-md border border-border p-3">
          <p className="text-xs font-medium text-muted-foreground">Runtime definitions</p>
          <p className="mt-1 text-sm font-semibold text-foreground">
            {countLabel(model.visitDefinitionCount, 'visit', 'visits')}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {countLabel(model.requiredProcedureCount, 'required procedure', 'required procedures')}
          </p>
        </div>
        <div className="rounded-md border border-border p-3">
          <p className="text-xs font-medium text-muted-foreground">Source bindings</p>
          <p className="mt-1 text-sm font-semibold text-foreground">
            {countLabel(model.sourceBindingCount, 'binding', 'bindings')}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">Procedure source bindings in this study.</p>
        </div>
      </div>

      <div className="flex flex-col gap-5 p-5 xl:flex-row xl:items-start">
        <div className="min-w-0 space-y-3 xl:w-[min(360px,100%)] xl:shrink-0">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Blockers and Warnings</h3>
          {model.findings.length === 0 ? (
            <div className="rounded-md border border-border p-3 text-sm text-muted-foreground">
              No blockers detected by current read-only checks. This is not a readiness flag.
              Checked {model.checkedAt}.
            </div>
          ) : (
            <div className="space-y-2">
              {[...blockers, ...warnings].map((finding) => (
                <div key={finding.id} className={`rounded-md border p-3 text-sm ${readinessToneClass(finding.severity)}`}>
                  <p className="font-medium">{finding.label}</p>
                  <p className="mt-1 text-xs opacity-90">{finding.detail}</p>
                  <p className="mt-2 text-xs font-medium">Next action: {finding.nextAction}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="min-w-0 w-full max-w-none flex-1">
          <StudyVisitSourceContinuityPanel rows={model.continuityRows} embedded />
        </div>
      </div>
    </section>
  )
}

function SourceBindingSection({
  model,
  studyId,
  organizationId,
  bindingStatus,
  bindingReason,
}: {
  model: SourceBindingModel
  studyId: string
  organizationId: string
  bindingStatus?: string
  bindingReason?: string
}) {
  const hasPublishedSources = model.publishedSources.length > 0

  return (
    <section id="source-bindings" className="vilo-card min-w-0 w-full max-w-none">
      <div className="border-b border-border/60 px-5 py-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-foreground">Procedure Source Bindings</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Explicitly bind each procedure to one published source definition version. No automatic matching is performed.
            </p>
          </div>
          <span className="rounded-md border border-border px-2.5 py-1 text-xs text-muted-foreground">
            One active binding per procedure
          </span>
        </div>
        {bindingStatus === 'saved' ? (
          <p className="mt-3 rounded-md border border-primary/30 bg-accent/50 px-3 py-2 text-xs text-primary">
            Source binding saved. Execution readiness has been refreshed.
          </p>
        ) : null}
        {bindingStatus === 'error' ? (
          <p className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-900">
            Binding was not saved: {bindingReason || 'Review the selected procedure and published source version.'}
          </p>
        ) : null}
      </div>

      {model.error ? (
        <div className="p-5 text-sm text-destructive">{model.error}</div>
      ) : !hasPublishedSources ? (
        <div className="border-b border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-950">
          <p className="font-medium">No published source definitions available</p>
          <p className="mt-1 text-xs">
            Publish an approved source package before binding procedures to executable source.
          </p>
        </div>
      ) : (
        <div className="border-b border-amber-200 bg-amber-50 px-5 py-3 text-xs text-amber-950">
          Published source options marked “study-version differs” can be selected, but the mismatch is visible before saving.
        </div>
      )}

      <OperationalTableScroll id="procedure-source-bindings-scroll" minTableWidth={1120}>
        <table className="w-full min-w-[1120px] text-left text-sm">
          <thead className="bg-muted/40 text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-medium">Visit</th>
              <th className="px-3 py-2 font-medium">Procedure</th>
              <th className="px-3 py-2 font-medium">Required?</th>
              <th className="px-3 py-2 font-medium">Current Binding</th>
              <th className="px-3 py-2 font-medium">Bound Source</th>
              <th className="px-3 py-2 font-medium">Source Version</th>
              <th className="px-3 py-2 font-medium">Package / Version Context</th>
              <th className="px-3 py-2 font-medium">Study-Version Context</th>
              <th className="px-3 py-2 font-medium">Bind / Retarget</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {model.rows.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-3 py-4 text-sm text-muted-foreground">
                  No visit-to-procedure rows are available for binding.
                </td>
              </tr>
            ) : (
              model.rows.map((row) => (
                <tr key={row.id} className={row.bindingState === 'Missing' ? 'bg-red-50/70' : undefined}>
                  <td className="px-3 py-3 font-medium text-foreground">{row.visitLabel}</td>
                  <td className="px-3 py-3 text-foreground">{row.procedureLabel}</td>
                  <td className="px-3 py-3 text-muted-foreground">{row.requiredLabel}</td>
                  <td className="px-3 py-3 text-muted-foreground">{row.bindingState}</td>
                  <td className="px-3 py-3 text-muted-foreground">{row.boundSourceLabel}</td>
                  <td className="px-3 py-3 text-muted-foreground">{row.boundSourceVersion}</td>
                  <td className="px-3 py-3 text-muted-foreground">{row.packageContext}</td>
                  <td className="px-3 py-3 text-muted-foreground">
                    <div>{row.procedureStudyVersionContext}</div>
                    <div>{row.sourceStudyVersionContext}</div>
                    {row.hasStudyVersionMismatch ? (
                      <div className="mt-1 font-medium text-amber-700">Current binding study-version differs</div>
                    ) : null}
                  </td>
                  <td className="px-3 py-3">
                    <form action={saveProcedureSourceBinding} className="flex min-w-[260px] items-center gap-2">
                      <input type="hidden" name="studyId" value={studyId} />
                      <input type="hidden" name="organizationId" value={organizationId} />
                      <input type="hidden" name="procedureDefinitionId" value={row.procedureDefinitionId} />
                      <select
                        name="sourceDefinitionVersionId"
                        defaultValue={row.currentSourceDefinitionVersionId ?? ''}
                        disabled={!hasPublishedSources}
                        className="h-9 min-w-[190px] rounded-md border border-input bg-background px-2 text-xs"
                        aria-label={`Published source version for ${row.procedureLabel}`}
                        required
                      >
                        <option value="" disabled>
                          Select published source
                        </option>
                        {model.publishedSources.map((source) => {
                          const versionMismatch = Boolean(
                            row.procedureStudyVersionId &&
                            source.studyVersionId &&
                            row.procedureStudyVersionId !== source.studyVersionId,
                          )
                          return (
                            <option key={source.id} value={source.id}>
                              {source.sourceLabel} · {source.sourceVersion} · {source.packageContext}
                              {versionMismatch ? ' · study-version differs' : ''}
                            </option>
                          )
                        })}
                      </select>
                      <button
                        type="submit"
                        disabled={!hasPublishedSources}
                        className="h-9 rounded-md border border-border px-3 text-xs font-medium text-foreground hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {row.currentSourceDefinitionVersionId ? 'Retarget' : 'Bind'}
                      </button>
                    </form>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </OperationalTableScroll>
    </section>
  )
}

function SourcePublishContinuitySection({
  model,
  studyId,
  organizationId,
  publishStatus,
  publishReason,
}: {
  model: SourcePublishContinuityModel
  studyId: string
  organizationId: string
  publishStatus?: string
  publishReason?: string
}) {
  const canAttemptPublish = model.studyVersions.length > 0

  return (
    <section id="source-publish" className="vilo-card min-w-0 w-full max-w-none">
      <div className="border-b border-border/60 px-5 py-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-foreground">Source Publish Continuity</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Persist approved source package artifacts through the existing publish_source_package RPC. No auto-binding is performed.
            </p>
          </div>
          <span className="rounded-md border border-border px-2.5 py-1 text-xs text-muted-foreground">
            Real persistence required
          </span>
        </div>
        {publishStatus === 'saved' ? (
          <p className="mt-3 rounded-md border border-primary/30 bg-accent/50 px-3 py-2 text-xs text-primary">
            Publish completed: {publishReason || 'package persisted and published source versions are available.'}
          </p>
        ) : null}
        {publishStatus === 'error' ? (
          <p className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-900">
            Publish blocked: {publishReason || 'review validation and package blockers.'}
          </p>
        ) : null}
      </div>

      <div className="grid gap-3 border-b border-border/60 p-5 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-md border border-border p-3">
          <p className="text-xs font-medium text-muted-foreground">Lifecycle</p>
          <p className="mt-1 text-sm font-semibold text-foreground">{model.lifecycleState}</p>
          <p className="mt-1 text-xs text-muted-foreground">{model.latestPackageDetail}</p>
        </div>
        <div className="rounded-md border border-border p-3">
          <p className="text-xs font-medium text-muted-foreground">Validation State</p>
          <p className="mt-1 text-sm font-semibold text-foreground">{model.validationState}</p>
          <p className="mt-1 text-xs text-muted-foreground">RPC accepts valid or warning only.</p>
        </div>
        <div className="rounded-md border border-border p-3">
          <p className="text-xs font-medium text-muted-foreground">Package Readiness</p>
          <p className="mt-1 text-sm font-semibold text-foreground">{model.packageReadiness}</p>
          <p className="mt-1 text-xs text-muted-foreground">{model.approvalState}</p>
        </div>
        <div className="rounded-md border border-border p-3">
          <p className="text-xs font-medium text-muted-foreground">Published SDVs</p>
          <p className="mt-1 text-sm font-semibold text-foreground">{model.publishedSdvCount}</p>
          <p className="mt-1 text-xs text-muted-foreground">Available to Procedure Source Bindings after publish.</p>
        </div>
      </div>

      <div className="grid gap-5 p-5 xl:grid-cols-[minmax(0,320px)_minmax(0,1fr)]">
        <div className="space-y-3">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Blockers and Next Action</h3>
          {model.error ? (
            <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-900">{model.error}</div>
          ) : model.blockers.length > 0 ? (
            <div className="space-y-2">
              {model.blockers.map((blocker) => (
                <div key={blocker} className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-900">
                  {blocker}
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-md border border-border p-3 text-sm text-muted-foreground">
              No DB blockers detected for attempting publish with approved artifacts.
            </div>
          )}
          <div className="rounded-md border border-border p-3 text-sm">
            <p className="font-medium text-foreground">Next action</p>
            <p className="mt-1 text-xs text-muted-foreground">{model.nextAction}</p>
          </div>
        </div>

        <form action={publishSourcePackageFromArtifacts} className="space-y-3">
          <input type="hidden" name="studyId" value={studyId} />
          <input type="hidden" name="organizationId" value={organizationId} />
          <div className="grid gap-3 md:grid-cols-2">
            <label className="space-y-1 text-xs font-medium text-muted-foreground">
              Study version
              <select
                name="studyVersionId"
                className="h-9 w-full rounded-md border border-input bg-background px-2 text-xs"
                disabled={!canAttemptPublish}
                required
              >
                {model.studyVersions.length === 0 ? (
                  <option value="">No study version available</option>
                ) : (
                  model.studyVersions.map((version) => (
                    <option key={version.id} value={version.id}>{version.label}</option>
                  ))
                )}
              </select>
            </label>
            <div className="rounded-md border border-dashed border-border p-3 text-xs text-muted-foreground">
              Publish succeeds only after the RPC creates a persisted package and published source definition versions.
            </div>
          </div>
          <label className="block space-y-1 text-xs font-medium text-muted-foreground">
            Publish package JSON
            <textarea
              name="publishPackageJson"
              className="min-h-28 w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-xs"
              placeholder='{"package_id":"pkg_...","publish_ready":true,...}'
              disabled={!canAttemptPublish}
              required
            />
          </label>
          <label className="block space-y-1 text-xs font-medium text-muted-foreground">
            Source definitions JSON
            <textarea
              name="sourceDefinitionsJson"
              className="min-h-28 w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-xs"
              placeholder='{"source_definition_versions":[...],"validation_report":{"passed":true,...}}'
              disabled={!canAttemptPublish}
              required
            />
          </label>
          <label className="block space-y-1 text-xs font-medium text-muted-foreground">
            Approval JSON
            <textarea
              name="approvalJson"
              className="min-h-24 w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-xs"
              placeholder='{"decision":"approved","publish_eligible":true,...}'
              disabled={!canAttemptPublish}
              required
            />
          </label>
          <button
            type="submit"
            disabled={!canAttemptPublish}
            className="rounded-md border border-border px-3 py-2 text-xs font-medium text-foreground hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
          >
            Publish approved package
          </button>
        </form>
      </div>
    </section>
  )
}

// ============================================================================
// Page
// ============================================================================

export default async function StudyWorkspacePage({ params, searchParams }: StudyWorkspaceProps) {
  const { studyId } = await params
  const { tab: rawTab, binding, reason, publish, publishReason, subject, subjectReason, action } = await searchParams
  const activeTab = (TABS.some(t => t.id === rawTab) ? rawTab : 'overview') as TabId

  const supabase = await createServerClient()

  // Load study
  const { data: study, error: studyErr } = await supabase
    .from('studies')
    .select('id, organization_id, name, slug, status')
    .eq('id', studyId)
    .maybeSingle()

  if (studyErr || !study) notFound()

  const organizationId = study.organization_id as string
  const user = await getSessionUser()
  if (!user) notFound()

  const memberships = await getOrganizationMemberships(user.id)
  const canAccessOrganization = hasActiveOrganizationMembership(memberships, organizationId)
  if (!canAccessOrganization) notFound()

  const [
    subjectOptionsResult,
    totalSubjectsResult,
    screeningSubjectsResult,
    enrolledSubjectsResult,
    randomizedSubjectsResult,
  ] = await Promise.all([
    supabase
      .from('study_subjects')
      .select('id, subject_identifier, enrollment_status')
      .eq('study_id', studyId)
      .eq('organization_id', organizationId)
      .order('subject_identifier', { ascending: true })
      .limit(SUBJECT_ANCHOR_OPTION_LIMIT),
    supabase
      .from('study_subjects')
      .select('id', { count: 'exact', head: true })
      .eq('study_id', studyId)
      .eq('organization_id', organizationId),
    supabase
      .from('study_subjects')
      .select('id', { count: 'exact', head: true })
      .eq('study_id', studyId)
      .eq('organization_id', organizationId)
      .eq('enrollment_status', 'screening'),
    supabase
      .from('study_subjects')
      .select('id', { count: 'exact', head: true })
      .eq('study_id', studyId)
      .eq('organization_id', organizationId)
      .eq('enrollment_status', 'enrolled'),
    supabase
      .from('study_subjects')
      .select('id', { count: 'exact', head: true })
      .eq('study_id', studyId)
      .eq('organization_id', organizationId)
      .eq('enrollment_status', 'randomized'),
  ])

  const subjects = subjectOptionsResult.data ?? []
  const subErr =
    subjectOptionsResult.error ??
    totalSubjectsResult.error ??
    screeningSubjectsResult.error ??
    enrolledSubjectsResult.error ??
    randomizedSubjectsResult.error
  const screeningSubjects = screeningSubjectsResult.count ?? 0
  const enrolledSubjects = enrolledSubjectsResult.count ?? 0
  const randomizedSubjects = randomizedSubjectsResult.count ?? 0
  const totalSubjects = totalSubjectsResult.count ?? 0
  const subjectCreateError = subject === 'error' ? subjectReason : undefined
  const anchorSubjectOptions =
    subjects.map((s) => ({
      id: s.id as string,
      label: s.subject_identifier as string,
    }))

  const studyVisits = activeTab === 'visits' && organizationId
    ? await loadStudyVisits(studyId, organizationId)
    : null
  const commandCenterModel = activeTab === 'subjects' && organizationId
    ? await loadStudySubjectCommandCenter(studyId, organizationId)
    : null
  const readiness = activeTab === 'overview'
    ? await loadExecutionReadinessModel({ supabase, studyId, organizationId })
    : null
  const protocolSetup = activeTab === 'overview'
    ? await loadProtocolSetupModel({ studyId, organizationId })
    : null
  const sourcePublish = activeTab === 'overview'
    ? await loadSourcePublishContinuityModel({ supabase, studyId, organizationId })
    : null
  const sourceBindings = activeTab === 'overview'
    ? await loadSourceBindingModel({ supabase, studyId, organizationId })
    : null
  const dataReadinessReview = activeTab === 'overview'
    ? await loadLatestStudyDataReadinessReview({
        studyId,
        organizationId,
        mode: 'internal_review',
      })
    : { readiness: null, createdAt: null }

  // Generate study color
  const COLORS = ['#3B82F6', '#8B5CF6', '#14B8A6', '#F59E0B', '#EC4899', 'var(--primary)']
  const studyColor = COLORS[study.name.charCodeAt(0) % COLORS.length]

  return (
    <div className="flex flex-col h-full bg-accent">

      {/* === Workspace Header === */}
      <header className="bg-card border-b border-border">
        {/* Breadcrumb + identity */}
        <div className="flex items-center gap-4 px-6 py-4">
          <Link
            href="/studies"
            className="p-2 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
          >
            <ChevronLeft className="w-4 h-4" />
          </Link>
          <div className="w-px h-8 bg-border" />
          <div className="w-1.5 h-12 rounded-full flex-shrink-0" style={{ backgroundColor: studyColor }} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              {study.slug && <span className="mono-id">{study.slug}</span>}
              <span className="status-badge border border-border bg-muted text-muted-foreground">
                Administrative: {study.status ?? 'unknown'}
              </span>
            </div>
            <h1 className="text-base font-semibold text-foreground truncate">{study.name}</h1>
          </div>

          {/* Quick stats */}
          <div className="flex items-center gap-4 px-5 py-2.5 rounded-xl bg-accent border border-border">
            <div className="text-center">
              <p className="text-lg font-bold text-foreground">{totalSubjects}</p>
              <p className="text-[10px] text-muted-foreground">Subjects</p>
            </div>
            <div className="w-px h-8 bg-border" />
            <div className="text-center">
              <p className="text-lg font-bold text-primary">{enrolledSubjects}</p>
              <p className="text-[10px] text-muted-foreground">Enrolled</p>
            </div>
            <div className="w-px h-8 bg-border" />
            <div className="text-center">
              <p className="text-lg font-bold text-blue-500">{screeningSubjects}</p>
              <p className="text-[10px] text-muted-foreground">Screening</p>
            </div>
            <div className="w-px h-8 bg-border" />
            <div className="text-center">
              <p className="text-lg font-bold text-muted-foreground">{randomizedSubjects}</p>
              <p className="text-[10px] text-muted-foreground">Randomized</p>
            </div>
          </div>
        </div>

        {/* Tab navigation */}
        <div className="px-6">
          <div className="flex gap-0.5 overflow-x-auto scrollbar-thin">
            {TABS.map((tab) => {
              const isActive = tab.id === activeTab
              return (
                <Link
                  key={tab.id}
                  href={`/studies/${studyId}?tab=${tab.id}`}
                  className={`flex items-center gap-1.5 px-4 py-3 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
                    isActive
                      ? 'border-primary text-primary'
                      : 'border-transparent text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <tab.icon className="w-3.5 h-3.5" />
                  {tab.label}
                </Link>
              )
            })}
          </div>
        </div>
      </header>

      {/* === Tab Content === */}
      <div className="vilo-ops-scroll min-h-0 min-w-0 flex-1 overflow-x-auto overflow-y-auto bg-accent scrollbar-thin">

        {/* OVERVIEW */}
        {activeTab === 'overview' && (
          <div className="w-full min-w-0 max-w-none space-y-5 p-6">
            <div className="min-w-0 w-full max-w-none space-y-5">
              {readiness ? <ExecutionReadinessSection model={readiness} /> : null}
              {protocolSetup ? (
                <ProtocolSetupPanel
                  studyId={studyId}
                  organizationId={organizationId}
                  visits={protocolSetup.visits}
                  procedureMaps={protocolSetup.procedureMaps}
                  error={protocolSetup.error}
                />
              ) : null}
              {sourcePublish ? (
                <SourcePublishContinuitySection
                  model={sourcePublish}
                  studyId={studyId}
                  organizationId={organizationId}
                  publishStatus={publish}
                  publishReason={publishReason}
                />
              ) : null}
              {sourceBindings ? (
                <SourceBindingSection
                  model={sourceBindings}
                  studyId={studyId}
                  organizationId={organizationId}
                  bindingStatus={binding}
                  bindingReason={reason}
                />
              ) : null}
              {dataReadinessReview ? (
                <StudyDataReadinessCard
                  studyId={studyId}
                  organizationId={organizationId}
                  initialReadiness={dataReadinessReview.readiness}
                  initialCreatedAt={dataReadinessReview.createdAt}
                />
              ) : null}

              {/* Subject summary */}
              <div className="vilo-card p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                    <Users className="w-4 h-4 text-primary" />
                    Subjects
                  </h3>
                  <Link
                    href={`/studies/${studyId}?tab=subjects`}
                    className="text-xs text-primary hover:underline"
                  >
                    View all →
                  </Link>
                </div>
                {subErr ? (
                  <p className="text-xs text-destructive">{subErr.message}</p>
                ) : totalSubjects === 0 ? (
                  <AddSubjectForm
                    studyId={studyId}
                    organizationId={organizationId}
                    errorReason={subjectCreateError}
                    anchorOptions={anchorSubjectOptions}
                  />
                ) : (
                  <div className="rounded-xl overflow-hidden border border-border/60">
                    {subjects.slice(0, SUBJECT_PREVIEW_LIMIT).map(s => (
                      <SubjectRow key={s.id} subject={s} studyId={studyId} />
                    ))}
                    {totalSubjects > SUBJECT_PREVIEW_LIMIT && (
                      <Link
                        href={`/studies/${studyId}?tab=subjects`}
                        className="block text-center py-2 text-xs text-primary hover:bg-accent transition-colors"
                      >
                        +{totalSubjects - SUBJECT_PREVIEW_LIMIT} more subjects →
                      </Link>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="vilo-card min-w-0 w-full p-5">
              <h3 className="mb-4 text-sm font-semibold text-foreground">Study Details</h3>
              <div className="flex flex-wrap gap-x-8 gap-y-2 text-sm">
                <div>
                  <span className="text-muted-foreground">Status </span>
                  <span className="font-medium capitalize">{study.status ?? '—'}</span>
                </div>
                {study.slug ? (
                  <div>
                    <span className="text-muted-foreground">Slug </span>
                    <span className="mono-id">{study.slug}</span>
                  </div>
                ) : null}
                <div>
                  <span className="text-muted-foreground">Total subjects </span>
                  <span className="font-medium">{totalSubjects}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* SUBJECTS */}
        {activeTab === 'subjects' && (
          <div className="p-6 h-[calc(100vh-140px)] flex flex-col">
            <div className="vilo-card flex flex-col min-h-0 flex-1 p-5 space-y-4">
              
              <div className="flex items-center justify-between flex-shrink-0 mb-2">
                <h3 className="text-lg font-semibold text-foreground">Subjects</h3>
                {action !== 'add-subject' ? (
                  <Link
                    href={`/studies/${studyId}?tab=subjects&action=add-subject`}
                    className="rounded-md bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground shadow hover:bg-primary/90"
                  >
                    Add Subject
                  </Link>
                ) : (
                  <Link
                    href={`/studies/${studyId}?tab=subjects`}
                    className="text-sm font-medium text-muted-foreground hover:text-foreground"
                  >
                    Back to Subject List
                  </Link>
                )}
              </div>

              {action === 'add-subject' ? (
                <div className="flex-shrink-0">
                  <h3 className="text-sm font-semibold text-foreground mb-3">Add New Subject</h3>
                  <AddSubjectForm
                    studyId={studyId}
                    organizationId={organizationId}
                    errorReason={subjectCreateError}
                    anchorOptions={anchorSubjectOptions}
                  />
                </div>
              ) : (
                <div className="flex flex-col min-h-0 flex-1 border-t border-border/60 pt-4">
                  {totalSubjects === 0 ? (
                    <div className="flex flex-col items-center justify-center p-12 border border-dashed rounded-lg">
                      <p className="text-sm font-medium text-muted-foreground mb-4">No subjects yet</p>
                      <Link
                        href={`/studies/${studyId}?tab=subjects&action=add-subject`}
                        className="rounded-md bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground shadow hover:bg-primary/90"
                      >
                        Add Subject
                      </Link>
                    </div>
                  ) : commandCenterModel ? (
                    <StudySubjectCommandCenter model={commandCenterModel} studyId={studyId} />
                  ) : null}
                </div>
              )}
              
            </div>
          </div>
        )}

        {/* VISITS — REAL DATA */}
        {activeTab === 'visits' && (
          <VisitsTab studyVisits={studyVisits} />
        )}

        {activeTab === 'regulatory' && (
          <GuidanceChecklist
            title="Regulatory Readiness"
            description="This tab is guidance only. Vilo OS does not expose a formal regulatory workspace, eTMF, CAPA system, or sponsor exchange from this study view."
            items={[
              'Use visit workflow and source review for coordinator-owned operational evidence.',
              'Keep formal regulatory binder and eTMF activities in the site-approved system of record.',
              'Record protocol execution issues through visit workflow tasks and source findings when they affect source capture.',
            ]}
          />
        )}

        {activeTab === 'labs' && (
          <div className="p-6 h-[calc(100vh-140px)] flex flex-col">
            <StudyLabsSearchCenter
              studyId={studyId}
              subjects={subjects.map((s) => ({
                id: s.id as string,
                label: s.subject_identifier as string,
              }))}
            />
          </div>
        )}

        {activeTab === 'needs-review' && (
          <div className="p-6 h-[calc(100vh-140px)] flex flex-col">
            <NeedsReviewQueue studyId={studyId} />
          </div>
        )}

        {activeTab === 'documents' && (
          <GuidanceChecklist
            title="Study Documents"
            description="Study-level document management is not enabled here. Coordinator-uploaded supporting files live on individual visit document pages."
            items={[
              'Open a subject visit and use its Documents tab for visit-specific supporting files.',
              'Use source capture and response set review for structured source documentation.',
              'Do not treat this study tab as eTMF, sponsor exchange, OCR, or automated document classification.',
            ]}
          />
        )}
      </div>
    </div>
  )
}
