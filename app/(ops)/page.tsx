// app/(ops)/page.tsx
// Phase 7B — Operations Command Center
// "What needs attention NOW" — coordinator-first, execution-first.
// Today's visits: REAL data from DB (lib/visits/loadTodayVisits).
// Visit alerts: REAL data from DB (loadCoordinatorVisitAlerts).

import Link from 'next/link'
import {
  AlertTriangle,
  Clock,
  Calendar,
  CheckCircle2,
  FileText,
  PenTool,
  FlaskConical,
  AlertCircle,
  ChevronRight,
  Users,
  Timer,
  Activity,
  Check,
} from 'lucide-react'
import { getOrganizationMemberships, getSessionUser } from '@/lib/auth/session'
import { loadCoordinatorVisitAlerts } from '@/lib/visits/loadCoordinatorVisitAlerts'
import { loadTodayVisits } from '@/lib/visits/loadTodayVisits'
import { createServerClient } from '@/lib/supabase/server'

// ============================================================================
// Alert strip
// ============================================================================

type AlertSeverity = 'critical' | 'watch'
interface OpsAlert { id: string; severity: AlertSeverity; title: string; count: number }

function AlertStrip({ alerts }: { alerts: OpsAlert[] }) {
  const critical = alerts.filter(a => a.severity === 'critical')
  const watch    = alerts.filter(a => a.severity === 'watch')

  return (
    <div className="flex bg-card border-b" >
      {/* Critical */}
      <div className="flex-1 px-6 py-3 border-r" >
        <div className="flex items-center gap-2 mb-2">
          <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
          <span className="section-label text-red-600">Critical</span>
          {critical.length > 0 && (
            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-red-100 text-red-700">{critical.length}</span>
          )}
        </div>
        <div className="flex gap-2 flex-wrap">
          {critical.length === 0 ? (
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <CheckCircle2 className="w-3 h-3 text-primary" /> All clear
            </span>
          ) : (
            critical.map(a => (
              <div key={a.id} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-red-50 border border-red-100">
                <AlertTriangle className="w-3.5 h-3.5 text-red-500 flex-shrink-0" />
                <span className="text-xs font-medium text-red-700">{a.title}</span>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-red-200 text-red-800">{a.count}</span>
              </div>
            ))
          )}
        </div>
      </div>
      {/* Watch */}
      <div className="flex-1 px-6 py-3">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-2 h-2 rounded-full bg-amber-500" />
          <span className="section-label text-amber-600">Watch</span>
          {watch.length > 0 && (
            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700">{watch.length}</span>
          )}
        </div>
        <div className="flex gap-2 flex-wrap">
          {watch.length === 0 ? (
            <span className="text-xs text-muted-foreground">No watch items</span>
          ) : (
            watch.map(a => (
              <div key={a.id} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-amber-50 border border-amber-100">
                <Clock className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
                <span className="text-xs font-medium text-amber-700">{a.title}</span>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-200 text-amber-800">{a.count}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}

// ============================================================================
// Today visit card (real data)
// ============================================================================

function visitStatusStyle(status: string) {
  switch (status) {
    case 'in_progress':
    case 'checked_in':  return { border: 'border-l-amber-400',  badge: 'bg-amber-50 text-amber-700 border-amber-100',     label: 'In Progress' }
    case 'completed':   return { border: 'border-l-primary', badge: 'bg-accent/40 text-primary border-primary/30',    label: 'Complete' }
    case 'locked':      return { border: 'border-l-primary', badge: 'bg-accent/40 text-primary border-primary/30',    label: 'Locked' }
    case 'missed':      return { border: 'border-l-red-500',   badge: 'bg-red-50 text-red-700 border-red-100',            label: 'Missed' }
    default:            return { border: 'border-l-blue-400',  badge: 'bg-blue-50 text-blue-700 border-blue-100',          label: 'Scheduled' }
  }
}

function TodayVisitCard({ visit }: {
  visit: {
    visitId: string; studySubjectId: string; studyId: string
    subjectIdentifier: string; visitName: string; visitStatus: string
    hrefVisit: string; hrefSubject: string; pendingProcedures: number
  }
}) {
  const style = visitStatusStyle(visit.visitStatus)
  return (
    <Link href={visit.hrefVisit}
      className={`block p-4 bg-card rounded-xl border border-border/60 border-l-4 ${style.border} hover:shadow-md hover:-translate-y-0.5 transition-all`}
    >
      <div className="flex items-start justify-between mb-1.5">
        <div>
          <p className="text-sm font-semibold text-foreground">{visit.subjectIdentifier}</p>
          <p className="text-xs text-muted-foreground">{visit.visitName}</p>
        </div>
        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${style.badge}`}>
          {style.label}
        </span>
      </div>

      {visit.pendingProcedures > 0 ? (
        <div className="flex items-center gap-1.5 mt-2">
          <span className="text-[10px] px-2 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-100">
            {visit.pendingProcedures} pending procedure{visit.pendingProcedures > 1 ? 's' : ''}
          </span>
        </div>
      ) : visit.visitStatus === 'completed' || visit.visitStatus === 'locked' ? (
        <div className="flex items-center gap-1 mt-2">
          <Check className="w-3 h-3 text-primary" />
          <span className="text-[10px] text-primary">All procedures done</span>
        </div>
      ) : null}

      <div className="flex items-center justify-between mt-3 pt-2 border-t border-border/60">
        <Link href={visit.hrefSubject} className="text-[10px] text-muted-foreground hover:text-primary transition-colors" onClick={e => e.stopPropagation()}>
          Subject chart →
        </Link>
        <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
      </div>
    </Link>
  )
}

// ============================================================================
// Page
// ============================================================================

export default async function OperationsCommandCenterPage() {
  const user = await getSessionUser()
  const memberships = user ? await getOrganizationMemberships(user.id) : []
  const orgIds = Array.from(new Set(memberships.map(m => m.organization_id)))

  // Load real data in parallel
  const [rawAlerts, todayVisits, studiesResult] = await Promise.all([
    loadCoordinatorVisitAlerts(orgIds),
    loadTodayVisits(orgIds),
    (async () => {
      const supabase = await createServerClient()
      if (orgIds.length === 0) {
        return { data: [], error: null }
      }
      return supabase
        .from('studies')
        .select('id, name, status')
        .in('organization_id', orgIds)
        .order('name')
        .limit(6)
    })(),
  ])

  const studies = studiesResult.data ?? []

  // Build operational alert strip from real data
  const criticalAlerts: OpsAlert[] = []
  const watchAlerts: OpsAlert[] = []

  const overdueCount  = rawAlerts.filter(a => a.alertType === 'missed' || a.alertType === 'out_of_window').length
  const upcomingCount = rawAlerts.filter(a => a.alertType === 'approaching').length
  const reminderCount = rawAlerts.filter(a => a.alertType === 'reminder_pending').length
  const overdueSchedCount = rawAlerts.filter(a => a.alertType === 'overdue_scheduling').length

  if (overdueCount > 0)     criticalAlerts.push({ id: 'overdue',  severity: 'critical', title: 'Overdue / Out of Window', count: overdueCount })
  if (upcomingCount > 0)    watchAlerts.push({ id: 'upcoming', severity: 'watch', title: 'Approaching Windows', count: upcomingCount })
  if (reminderCount > 0)    watchAlerts.push({ id: 'reminder', severity: 'watch', title: 'Pending Reminders',   count: reminderCount })
  if (overdueSchedCount > 0) watchAlerts.push({ id: 'sched',   severity: 'watch', title: 'Needs Scheduling',   count: overdueSchedCount })

  // Visit summary
  const completedToday   = todayVisits.filter(v => v.visitStatus === 'completed' || v.visitStatus === 'locked').length
  const inProgressToday  = todayVisits.filter(v => v.visitStatus === 'in_progress' || v.visitStatus === 'checked_in').length

  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })

  return (
    <div className="flex flex-col h-full bg-accent">
      {/* Alert Strip */}
      <AlertStrip alerts={[...criticalAlerts, ...watchAlerts]} />

      {/* Command Header */}
      <div className="px-6 py-4 bg-card border-b flex items-center justify-between" >
        <div>
          <h1 className="heading-serif text-xl text-foreground">Operations</h1>
          <p className="text-xs text-muted-foreground mt-0.5">{today}</p>
        </div>
        <div className="flex items-center gap-4 px-4 py-2 rounded-xl bg-card border" >
          <div className="text-center">
            <p className="text-lg font-bold text-foreground">{todayVisits.length}</p>
            <p className="text-[10px] text-muted-foreground">Today&apos;s Visits</p>
          </div>
          <div className="w-px h-8 bg-border" />
          <div className="text-center">
            <p className="text-lg font-bold text-primary">{completedToday}</p>
            <p className="text-[10px] text-muted-foreground">Complete</p>
          </div>
          <div className="w-px h-8 bg-border" />
          <div className="text-center">
            <p className="text-lg font-bold text-amber-500">{inProgressToday}</p>
            <p className="text-[10px] text-muted-foreground">In Progress</p>
          </div>
          <div className="w-px h-8 bg-border" />
          <div className="text-center">
            <p className="text-lg font-bold text-red-500">{rawAlerts.filter(a => a.alertType === 'missed' || a.alertType === 'out_of_window').length}</p>
            <p className="text-[10px] text-muted-foreground">Alerts</p>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 overflow-y-auto bg-accent p-6 scrollbar-thin">
        <div className="grid grid-cols-3 gap-6 max-w-[1400px]">

          {/* LEFT — Today's Visit Queue (2/3) */}
          <div className="col-span-2 space-y-5">

            {/* Today's visits */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-primary" />
                  <h2 className="text-sm font-semibold text-foreground">Today&apos;s Visit Queue</h2>
                  {todayVisits.length > 0 && (
                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700">
                      {todayVisits.length}
                    </span>
                  )}
                </div>
                <Link href="/studies" className="text-xs text-primary hover:underline flex items-center gap-1">
                  View studies <ChevronRight className="w-3 h-3" />
                </Link>
              </div>

              {todayVisits.length === 0 ? (
                <div className="vilo-card p-8 text-center">
                  <Calendar className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
                  <p className="text-sm font-medium text-foreground mb-1">No visits scheduled for today</p>
                  <p className="text-xs text-muted-foreground">
                    All visits with a scheduled date of today will appear here automatically.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  {todayVisits.map(v => <TodayVisitCard key={v.visitId} visit={v} />)}
                </div>
              )}
            </div>

            {/* Operational alerts from real DB */}
            {rawAlerts.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <AlertCircle className="w-4 h-4 text-amber-500" />
                  <h2 className="text-sm font-semibold text-foreground">Visit Alerts</h2>
                  <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700">
                    {rawAlerts.length}
                  </span>
                </div>
                <div className="space-y-2">
                  {rawAlerts.slice(0, 8).map(alert => (
                    <div
                      key={alert.id}
                      className={`flex items-center gap-3 p-3 rounded-lg border ${
                        alert.alertType === 'missed' || alert.alertType === 'out_of_window'
                          ? 'bg-red-50 border-red-100'
                          : 'bg-amber-50 border-amber-100'
                      }`}
                    >
                      {alert.alertType === 'missed' || alert.alertType === 'out_of_window' ? (
                        <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0" />
                      ) : (
                        <Clock className="w-4 h-4 text-amber-500 flex-shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-foreground truncate">
                          {alert.subjectIdentifier} — {alert.visitLabel}
                        </p>
                        <p className="text-[10px] text-muted-foreground capitalize">
                          {alert.alertType.replace(/_/g, ' ')}
                          {alert.scheduledDate ? ` · ${alert.scheduledDate}` : ''}
                        </p>
                      </div>
                      <Link
                        href={alert.href}
                        className="text-[10px] text-primary hover:underline flex-shrink-0"
                      >
                        View →
                      </Link>
                    </div>
                  ))}
                  {rawAlerts.length > 8 && (
                    <p className="text-xs text-muted-foreground text-center pt-1">
                      +{rawAlerts.length - 8} more alerts — review in Studies
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Pending source / signatures — STUB */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <FileText className="w-4 h-4 text-muted-foreground" />
                <h2 className="text-sm font-semibold text-foreground">Pending Source & Signatures</h2>
              </div>
              <div className="vilo-card p-5">
                <div className="grid grid-cols-3 gap-4">
                  {[
                    { icon: FileText, label: 'Incomplete Source', color: 'text-amber-500' },
                    { icon: PenTool,  label: 'Pending PI Sign',   color: 'text-orange-500' },
                    { icon: FlaskConical, label: 'Lab Reconciliation', color: 'text-muted-foreground' },
                  ].map(({ icon: Icon, label, color }) => (
                    <div key={label} className="text-center p-4 rounded-lg bg-muted" >
                      <Icon className={`w-5 h-5 ${color} mx-auto mb-2`} />
                      <p className="text-xl font-bold text-muted-foreground">—</p>
                      <p className="text-xs text-muted-foreground">{label}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* RIGHT — Quick access + stubs */}
          <div className="space-y-5">

            {/* Quick Study Access */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Activity className="w-4 h-4 text-primary" />
                  <h2 className="text-sm font-semibold text-foreground">Active Studies</h2>
                </div>
                <Link href="/studies" className="text-xs text-primary hover:underline flex items-center gap-1">
                  All <ChevronRight className="w-3 h-3" />
                </Link>
              </div>
              <div className="space-y-2">
                {!studies.length ? (
                  <div className="vilo-card p-4 text-center">
                    <p className="text-xs text-muted-foreground">No studies visible</p>
                  </div>
                ) : (
                  studies.map(study => (
                    <Link
                      key={study.id}
                      href={`/studies/${study.id}`}
                      className="flex items-center gap-3 p-3 vilo-card-interactive"
                    >
                      <div className="w-2 h-8 rounded-full bg-primary flex-shrink-0"  />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-foreground truncate">{study.name}</p>
                        <p className="text-[10px] text-muted-foreground capitalize">{study.status ?? '—'}</p>
                      </div>
                      <ChevronRight className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                    </Link>
                  ))
                )}
              </div>
            </div>

            {/* Coordinator Queue STUB */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Users className="w-4 h-4 text-muted-foreground" />
                <h2 className="text-sm font-semibold text-foreground">Coordinator Queue</h2>
              </div>
              <div className="vilo-card p-4">
                <p className="text-xs text-muted-foreground text-center py-4 italic">
                  Coordinator workload view coming soon.
                </p>
              </div>
            </div>

            {/* Upcoming windows STUB */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Timer className="w-4 h-4 text-muted-foreground" />
                <h2 className="text-sm font-semibold text-foreground">Upcoming Windows</h2>
              </div>
              <div className="vilo-card p-4">
                {rawAlerts.filter(a => a.alertType === 'overdue_scheduling').length > 0 ? (
                  <div className="space-y-2">
                    {rawAlerts.filter(a => a.alertType === 'overdue_scheduling').slice(0, 4).map(a => (
                      <Link
                        key={a.id}
                        href={a.href}
                        className="flex items-center gap-2 p-2 rounded-lg hover:bg-muted transition-colors"
                      >
                        <Timer className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-[10px] font-medium text-foreground truncate">{a.subjectIdentifier} · {a.visitLabel}</p>
                          <p className="text-[10px] text-muted-foreground">Window closes {a.windowEndDate ?? '—'}</p>
                        </div>
                      </Link>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground text-center py-3 italic">
                    No urgent scheduling needs.
                  </p>
                )}
              </div>
            </div>

            {/* Unresolved Findings STUB */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <AlertCircle className="w-4 h-4 text-muted-foreground" />
                <h2 className="text-sm font-semibold text-foreground">Unresolved Findings</h2>
              </div>
              <div className="vilo-card p-4">
                <div className="flex items-center gap-2 justify-center py-2">
                  <CheckCircle2 className="w-4 h-4 text-primary" />
                  <p className="text-xs text-muted-foreground">Findings tracker coming soon.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
