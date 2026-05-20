import { notFound } from 'next/navigation'
import { loadOperationalChronology } from '@/lib/operations/loadOperationalChronology'
import {
  sourceCapturePath,
  sourceResponseSetPath,
  subjectChartPath,
  subjectVisitsPath,
  visitDetailPath,
} from '@/lib/ops/paths'
import { loadSubjectClinicalProfile } from '@/lib/subject/clinical-profile/read'
import { loadSubjectOperationalIntelligence } from '@/lib/subject/operations'
import { loadSubjectWorkflowActions } from '@/lib/subject/workflow/data'
import { createServerClient } from '@/lib/supabase/server'
import { todayIsoDate } from '@/lib/visits/calculateVisitWindows'

export type WorkspaceItem = {
  id: string
  title: string
  detail: string
  href: string
  status?: string | null
  tone: 'critical' | 'warning' | 'neutral' | 'success'
}

export type StudyWorkspaceModel = {
  study: {
    id: string
    name: string
    status: string | null
    organizationId: string
  }
  overview: {
    activeSubjects: number
    upcomingVisits: number
    incompleteSource: number
    openTasks: number
    blockers: number
  }
  activeSubjects: WorkspaceItem[]
  upcomingVisits: WorkspaceItem[]
  sourceCompletion: WorkspaceItem[]
  openBlockersTasks: WorkspaceItem[]
  recentEvents: WorkspaceItem[]
  unavailable: string[]
}

export type SubjectWorkspaceModel = {
  subject: {
    id: string
    studyId: string
    organizationId: string
    subjectIdentifier: string
    enrollmentStatus: string | null
    studyName: string
  }
  timeline: WorkspaceItem[]
  visits: WorkspaceItem[]
  procedures: WorkspaceItem[]
  sourceStatus: WorkspaceItem[]
  clinicalLinks: WorkspaceItem[]
  openTasksBlockers: WorkspaceItem[]
  signaturesPending: WorkspaceItem[]
  unavailable: string[]
}

function one<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null
  return value ?? null
}

function toneForStatus(status: string | null | undefined): WorkspaceItem['tone'] {
  if (status === 'blocked' || status === 'missed' || status === 'out_of_window') return 'critical'
  if (status === 'completed' || status === 'locked' || status === 'submitted' || status === 'signed') return 'success'
  if (status === 'draft' || status === 'in_progress' || status === 'pending') return 'warning'
  return 'neutral'
}

export async function loadStudyWorkspaceModel(studyId: string): Promise<StudyWorkspaceModel> {
  const supabase = await createServerClient()
  const today = todayIsoDate()
  const unavailable: string[] = []

  const { data: study, error: studyError } = await supabase
    .from('studies')
    .select('id, organization_id, name, status')
    .eq('id', studyId)
    .maybeSingle()

  if (studyError || !study) notFound()

  const organizationId = study.organization_id as string

  const [subjects, visits, sourceSets, findings, workflow, events] = await Promise.all([
    supabase
      .from('study_subjects')
      .select('id, subject_identifier, enrollment_status')
      .eq('study_id', studyId)
      .order('created_at', { ascending: false })
      .limit(12),
    supabase
      .from('visits')
      .select('id, study_subject_id, scheduled_date, window_status, visit_status, visit_definitions(label, code), study_subjects(subject_identifier)')
      .eq('study_id', studyId)
      .gte('scheduled_date', today)
      .order('scheduled_date', { ascending: true })
      .limit(12),
    supabase
      .from('source_response_sets')
      .select('id, organization_id, study_subject_id, visit_id, procedure_execution_id, status')
      .eq('study_id', studyId)
      .in('status', ['draft', 'opened', 'in_progress', 'pending_review'])
      .order('opened_at', { ascending: false })
      .limit(12),
    supabase
      .from('source_response_validation_findings')
      .select('id, response_set_id, severity, message, status, created_at')
      .in('status', ['open', 'acknowledged'])
      .in('severity', ['error', 'critical'])
      .order('created_at', { ascending: false })
      .limit(12),
    supabase
      .from('subject_workflow_actions')
      .select('id, study_subject_id, visit_id, procedure_execution_id, source_response_set_id, action_type, title, status, priority, due_date')
      .eq('study_id', studyId)
      .in('status', ['open', 'in_progress'])
      .order('due_date', { ascending: true, nullsFirst: false })
      .limit(12),
    loadOperationalChronology({ organizationId, studyId, limit: 10 }),
  ])

  if (subjects.error) unavailable.push(`Subjects unavailable: ${subjects.error.message}`)
  if (visits.error) unavailable.push(`Upcoming visits unavailable: ${visits.error.message}`)
  if (sourceSets.error) unavailable.push(`Source status unavailable: ${sourceSets.error.message}`)
  if (findings.error) unavailable.push(`Blockers unavailable: ${findings.error.message}`)
  if (workflow.error) unavailable.push(`Workflow unavailable: ${workflow.error.message}`)

  const activeSubjects = (subjects.data ?? []).map((subject) => ({
    id: subject.id as string,
    title: subject.subject_identifier as string,
    detail: `Status: ${String(subject.enrollment_status ?? 'unknown')}`,
    href: subjectChartPath(studyId, subject.id as string),
    status: subject.enrollment_status as string | null,
    tone: toneForStatus(subject.enrollment_status as string | null),
  }))

  const upcomingVisits = (visits.data ?? []).map((visit) => {
    const def = one(visit.visit_definitions) as { label?: string | null; code?: string | null } | null
    const subject = one(visit.study_subjects) as { subject_identifier?: string | null } | null
    return {
      id: visit.id as string,
      title: `${subject?.subject_identifier ?? 'Subject'} · ${def?.label ?? def?.code ?? 'Visit'}`,
      detail: `${String(visit.scheduled_date ?? 'unscheduled')} · ${String(visit.visit_status ?? 'scheduled')}`,
      href: visitDetailPath(visit.id as string),
      status: visit.window_status as string | null,
      tone: toneForStatus(visit.window_status as string | null),
    }
  })

  const sourceCompletion = (sourceSets.data ?? []).map((set) => ({
    id: set.id as string,
    title: `Source set ${String(set.id).slice(0, 8)}`,
    detail: `Status: ${String(set.status ?? 'draft')}`,
    href: sourceResponseSetPath(set.id as string, { organization_id: organizationId }),
    status: set.status as string | null,
    tone: toneForStatus(set.status as string | null),
  }))

  const blockers = (findings.data ?? []).map((finding) => ({
    id: finding.id as string,
    title: String(finding.message ?? 'Source blocker'),
    detail: `${String(finding.severity ?? 'error')} · ${String(finding.status ?? 'open')}`,
    href: sourceResponseSetPath(finding.response_set_id as string, { organization_id: organizationId }),
    status: finding.status as string | null,
    tone: 'critical' as const,
  }))

  const tasks = (workflow.data ?? []).map((task) => ({
    id: task.id as string,
    title: task.title as string,
    detail: `${String(task.action_type ?? 'task')} · ${String(task.priority ?? 'normal')}`,
    href: task.source_response_set_id
      ? sourceResponseSetPath(task.source_response_set_id as string, { organization_id: organizationId })
      : task.procedure_execution_id
        ? sourceCapturePath(task.procedure_execution_id as string, organizationId)
        : task.visit_id
          ? visitDetailPath(task.visit_id as string)
          : subjectChartPath(studyId, task.study_subject_id as string),
    status: task.status as string | null,
    tone: task.priority === 'urgent' ? 'critical' as const : 'neutral' as const,
  }))

  return {
    study: {
      id: study.id as string,
      name: study.name as string,
      status: (study.status as string | null) ?? null,
      organizationId,
    },
    overview: {
      activeSubjects: activeSubjects.length,
      upcomingVisits: upcomingVisits.length,
      incompleteSource: sourceCompletion.length,
      openTasks: tasks.length,
      blockers: blockers.length,
    },
    activeSubjects,
    upcomingVisits,
    sourceCompletion,
    openBlockersTasks: [...blockers, ...tasks].slice(0, 12),
    recentEvents: events.map((event) => ({
      id: event.id,
      title: event.eventType,
      detail: event.occurredAt,
      href: event.visitId ? visitDetailPath(event.visitId) : subjectChartPath(studyId, ''),
      status: event.eventType,
      tone: 'neutral' as const,
    })),
    unavailable,
  }
}

export async function loadSubjectWorkspaceModel(subjectId: string): Promise<SubjectWorkspaceModel> {
  const supabase = await createServerClient()
  const unavailable: string[] = []

  const { data: subject, error: subjectError } = await supabase
    .from('study_subjects')
    .select('id, organization_id, study_id, subject_identifier, enrollment_status, studies(name)')
    .eq('id', subjectId)
    .maybeSingle()

  if (subjectError || !subject) notFound()

  const study = one(subject.studies) as { name?: string | null } | null
  const studyId = subject.study_id as string
  const organizationId = subject.organization_id as string

  const [visits, procedures, sourceSets, workflow, operational, profile] = await Promise.all([
    supabase
      .from('visits')
      .select('id, scheduled_date, actual_date, completed_at, visit_status, window_status, visit_review_status, visit_definitions(label, code)')
      .eq('study_subject_id', subjectId)
      .order('scheduled_date', { ascending: true, nullsFirst: false }),
    supabase
      .from('procedure_executions')
      .select('id, visit_id, execution_status, validation_status, is_signed, is_locked, procedure_definitions(label, code)')
      .eq('study_subject_id', subjectId)
      .order('created_at', { ascending: true }),
    supabase
      .from('source_response_sets')
      .select('id, organization_id, visit_id, procedure_execution_id, status, submitted_at, signed_at, locked_at')
      .eq('study_subject_id', subjectId)
      .order('opened_at', { ascending: false }),
    loadSubjectWorkflowActions(subjectId, organizationId),
    loadSubjectOperationalIntelligence({ subjectId, studyId, organizationId }),
    loadSubjectClinicalProfile(subjectId).catch(() => null),
  ])

  if (visits.error) unavailable.push(`Visits unavailable: ${visits.error.message}`)
  if (procedures.error) unavailable.push(`Procedures unavailable: ${procedures.error.message}`)
  if (sourceSets.error) unavailable.push(`Source status unavailable: ${sourceSets.error.message}`)
  if (!workflow.ok) unavailable.push(`Workflow unavailable: ${workflow.error}`)
  if (!operational.ok) unavailable.push(`Operational intelligence unavailable: ${operational.error}`)

  const visitItems = (visits.data ?? []).map((visit) => {
    const def = one(visit.visit_definitions) as { label?: string | null; code?: string | null } | null
    return {
      id: visit.id as string,
      title: def?.label ?? def?.code ?? 'Visit',
      detail: `${String(visit.scheduled_date ?? visit.actual_date ?? 'unscheduled')} · ${String(visit.visit_status ?? 'scheduled')}`,
      href: visitDetailPath(visit.id as string),
      status: visit.window_status as string | null,
      tone: toneForStatus(visit.window_status as string | null),
    }
  })

  const procedureItems = (procedures.data ?? []).map((procedure) => {
    const def = one(procedure.procedure_definitions) as { label?: string | null; code?: string | null } | null
    return {
      id: procedure.id as string,
      title: def?.label ?? def?.code ?? 'Procedure',
      detail: `${String(procedure.execution_status ?? 'pending')} · ${procedure.is_signed ? 'signed' : 'unsigned'}`,
      href: sourceCapturePath(procedure.id as string, organizationId),
      status: procedure.validation_status as string | null,
      tone: procedure.validation_status === 'blocked' ? 'critical' as const : toneForStatus(procedure.execution_status as string | null),
    }
  })

  const sourceStatus = (sourceSets.data ?? []).map((set) => ({
    id: set.id as string,
    title: `Source set ${String(set.id).slice(0, 8)}`,
    detail: `Status: ${String(set.status ?? 'draft')}${set.signed_at ? ' · signed' : ''}${set.locked_at ? ' · locked' : ''}`,
    href: sourceResponseSetPath(set.id as string, { organization_id: organizationId }),
    status: set.status as string | null,
    tone: toneForStatus(set.status as string | null),
  }))

  const openTasksBlockers = workflow.ok
    ? workflow.actions
        .filter((action) => action.status === 'open' || action.status === 'in_progress')
        .map((action) => ({
          id: action.id,
          title: action.title,
          detail: `${action.actionType} · ${action.priority}`,
          href: action.deepLink,
          status: action.status,
          tone: action.priority === 'urgent' ? 'critical' as const : 'neutral' as const,
        }))
    : []

  const signaturesPending = procedureItems
    .filter((item) => item.detail.includes('unsigned'))
    .map((item) => ({
      ...item,
      title: `Signature pending · ${item.title}`,
      tone: item.status === 'blocked' ? 'critical' as const : 'warning' as const,
    }))

  const clinicalLinks: WorkspaceItem[] = [
    {
      id: 'clinical-profile',
      title: 'Clinical profile',
      detail: profile ? 'Medical history and longitudinal profile available.' : 'Clinical profile route available; data not loaded.',
      href: `${subjectChartPath(studyId, subjectId)}?tab=clinical-profile`,
      status: profile ? 'available' : 'unavailable',
      tone: profile ? 'success' : 'neutral',
    },
    {
      id: 'conmeds',
      title: 'ConMeds',
      detail: profile ? `${profile.conmeds.length} medication record(s)` : 'ConMed tab available.',
      href: `${subjectChartPath(studyId, subjectId)}?tab=conmeds`,
      status: profile ? 'available' : 'unavailable',
      tone: 'neutral',
    },
    {
      id: 'visits',
      title: 'Visit schedule',
      detail: `${visitItems.length} visit(s) on subject schedule`,
      href: subjectVisitsPath(studyId, subjectId),
      status: 'available',
      tone: 'neutral',
    },
  ]

  const timeline = operational.ok
    ? operational.data.visitTimeline.slice(0, 10).map((item) => ({
        id: item.visitId,
        title: item.visitName,
        detail: `${item.visitStatus} · ${item.sourceStatus} · ${item.signaturesPending.length} signature item(s)`,
        href: item.href,
        status: item.windowStatus,
        tone: item.blockedProcedureCount > 0 ? 'critical' as const : toneForStatus(item.visitStatus),
      }))
    : visitItems

  return {
    subject: {
      id: subject.id as string,
      studyId,
      organizationId,
      subjectIdentifier: subject.subject_identifier as string,
      enrollmentStatus: (subject.enrollment_status as string | null) ?? null,
      studyName: study?.name ?? 'Study',
    },
    timeline,
    visits: visitItems,
    procedures: procedureItems,
    sourceStatus,
    clinicalLinks,
    openTasksBlockers,
    signaturesPending,
    unavailable,
  }
}
