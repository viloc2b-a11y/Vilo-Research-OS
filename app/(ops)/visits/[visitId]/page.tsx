// app/(ops)/visits/[visitId]/page.tsx
// Phase 7E — Visit Workspace (Full-Screen Execution Cockpit)
// Wraps existing real DB logic in the Vilo OS visual shell.
// FULL SCREEN — focused execution environment.

import Link from 'next/link'
import { notFound } from 'next/navigation'
import {
  ChevronLeft,
  Clock,
  FileText,
  PenTool,
  Lock,
  Unlock,
  Check,
  AlertTriangle,
  Activity,
  FlaskConical,
  Heart,
  ClipboardList,
  Syringe,
  Pill,
  Calendar,
  ChevronRight,
} from 'lucide-react'
import { ProcedureCompleteButton } from '@/components/clinical/procedure-complete-button'
import { VisitLifecycleActions } from '@/components/clinical/visit-lifecycle-actions'
import {
  deriveVisitCloseoutHeaderChips,
  VisitCloseoutHeaderIndicators,
} from '@/components/subjects/visits/VisitCloseoutHeaderIndicators'
import { VisitCloseoutSection } from '@/components/subjects/visits/VisitCloseoutSection'
import { VisitReviewStatusBadge } from '@/components/subjects/visits/VisitReviewStatusBadge'
import {
  VisitClinicalLinkPanel,
  VisitGuidancePanel,
} from '@/components/subjects/visits/visit-workspace-panels'
import { VisitWorkflowPanel } from '@/components/subjects/workflow/VisitWorkflowPanel'
import {
  subjectAdverseEventsTabPath,
  subjectConMedsTabPath,
  visitDocumentsPath,
  visitDetailPath,
} from '@/lib/ops/paths'
import {
  buildVisitProgressSteps,
  currentVisitProgressIndex,
  type VisitProgressStep,
} from '@/lib/visits/visit-progress-steps'
import { loadOperationalChronology } from '@/lib/operations/loadOperationalChronology'
import { loadVisitCloseoutBundle } from '@/lib/subject/visits/progress-note/load'
import { loadVisitWorkflowActions } from '@/lib/subject/workflow/data'
import { hasActiveOrganizationMembership } from '@/lib/auth/membership-access'
import { getOrganizationMemberships, getSessionUser } from '@/lib/auth/session'
import { canSignClinicalSource } from '@/lib/rbac/permissions'
import type { VisitReviewStatus } from '@/lib/subject/visits/progress-note/types'
import { VisitCalendarRescheduleMeta } from '@/components/calendar/VisitCalendarRescheduleMeta'
import { ConditionalProceduresPanel } from '@/components/subjects/visits/ConditionalProceduresPanel'
import { loadVisitCalendarReschedule } from '@/lib/calendar/get-active-visit-reschedule'
import {
  formatVisitModalityLabel,
  instantiateConditionalProcedureFormAction,
  loadConditionalProcedureOptions,
} from '@/lib/visits/conditional-procedures'
import { createServerClient } from '@/lib/supabase/server'

type VisitWorkspaceProps = {
  params: Promise<{ visitId: string }>
  searchParams: Promise<{ tab?: string }>
}

const TABS = [
  { id: 'procedures',  label: 'Procedures' },
  { id: 'source',      label: 'Source Capture' },
  { id: 'labs',        label: 'Labs' },
  { id: 'safety',      label: 'AE / Safety' },
  { id: 'conmeds',     label: 'ConMeds' },
  { id: 'workflow',    label: 'Workflow' },
  { id: 'notes',       label: 'Notes' },
  { id: 'documents',   label: 'Documents' },
] as const

type TabId = typeof TABS[number]['id']

// ============================================================================
// Visit status helpers
// ============================================================================

function visitStatusBadgeClass(status: string | null) {
  switch (status) {
    case 'checked_in':
    case 'in_progress':   return 'bg-amber-50 text-amber-700 border border-amber-200'
    case 'completed':     return 'bg-accent/40 text-primary border border-primary/30'
    case 'locked':        return 'bg-accent/40 text-primary border border-primary/30'
    case 'missed':        return 'bg-red-50 text-red-700 border border-red-100'
    default:              return 'bg-blue-50 text-blue-700 border border-blue-200'
  }
}

// ============================================================================
// Progress steps strip
// ============================================================================

function ProgressStrip({ steps }: { steps: VisitProgressStep[] }) {
  const currentStep = currentVisitProgressIndex(steps)
  return (
    <div className="flex items-center gap-1 px-6 py-3 bg-card border-b border-border overflow-x-auto scrollbar-thin">
      {steps.map((step, i) => {
        const done = step.done
        const current = i === currentStep && !done
        return (
          <div key={step.id} className="flex items-center">
            <div className="flex flex-col items-center gap-1">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium flex-shrink-0 ${
                done    ? 'bg-primary text-white' :
                current ? 'bg-blue-500 text-white'  :
                          'bg-muted text-muted-foreground'
              }`}>
                {done ? <Check className="w-3 h-3" /> : i + 1}
              </div>
              <span className={`text-[10px] whitespace-nowrap ${
                done    ? 'text-primary' :
                current ? 'text-blue-600'  :
                          'text-muted-foreground'
              }`}>{step.label}</span>
            </div>
            {i < steps.length - 1 && (
              <div className={`w-10 h-0.5 mx-1 mb-4 flex-shrink-0 ${done ? 'bg-primary' : 'bg-border'}`} />
            )}
          </div>
        )
      })}
    </div>
  )
}

// ============================================================================
// Procedure row
// ============================================================================

function ProcedureTypeIcon({
  label,
  className,
}: {
  label: string | undefined
  className: string
}) {
  const l = (label ?? '').toLowerCase()
  if (l.includes('vital')) return <Activity className={className} />
  if (l.includes('lab')) return <FlaskConical className={className} />
  if (l.includes('ecg')) return <Heart className={className} />
  if (l.includes('quest')) return <ClipboardList className={className} />
  if (l.includes('pk')) return <Syringe className={className} />
  if (l.includes('ae')) return <AlertTriangle className={className} />
  if (l.includes('conmed') || l.includes('medication')) return <Pill className={className} />
  return <FileText className={className} />
}

function ProcedureStatusIcon({
  done,
  label,
  status,
}: {
  done: boolean
  label: string
  status: string
}) {
  if (done) return <Check className="w-4 h-4 text-white" />
  return (
    <ProcedureTypeIcon
      label={label}
      className={`w-4 h-4 ${status === 'in_progress' ? 'text-white' : 'text-muted-foreground'}`}
    />
  )
}

function ProcedureRow({
  proc, visitAllowsEdits, visitPath, studyPath, subjectPath, orgQs,
  responseSet, sourceBlockerCount, workflowTaskCount,
}: {
  proc: {
    id: string
    execution_status: string | null
    validation_status?: string | null
    is_signed?: boolean | null
    is_locked?: boolean | null
    performed_at: string | null
    procedure_definitions: { code?: string; label?: string } | null
  }
  visitAllowsEdits: boolean
  visitPath: string
  studyPath: string
  subjectPath: string
  orgQs: string
  responseSet: { id: string; status: string } | null
  sourceBlockerCount: number
  workflowTaskCount: number
}) {
  const pdef = proc.procedure_definitions
  const label = pdef?.label ?? pdef?.code ?? 'Procedure'
  const status = proc.execution_status ?? 'pending'
  const done = status === 'completed'
  const validationBlocked = proc.validation_status === 'blocked'
  const canComplete =
    visitAllowsEdits &&
    (status === 'pending' || status === 'in_progress') &&
    !validationBlocked
  const completeDisabledHint = validationBlocked
    ? 'Validation blocked — open source capture and resolve required fields or findings.'
    : sourceBlockerCount > 0
      ? 'Resolve Source Engine blockers before marking complete.'
      : null
  const captureHref = `/source/capture/${proc.id}${orgQs}`
  const reviewHref  = responseSet ? `/source/response-set/${responseSet.id}${orgQs}` : null

  return (
    <div className={`flex items-center gap-4 p-4 rounded-xl border transition-all ${
      done            ? 'bg-accent/40 border-primary/30' :
      status === 'in_progress' ? 'bg-amber-50 border-amber-200' :
                        'bg-card border-border/60'
    }`}>
      {/* Icon */}
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${
        done ? 'bg-primary' : status === 'in_progress' ? 'bg-amber-400' : 'bg-muted'
      }`}>
        <ProcedureStatusIcon done={done} label={label} status={status} />
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium ${done ? 'text-primary' : 'text-foreground'}`}>{label}</p>
        <div className="flex items-center gap-3 mt-0.5">
          <span className="text-[10px] text-muted-foreground capitalize">{status.replace('_', ' ')}</span>
          <span className="text-[10px] text-muted-foreground">
            Source: {responseSet?.status ?? 'not opened'}
          </span>
          <span className="text-[10px] text-muted-foreground">
            {proc.is_locked ? 'locked' : proc.is_signed ? 'signed' : 'unsigned'}
          </span>
          {proc.performed_at && (
            <span className="text-[10px] text-muted-foreground">
              Performed: {new Date(proc.performed_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
        </div>
        {(sourceBlockerCount > 0 || workflowTaskCount > 0 || proc.validation_status === 'blocked') && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {sourceBlockerCount > 0 ? (
              <span className="rounded bg-red-50 px-2 py-0.5 text-[10px] font-medium text-red-700">
                {sourceBlockerCount} Source Engine blocker{sourceBlockerCount > 1 ? 's' : ''}
              </span>
            ) : null}
            {workflowTaskCount > 0 ? (
              <span className="rounded bg-blue-50 px-2 py-0.5 text-[10px] font-medium text-blue-700">
                {workflowTaskCount} task{workflowTaskCount > 1 ? 's' : ''}
              </span>
            ) : null}
            {proc.validation_status === 'blocked' ? (
              <span className="rounded bg-red-50 px-2 py-0.5 text-[10px] font-medium text-red-700">
                validation blocked
              </span>
            ) : null}
          </div>
        )}
        <div className="flex items-center gap-3 mt-1">
          <Link href={captureHref} className="text-[10px] font-medium text-primary hover:underline">
            Source capture →
          </Link>
          {reviewHref && (
            <Link href={reviewHref} className="text-[10px] text-muted-foreground hover:underline">
              Review · {responseSet?.status}
            </Link>
          )}
        </div>
      </div>

      {/* Action */}
      <ProcedureCompleteButton
        procedureExecutionId={proc.id}
        visitPath={visitPath}
        studyPath={studyPath}
        subjectPath={subjectPath}
        disabled={!canComplete}
        disabledHint={completeDisabledHint}
      />
    </div>
  )
}

// ============================================================================
// Page
// ============================================================================

export default async function VisitWorkspacePage({ params, searchParams }: VisitWorkspaceProps) {
  const { visitId } = await params
  const { tab: rawTab } = await searchParams
  const activeTab = (TABS.some(t => t.id === rawTab) ? rawTab : 'procedures') as TabId

  const supabase = await createServerClient()

  // Load visit
  const { data: visit, error: vErr } = await supabase
    .from('visits')
    .select(`
      id, organization_id, scheduled_date, target_date, visit_status, visit_review_status,
      study_id, study_subject_id, modality,
      visit_definitions(code,label),
      study_subjects(subject_identifier)
    `)
    .eq('id', visitId)
    .maybeSingle()

  if (vErr || !visit) notFound()

  const organizationId = visit.organization_id as string
  const user = await getSessionUser()
  if (!user) notFound()

  const memberships = await getOrganizationMemberships(user.id)
  const canAccessOrganization = hasActiveOrganizationMembership(memberships, organizationId)
  if (!canAccessOrganization) notFound()

  // F-07: determine investigator signing authority for the current viewer
  const canInvestigatorSign = canSignClinicalSource(memberships, organizationId)

  // Study name for breadcrumb
  const { data: studyBanner } = await supabase
    .from('studies')
    .select('name')
    .eq('id', visit.study_id)
    .eq('organization_id', organizationId)
    .maybeSingle()

  // Resolve embedded records
  const vdRaw = Array.isArray(visit.visit_definitions) ? visit.visit_definitions[0] : visit.visit_definitions
  const vd = vdRaw as { code?: string; label?: string } | null
  const subjectEmbed = Array.isArray(visit.study_subjects) ? visit.study_subjects[0] : visit.study_subjects
  const subjectLabel = (subjectEmbed as { subject_identifier?: string | null } | null)?.subject_identifier ?? 'Subject'

  // Paths
  const studyPath      = `/studies/${visit.study_id}`
  const subjectPath    = `/studies/${visit.study_id}/subjects/${visit.study_subject_id}`
  const visitPath      = visitDetailPath(visit.id as string)
  const visitWorkflowPath = visitDetailPath(visit.id as string, 'workflow')
  const orgQs          = `?organization_id=${organizationId}`
  const returnToOpts   = { returnTo: visitPath }
  const aeTabHref      = subjectAdverseEventsTabPath(
    visit.study_id as string,
    visit.study_subject_id as string,
    returnToOpts,
  )
  const conmedsTabHref = subjectConMedsTabPath(
    visit.study_id as string,
    visit.study_subject_id as string,
    returnToOpts,
  )

  const visitAllowsProcedureEdits =
    visit.visit_status === 'scheduled' ||
    visit.visit_status === 'checked_in' ||
    visit.visit_status === 'in_progress'

  const isLocked = visit.visit_status === 'locked'
  const visitModalityLabel = formatVisitModalityLabel(visit.modality as string | null)

  const conditionalProcedureOptions = await loadConditionalProcedureOptions({
    visitId: visit.id as string,
    organizationId,
  })

  // Load procedures
  const { data: procedures, error: pErr } = await supabase
    .from('procedure_executions')
    .select(`id, execution_status, validation_status, performed_at, is_signed, is_locked, source_definition_version_id, procedure_definitions(code,label)`)
    .eq('visit_id', visitId)
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: true })

  const peIds = (procedures ?? []).map(p => p.id)
  const { data: responseSets } = peIds.length > 0
    ? await supabase
        .from('source_response_sets')
        .select('id, procedure_execution_id, status')
        .in('procedure_execution_id', peIds)
        .eq('organization_id', organizationId)
    : { data: [] as { id: string; procedure_execution_id: string; status: string }[] }

  const responseSetByPe = new Map(
    (responseSets ?? []).map(rs => [rs.procedure_execution_id, rs])
  )

  const responseSetIds = (responseSets ?? []).map((rs) => rs.id as string)
  const { data: sourceBlockers } = responseSetIds.length > 0
    ? await supabase
        .from('source_response_validation_findings')
        .select('id, response_set_id, severity, message, status')
        .in('response_set_id', responseSetIds)
        .in('status', ['open', 'acknowledged'])
        .in('severity', ['error', 'critical'])
    : { data: [] as { id: string; response_set_id: string; severity: string; message: string; status: string }[] }

  const blockersByResponseSet = new Map<string, typeof sourceBlockers>()
  for (const blocker of sourceBlockers ?? []) {
    const setId = blocker.response_set_id as string
    const rows = blockersByResponseSet.get(setId) ?? []
    rows.push(blocker)
    blockersByResponseSet.set(setId, rows)
  }

  // Load workflow + closeout
  const closeoutBundle   = await loadVisitCloseoutBundle(visitId)
  const workflowResult   = await loadVisitWorkflowActions(visitId, organizationId)
  const workflowActions  = workflowResult.ok ? workflowResult.actions : []
  const workflowByProcedure = new Map<string, number>()
  for (const action of workflowActions) {
    if (!action.procedureExecutionId) continue
    workflowByProcedure.set(
      action.procedureExecutionId,
      (workflowByProcedure.get(action.procedureExecutionId) ?? 0) + 1,
    )
  }
  const recentEvents = await loadOperationalChronology({
    organizationId,
    studyId: visit.study_id as string,
    visitId: visit.id as string,
    limit: 8,
  })
  const visitReviewStatus = (visit.visit_review_status as VisitReviewStatus | null) ?? closeoutBundle?.model.visitReviewStatus ?? 'draft'
  const protocolTargetDate = (visit.target_date as string | null) ?? null
  const calendarReschedule = await loadVisitCalendarReschedule(supabase, {
    organizationId,
    visitId: visit.id as string,
    protocolTargetDate,
  })

  const submittedSets = (responseSets ?? []).filter(rs =>
    ['submitted', 'pending_review', 'reviewed'].includes(rs.status)
  )

  const totalProcs     = procedures?.length ?? 0
  const completedProcs = procedures?.filter(p => p.execution_status === 'completed').length ?? 0
  const proceduresWithSource = (procedures ?? []).filter(
    (p) => p.source_definition_version_id,
  )
  const submittedStatuses = new Set(['submitted', 'pending_review', 'reviewed'])
  const submittedSourceForSourceProcs = proceduresWithSource.filter((p) => {
    const rs = responseSetByPe.get(p.id as string)
    return rs != null && submittedStatuses.has(String(rs.status))
  }).length

  const closeoutChips = deriveVisitCloseoutHeaderChips(closeoutBundle)
  const progressSteps = buildVisitProgressSteps({
    visitStatus: String(visit.visit_status ?? 'scheduled'),
    totalProcs,
    completedProcs,
    proceduresWithSourceCount: proceduresWithSource.length,
    submittedSourceForSourceProcsCount: submittedSourceForSourceProcs,
    coordinatorSigned: closeoutBundle?.model.coordinatorSignatureStatus === 'signed',
    investigatorSigned: closeoutBundle?.model.investigatorReviewStatus === 'signed',
    isLocked,
  })

  const visitLabel = vd?.label ?? vd?.code ?? 'Visit'
  const procedureGroups = [
    {
      id: 'active',
      label: 'Active',
      rows: (procedures ?? []).filter((p) => p.execution_status === 'pending' || p.execution_status === 'in_progress'),
    },
    {
      id: 'completed',
      label: 'Completed / Signed',
      rows: (procedures ?? []).filter((p) => p.execution_status === 'completed'),
    },
    {
      id: 'other',
      label: 'Other',
      rows: (procedures ?? []).filter((p) => !['pending', 'in_progress', 'completed'].includes(String(p.execution_status))),
    },
  ].filter((group) => group.rows.length > 0)

  return (
    <div className="flex flex-col h-full bg-accent">

      {/* === HEADER === */}
      <header className="flex-shrink-0 px-6 py-3 border-b border-border bg-accent">
        <div className="flex items-center gap-4">
          {/* Back */}
          <Link
            href={subjectPath}
            className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
          >
            <ChevronLeft className="w-4 h-4" />
          </Link>
          <div className="w-px h-8 bg-border" />

          {/* Breadcrumb */}
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Link href={studyPath} className="hover:text-primary transition-colors truncate max-w-[120px]">
              {studyBanner?.name ?? 'Study'}
            </Link>
            <ChevronRight className="w-3 h-3 flex-shrink-0" />
            <Link href={subjectPath} className="hover:text-primary transition-colors">
              {subjectLabel}
            </Link>
            <ChevronRight className="w-3 h-3 flex-shrink-0" />
            <span className="font-semibold text-foreground">{visitLabel}</span>
          </div>

          {/* Meta — protocol target unchanged; calendar reschedule is display-only */}
          <div className="flex flex-col items-end gap-0.5 text-xs text-muted-foreground">
            {protocolTargetDate ? (
              <span className="flex items-center gap-1">
                <Calendar className="w-3 h-3 flex-shrink-0" />
                Protocol target: {protocolTargetDate}
              </span>
            ) : visit.scheduled_date && !calendarReschedule ? (
              <span className="flex items-center gap-1">
                <Calendar className="w-3 h-3 flex-shrink-0" />
                {visit.scheduled_date}
              </span>
            ) : null}
            <VisitCalendarRescheduleMeta
              reschedule={calendarReschedule}
              showTargetWhenRescheduled={false}
              className="text-right"
            />
            <span className="capitalize">Modality: {visitModalityLabel}</span>
          </div>
        </div>

        {/* Second row: visit identity + status bar */}
        <div className="flex items-center justify-between mt-2">
          <div className="flex items-center gap-3">
            <h1 className="text-base font-semibold text-foreground">{visitLabel}</h1>
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider ${visitStatusBadgeClass(visit.visit_status)}`}>
              {visit.visit_status?.replace('_', ' ') ?? 'Scheduled'}
            </span>
            <VisitReviewStatusBadge status={visitReviewStatus} />
            <VisitCloseoutHeaderIndicators
              chips={closeoutChips}
              workflowHref={visitWorkflowPath}
            />
          </div>

          {/* Completion indicators */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-4 px-4 py-2 bg-card rounded-lg border border-border">
              <div className="text-center">
                <p className="text-sm font-bold text-foreground">{completedProcs}/{totalProcs}</p>
                <p className="text-[10px] text-muted-foreground">Procedures</p>
              </div>
              <div className="w-px h-6 bg-border" />
              <div className="flex items-center gap-1.5">
                {submittedSets.length > 0
                  ? <Check className="w-4 h-4 text-primary" />
                  : <Clock className="w-4 h-4 text-amber-500" />
                }
                <span className="text-xs text-muted-foreground">Source</span>
              </div>
              <div className="w-px h-6 bg-border" />
              <div className="flex items-center gap-1.5">
                {isLocked
                  ? <Lock className="w-4 h-4 text-primary" />
                  : <Unlock className="w-4 h-4 text-muted-foreground" />
                }
                <span className="text-xs text-muted-foreground">Lock</span>
              </div>
            </div>

            {/* Lifecycle actions */}
            <VisitLifecycleActions
              visitId={visit.id}
              visitPath={visitPath}
              studyPath={studyPath}
              subjectPath={subjectPath}
              visitStatus={visit.visit_status}
            />
          </div>
        </div>
      </header>

      {/* Progress strip */}
      <ProgressStrip steps={progressSteps} />

      {/* Tab nav */}
      <div className="flex-shrink-0 px-6 border-b border-border bg-card">
        <div className="flex gap-0.5 overflow-x-auto scrollbar-thin">
          {TABS.map(tab => {
            const isActive = tab.id === activeTab
            return (
              <Link
                key={tab.id}
                href={`/visits/${visitId}?tab=${tab.id}`}
                className={`px-4 py-3 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
                  isActive
                    ? 'border-primary text-primary'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                {tab.label}
              </Link>
            )
          })}
        </div>
      </div>

      {/* === CONTENT === */}
      <div className="flex-1 overflow-y-auto bg-accent scrollbar-thin">

        {/* PROCEDURES */}
        {activeTab === 'procedures' && (
          <div className="p-6 max-w-[900px]">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <ClipboardList className="w-4 h-4 text-primary" />
                Procedures & Source Forms
              </h2>
              <span className="text-xs text-muted-foreground">{completedProcs} of {totalProcs} complete</span>
            </div>

            {pErr ? (
              <p className="text-sm text-destructive">{pErr.message}</p>
            ) : (
              <>
            <ConditionalProceduresPanel
              organizationId={organizationId}
              visitId={visit.id as string}
              options={conditionalProcedureOptions}
              canInstantiate={visitAllowsProcedureEdits}
              instantiateAction={instantiateConditionalProcedureFormAction}
            />

            {procedures?.length ? (
              <div className="space-y-5">
                {procedureGroups.map((group) => (
                  <section key={group.id} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        {group.label}
                      </h3>
                      <span className="text-[10px] text-muted-foreground">{group.rows.length}</span>
                    </div>
                    <div className="space-y-3">
                      {group.rows.map(proc => {
                        const pdfRaw = Array.isArray(proc.procedure_definitions)
                          ? proc.procedure_definitions[0]
                          : proc.procedure_definitions
                        const rs = responseSetByPe.get(proc.id) ?? null
                        const sourceBlockerCount = rs ? (blockersByResponseSet.get(rs.id as string)?.length ?? 0) : 0
                        return (
                          <ProcedureRow
                            key={proc.id}
                            proc={{ ...proc, procedure_definitions: pdfRaw as { code?: string; label?: string } | null }}
                            visitAllowsEdits={visitAllowsProcedureEdits}
                            visitPath={visitPath}
                            studyPath={studyPath}
                            subjectPath={subjectPath}
                            orgQs={orgQs}
                            responseSet={rs}
                            sourceBlockerCount={sourceBlockerCount}
                            workflowTaskCount={workflowByProcedure.get(proc.id as string) ?? 0}
                          />
                        )
                      })}
                    </div>
                  </section>
                ))}
              </div>
            ) : !conditionalProcedureOptions.length ? (
              <div className="vilo-card p-8 text-center">
                <ClipboardList className="w-7 h-7 text-muted-foreground mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">No procedures on this visit.</p>
              </div>
            ) : null}
              </>
            )}

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <div className="vilo-card p-4">
                <h3 className="mb-3 text-sm font-semibold text-foreground">Open task links</h3>
                {workflowActions.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No open workflow tasks for this visit.</p>
                ) : (
                  <ul className="space-y-2">
                    {workflowActions.slice(0, 6).map((action) => (
                      <li key={action.id}>
                        <Link href={action.deepLink} className="block rounded-md border border-border/60 px-3 py-2 text-xs hover:bg-card">
                          <span className="font-medium text-foreground">{action.title}</span>
                          <span className="block text-[10px] text-muted-foreground">{action.actionType} · {action.priority}</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div className="vilo-card p-4">
                <h3 className="mb-3 text-sm font-semibold text-foreground">Recent event trail</h3>
                {recentEvents.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No operational events recorded for this visit.</p>
                ) : (
                  <ul className="space-y-2">
                    {recentEvents.map((event) => (
                      <li key={event.id} className="rounded-md border border-border/60 px-3 py-2 text-xs">
                        <span className="font-medium text-foreground">{event.eventType}</span>
                        <span className="block text-[10px] text-muted-foreground">{event.occurredAt}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>
        )}

        {/* SOURCE CAPTURE */}
        {activeTab === 'source' && (
          <div className="p-6 max-w-[900px]">
            <h2 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
              <FileText className="w-4 h-4 text-primary" />
              Submitted Source Sets
            </h2>
            {submittedSets.length === 0 ? (
              <div className="vilo-card p-8 text-center">
                <FileText className="w-7 h-7 text-muted-foreground mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">No submitted source sets yet.</p>
                <p className="text-xs text-muted-foreground mt-1">Use source capture on each procedure above when ready.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {submittedSets.map(rs => (
                  <Link
                    key={rs.id}
                    href={`/source/response-set/${rs.id}${orgQs}`}
                    className="flex items-center gap-3 p-4 vilo-card-interactive"
                  >
                    <FileText className="w-4 h-4 text-primary" />
                    <span className="text-sm font-medium text-foreground">Source Set</span>
                    <span className="text-xs text-muted-foreground capitalize ml-auto">{rs.status}</span>
                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                  </Link>
                ))}
              </div>
            )}
            {sourceBlockers && sourceBlockers.length > 0 ? (
              <div className="mt-6 vilo-card p-4">
                <h3 className="mb-3 text-sm font-semibold text-foreground">Source Engine blockers</h3>
                <ul className="space-y-2">
                  {sourceBlockers.map((blocker) => (
                    <li key={blocker.id as string} className="rounded-md border border-red-100 bg-red-50 px-3 py-2 text-xs text-red-800">
                      <span className="font-medium">{String(blocker.severity).toUpperCase()}</span>
                      <span className="ml-2">{String(blocker.message)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        )}

        {/* WORKFLOW */}
        {activeTab === 'workflow' && (
          <div className="p-6 max-w-[900px] space-y-6">
            {!workflowResult.ok ? (
              <p className="text-sm text-destructive">Could not load visit workflow: {workflowResult.error}</p>
            ) : (
              <VisitWorkflowPanel
                organizationId={organizationId}
                studyId={visit.study_id as string}
                subjectId={visit.study_subject_id as string}
                visitId={visit.id as string}
                actions={workflowActions}
              />
            )}
            {closeoutBundle ? <VisitCloseoutSection bundle={closeoutBundle} canInvestigatorSign={canInvestigatorSign} /> : null}
          </div>
        )}

        {/* DOCUMENTS */}
        {activeTab === 'documents' && (
          <div className="p-6 max-w-[900px]">
            <div className="vilo-card p-5">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold text-foreground">Visit Documents</h2>
                <Link
                  href={visitDocumentsPath(
                    visit.study_id as string,
                    visit.study_subject_id as string,
                    visit.id as string,
                  )}
                  className="text-xs text-primary hover:underline"
                >
                  Open full documents view →
                </Link>
              </div>
              <p className="text-xs text-muted-foreground">
                ICFs, lab reports, imaging reports, ECGs, external records, and scanned source support.
              </p>
            </div>
          </div>
        )}

        {activeTab === 'labs' && (
          <div className="p-6">
            <VisitGuidancePanel
              icon={FlaskConical}
              title="Labs on this visit"
              description="Labs are tracked through protocol procedures and source capture for this visit. Complete lab-related procedures on the Procedures tab and capture results in source."
              actions={[
                { label: 'Return to Procedures', href: visitDetailPath(visitId, 'procedures') },
              ]}
            />
          </div>
        )}

        {activeTab === 'safety' && (
          <div className="p-6">
            <VisitClinicalLinkPanel
              icon={AlertTriangle}
              title="AE / Safety"
              description="Adverse events and safety signals for this subject are maintained on the subject chart AE timeline — not in a separate visit-level registry."
              primaryLabel="Open Subject AE Timeline"
              primaryHref={aeTabHref}
              secondaryNote="You will return to this visit workspace when done."
            />
          </div>
        )}

        {activeTab === 'conmeds' && (
          <div className="p-6">
            <VisitClinicalLinkPanel
              icon={Pill}
              title="Concomitant medications"
              description="ConMeds are reviewed and updated on the subject chart. Use the dedicated ConMeds tab for longitudinal medication history."
              primaryLabel="Open Subject ConMeds"
              primaryHref={conmedsTabHref}
              secondaryNote="You will return to this visit workspace when done."
            />
          </div>
        )}

        {activeTab === 'notes' && (
          <div className="p-6">
            <VisitGuidancePanel
              icon={PenTool}
              title="Visit notes"
              description="Visit notes are captured through source and procedure documentation on this visit, and through coordinator closeout on the Workflow tab."
              actions={[
                { label: 'Return to Procedures', href: visitDetailPath(visitId, 'procedures') },
                {
                  label: 'Open Workflow / Closeout',
                  href: visitWorkflowPath,
                  variant: 'outline',
                },
              ]}
            />
          </div>
        )}
      </div>
    </div>
  )
}
