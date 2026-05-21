// app/(ops)/studies/[studyId]/page.tsx
// Phase 7C — Study Workspace
// Full workspace shell with 9 operational tabs.
// Real data from DB for study + subjects; remaining tabs are operational stubs.

import Link from 'next/link'
import { notFound } from 'next/navigation'
import {
  ChevronLeft,
  CalendarDays,
  Users,
  FileText,
  Shield,
  DollarSign,
  Activity,
  Eye,
  Layers,
  ChevronRight,
  AlertTriangle,
  PenTool,
  FlaskConical,
  Clock,
  Check,
  Timer,
} from 'lucide-react'
import { createServerClient } from '@/lib/supabase/server'
import { hasActiveOrganizationMembership } from '@/lib/auth/membership-access'
import { getOrganizationMemberships, getSessionUser } from '@/lib/auth/session'
import { loadStudyVisits } from '@/lib/visits/loadStudyVisits'
import type { StudyVisitRow } from '@/lib/visits/loadStudyVisits'

type StudyWorkspaceProps = {
  params: Promise<{ studyId: string }>
  searchParams: Promise<{ tab?: string }>
}

const TABS = [
  { id: 'overview',    label: 'Overview',    icon: Layers },
  { id: 'subjects',    label: 'Subjects',    icon: Users },
  { id: 'visits',      label: 'Visits',      icon: CalendarDays },
  { id: 'calendar',    label: 'Calendar',    icon: CalendarDays },
  { id: 'regulatory',  label: 'Regulatory',  icon: Shield },
  { id: 'source',      label: 'Source',      icon: FileText },
  { id: 'financial',   label: 'Financial',   icon: DollarSign },
  { id: 'monitoring',  label: 'Monitoring',  icon: Eye },
  { id: 'documents',   label: 'Documents',   icon: Layers },
] as const

type TabId = typeof TABS[number]['id']

// ============================================================================
// Subject row
// ============================================================================

function SubjectRow({ subject, studyId }: {
  subject: { id: string; subject_identifier: string; enrollment_status: string | null }
  studyId: string
}) {
  const status = subject.enrollment_status ?? 'unknown'
  const statusColor: Record<string, string> = {
    active:    'status-badge-healthy',
    screening: 'status-badge-watch',
    enrolled:  'status-badge-healthy',
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

function ComingSoonTab({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="w-12 h-12 rounded-full bg-accent/40 flex items-center justify-center mb-4">
        <Activity className="w-5 h-5 text-primary" />
      </div>
      <p className="text-sm font-semibold text-foreground mb-1">{label}</p>
      <p className="text-xs text-muted-foreground">This workspace section is being built.</p>
    </div>
  )
}

// ============================================================================
// Page
// ============================================================================

export default async function StudyWorkspacePage({ params, searchParams }: StudyWorkspaceProps) {
  const { studyId } = await params
  const { tab: rawTab } = await searchParams
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

  // Load subjects (for Subjects tab + quick stats)
  const { data: subjects, error: subErr } = await supabase
    .from('study_subjects')
    .select('id, subject_identifier, enrollment_status')
    .eq('study_id', studyId)
    .eq('organization_id', organizationId)
    .order('subject_identifier', { ascending: true })

  const activeSubjects    = subjects?.filter(s => s.enrollment_status === 'active').length   ?? 0
  const screeningSubjects = subjects?.filter(s => s.enrollment_status === 'screening').length ?? 0
  const totalSubjects     = subjects?.length ?? 0

  const studyVisits = activeTab === 'visits' && organizationId
    ? await loadStudyVisits(studyId, organizationId)
    : null

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
              <span className={`status-badge ${
                study.status === 'active' || study.status === 'enrolling'
                  ? 'status-badge-healthy'
                  : 'bg-muted text-muted-foreground'
              }`}>
                {study.status ?? 'unknown'}
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
              <p className="text-lg font-bold text-primary">{activeSubjects}</p>
              <p className="text-[10px] text-muted-foreground">Active</p>
            </div>
            <div className="w-px h-8 bg-border" />
            <div className="text-center">
              <p className="text-lg font-bold text-blue-500">{screeningSubjects}</p>
              <p className="text-[10px] text-muted-foreground">Screening</p>
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
      <div className="flex-1 overflow-y-auto bg-accent scrollbar-thin">

        {/* OVERVIEW */}
        {activeTab === 'overview' && (
          <div className="p-6 grid grid-cols-3 gap-6 max-w-[1200px]">
            <div className="col-span-2 space-y-5">

              {/* Today's operations STUB */}
              <div className="vilo-card p-5">
                <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
                  <Activity className="w-4 h-4 text-primary" />
                  Today&apos;s Operations
                </h3>
                <div className="grid grid-cols-4 gap-4">
                  <div className="text-center p-4 rounded-lg bg-blue-50">
                    <CalendarDays className="w-5 h-5 text-blue-500 mx-auto mb-2" />
                    <p className="text-2xl font-bold text-blue-600">—</p>
                    <p className="text-xs text-muted-foreground">Visits Today</p>
                  </div>
                  <div className="text-center p-4 rounded-lg bg-amber-50">
                    <FileText className="w-5 h-5 text-amber-500 mx-auto mb-2" />
                    <p className="text-2xl font-bold text-amber-600">—</p>
                    <p className="text-xs text-muted-foreground">Incomplete Source</p>
                  </div>
                  <div className="text-center p-4 rounded-lg bg-orange-50">
                    <PenTool className="w-5 h-5 text-orange-500 mx-auto mb-2" />
                    <p className="text-2xl font-bold text-orange-600">—</p>
                    <p className="text-xs text-muted-foreground">Pending Signatures</p>
                  </div>
                  <div className="text-center p-4 rounded-lg bg-muted">
                    <FlaskConical className="w-5 h-5 text-muted-foreground mx-auto mb-2" />
                    <p className="text-2xl font-bold text-muted-foreground">—</p>
                    <p className="text-xs text-muted-foreground">Lab Reconciliation</p>
                  </div>
                </div>
              </div>

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
                ) : !subjects?.length ? (
                  <p className="text-xs text-muted-foreground">No subjects in this study yet.</p>
                ) : (
                  <div className="rounded-xl overflow-hidden border border-border/60">
                    {subjects.slice(0, 5).map(s => (
                      <SubjectRow key={s.id} subject={s} studyId={studyId} />
                    ))}
                    {subjects.length > 5 && (
                      <Link
                        href={`/studies/${studyId}?tab=subjects`}
                        className="block text-center py-2 text-xs text-primary hover:bg-accent transition-colors"
                      >
                        +{subjects.length - 5} more subjects →
                      </Link>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Right column */}
            <div className="space-y-5">
              {/* Study details */}
              <div className="vilo-card p-5">
                <h3 className="text-sm font-semibold text-foreground mb-4">Study Details</h3>
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Status</span>
                    <span className="font-medium capitalize">{study.status ?? '—'}</span>
                  </div>
                  {study.slug && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Slug / ID</span>
                      <span className="mono-id">{study.slug}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Total Subjects</span>
                    <span className="font-medium">{totalSubjects}</span>
                  </div>
                  {/* STUB: Phase, PI, Sponsor — add when DB columns exist */}
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Phase</span>
                    <span className="text-muted-foreground">—</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Principal Investigator</span>
                    <span className="text-muted-foreground">—</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Sponsor</span>
                    <span className="text-muted-foreground">—</span>
                  </div>
                </div>
              </div>

              {/* Compliance STUB */}
              <div className="vilo-card p-5">
                <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
                  <Shield className="w-4 h-4 text-primary" />
                  Compliance
                </h3>
                <div className="grid grid-cols-2 gap-3">
                  <div className="text-center p-3 rounded-lg bg-muted">
                    <p className="text-xl font-bold text-muted-foreground">—</p>
                    <p className="text-[10px] text-muted-foreground">Open Findings</p>
                  </div>
                  <div className="text-center p-3 rounded-lg bg-muted">
                    <p className="text-xl font-bold text-muted-foreground">—</p>
                    <p className="text-[10px] text-muted-foreground">Pending CAPAs</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* SUBJECTS */}
        {activeTab === 'subjects' && (
          <div className="p-6">
            <div className="vilo-card overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 border-b border-border/60">
                <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <Users className="w-4 h-4 text-primary" />
                  All Subjects
                  <span className="text-[10px] font-normal text-muted-foreground ml-1">{totalSubjects} total</span>
                </h2>
              </div>
              {subErr ? (
                <div className="p-6 text-sm text-destructive">{subErr.message}</div>
              ) : !subjects?.length ? (
                <div className="p-10 text-center">
                  <Users className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground">No subjects in this study yet.</p>
                </div>
              ) : (
                subjects.map(s => (
                  <SubjectRow key={s.id} subject={s} studyId={studyId} />
                ))
              )}
            </div>
          </div>
        )}

        {/* VISITS — REAL DATA */}
        {activeTab === 'visits' && (
          <VisitsTab studyVisits={studyVisits} />
        )}

        {/* CALENDAR — STUB */}
        {activeTab === 'calendar' && (
          <div className="p-6"><ComingSoonTab label="Calendar" /></div>
        )}

        {/* REGULATORY — STUB */}
        {activeTab === 'regulatory' && (
          <div className="p-6"><ComingSoonTab label="Regulatory" /></div>
        )}

        {/* SOURCE — STUB */}
        {activeTab === 'source' && (
          <div className="p-6"><ComingSoonTab label="Source Status" /></div>
        )}

        {/* FINANCIAL — STUB */}
        {activeTab === 'financial' && (
          <div className="p-6"><ComingSoonTab label="Financial" /></div>
        )}

        {/* MONITORING — STUB */}
        {activeTab === 'monitoring' && (
          <div className="p-6"><ComingSoonTab label="Monitoring & Findings" /></div>
        )}

        {/* DOCUMENTS — STUB */}
        {activeTab === 'documents' && (
          <div className="p-6"><ComingSoonTab label="Documents" /></div>
        )}
      </div>
    </div>
  )
}
