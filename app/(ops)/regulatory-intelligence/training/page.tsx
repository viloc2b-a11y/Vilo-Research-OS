import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ChevronLeft, BookOpen } from 'lucide-react'
import { getSessionUser, getPrimaryOrganizationId } from '@/lib/auth/session'
import { createServerClient } from '@/lib/supabase/server'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type TrainingStudySummary = {
  studyId: string
  studyName: string
  total: number
  completed: number
  overdue: number
  pending: number
}

type AssignmentRow = {
  study_id: string
  training_status: string
  due_date: string | null
  trainee_name: string
  study_training_items: { training_topic: string | null; training_type: string | null } | null
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const INCOMPLETE_STATUSES = new Set([
  'Assigned',
  'Pending Trainee Signature',
  'Pending Trainer Signature',
  'Pending PI Acknowledgment',
  'Reopened',
])

const COMPLETE_STATUSES = new Set(['Completed', 'Locked'])

function today() {
  return new Date().toISOString().slice(0, 10)
}

function StatusChip({ status, count }: { status: 'ok' | 'warning' | 'critical' | 'neutral'; count: number }) {
  const cls = {
    ok:       'bg-green-50 text-green-700 border-green-200',
    warning:  'bg-yellow-50 text-yellow-700 border-yellow-200',
    critical: 'bg-red-50 text-red-700 border-red-200',
    neutral:  'bg-slate-50 text-slate-600 border-slate-200',
  }[status]

  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold tabular-nums ${cls}`}>
      {count}
    </span>
  )
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function TrainingIntelligencePage() {
  const user = await getSessionUser()
  if (!user) redirect('/login')

  const organizationId = await getPrimaryOrganizationId(user.id)
  if (!organizationId) redirect('/login')

  const supabase = await createServerClient()
  const todayStr = today()

  // Fetch all studies for org
  const { data: studyRows } = await supabase
    .from('studies')
    .select('id, name')
    .eq('organization_id', organizationId)
    .neq('status', 'archived')
    .order('name', { ascending: true })

  const studies = (studyRows ?? []) as { id: string; name: string }[]
  const studyIds = studies.map((s) => s.id)
  const studyNameById = new Map(studies.map((s) => [s.id, s.name]))

  // Fetch all assignments across studies in one query
  const { data: assignmentRows } = await supabase
    .from('study_training_assignments')
    .select('study_id, training_status, due_date, trainee_name, study_training_items(training_topic, training_type)')
    .eq('organization_id', organizationId)
    .in('study_id', studyIds.length > 0 ? studyIds : ['00000000-0000-0000-0000-000000000000'])
    .order('due_date', { ascending: true, nullsFirst: false })
    .limit(500)

  // Aggregate counts per study
  const summaryMap = new Map<string, TrainingStudySummary>()

  for (const row of (assignmentRows ?? []) as unknown as AssignmentRow[]) {
    const sid = row.study_id
    if (!summaryMap.has(sid)) {
      summaryMap.set(sid, {
        studyId: sid,
        studyName: studyNameById.get(sid) ?? sid,
        total: 0,
        completed: 0,
        overdue: 0,
        pending: 0,
      })
    }
    const s = summaryMap.get(sid)!
    s.total += 1

    if (COMPLETE_STATUSES.has(row.training_status)) {
      s.completed += 1
    } else if (INCOMPLETE_STATUSES.has(row.training_status)) {
      const isOverdue = row.due_date !== null && row.due_date < todayStr
      if (isOverdue) {
        s.overdue += 1
      } else {
        s.pending += 1
      }
    }
  }

  const summaries: TrainingStudySummary[] = studies.map((study) =>
    summaryMap.get(study.id) ?? {
      studyId: study.id,
      studyName: study.name,
      total: 0,
      completed: 0,
      overdue: 0,
      pending: 0,
    },
  )

  const totalOverdue = summaries.reduce((acc, s) => acc + s.overdue, 0)
  const totalPending = summaries.reduce((acc, s) => acc + s.pending, 0)
  const totalCompleted = summaries.reduce((acc, s) => acc + s.completed, 0)
  const totalAll = summaries.reduce((acc, s) => acc + s.total, 0)

  return (
    <div className="flex flex-col h-full bg-accent">
      {/* Header */}
      <div className="px-6 py-5 bg-card border-b border-border">
        <div className="flex items-center gap-2 mb-1">
          <Link
            href="/regulatory-intelligence"
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <ChevronLeft className="w-3 h-3" />
            Regulatory Intelligence
          </Link>
        </div>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="heading-serif text-xl text-foreground flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-muted-foreground" />
              Training Intelligence
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Training assignment compliance across all active studies.
            </p>
          </div>
          <div className="flex items-center gap-4 shrink-0 text-sm">
            <div className="text-center">
              <div className="text-lg font-semibold tabular-nums text-foreground">{totalAll}</div>
              <div className="text-xs text-muted-foreground">Total</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-semibold tabular-nums text-green-700">{totalCompleted}</div>
              <div className="text-xs text-muted-foreground">Completed</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-semibold tabular-nums text-yellow-700">{totalPending}</div>
              <div className="text-xs text-muted-foreground">Pending</div>
            </div>
            {totalOverdue > 0 && (
              <div className="text-center">
                <div className="text-lg font-semibold tabular-nums text-red-600">{totalOverdue}</div>
                <div className="text-xs text-muted-foreground">Overdue</div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        {summaries.length === 0 ? (
          <div className="rounded-xl border border-border bg-card px-4 py-8 text-center">
            <p className="text-sm text-muted-foreground">No active studies found.</p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Study
                  </th>
                  <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Total
                  </th>
                  <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Completed
                  </th>
                  <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Pending
                  </th>
                  <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Overdue
                  </th>
                  <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Completion
                  </th>
                  <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {summaries.map((s) => {
                  const pct = s.total > 0 ? Math.round((s.completed / s.total) * 100) : 100
                  const statusTone =
                    s.overdue > 0 ? 'critical' : s.pending > 0 ? 'warning' : 'ok'
                  const statusLabel =
                    s.total === 0
                      ? 'No assignments'
                      : s.overdue > 0
                        ? 'Overdue'
                        : s.pending > 0
                          ? 'In progress'
                          : 'Complete'

                  return (
                    <tr key={s.studyId} className="bg-card hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-2.5 font-medium text-foreground">
                        <Link
                          href={`/studies/${s.studyId}/workspace`}
                          className="hover:underline"
                        >
                          {s.studyName}
                        </Link>
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-muted-foreground">
                        {s.total}
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-green-700 font-medium">
                        {s.completed}
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums">
                        <StatusChip status={s.pending > 0 ? 'warning' : 'neutral'} count={s.pending} />
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums">
                        <StatusChip status={s.overdue > 0 ? 'critical' : 'neutral'} count={s.overdue} />
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-muted-foreground">
                        {s.total === 0 ? '—' : `${pct}%`}
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <span
                          className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${
                            statusTone === 'critical'
                              ? 'bg-red-50 text-red-700 border-red-200'
                              : statusTone === 'warning'
                                ? 'bg-yellow-50 text-yellow-700 border-yellow-200'
                                : s.total === 0
                                  ? 'bg-slate-50 text-slate-500 border-slate-200'
                                  : 'bg-green-50 text-green-700 border-green-200'
                          }`}
                        >
                          {statusLabel}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
