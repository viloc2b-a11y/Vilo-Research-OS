// app/(ops)/capa/page.tsx
// CAPA Actions Dashboard — org-level view of all corrective and preventive actions.

import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ClipboardCheck, AlertCircle, Clock } from 'lucide-react'
import { getSessionUser } from '@/lib/auth/session'
import { getPrimaryOrganizationId } from '@/lib/auth/session'
import { createServerClient } from '@/lib/supabase/server'
import { loadCapaActions } from '@/lib/capa-runtime/load-capa-actions'
import type { CapaActionRow, CapaStatus } from '@/lib/capa-runtime/capa-types'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type DeviationRow = {
  id: string
  deviation_type: string | null
  description: string | null
  study_id: string
}

type StudyRow = {
  id: string
  name: string
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const STATUS_LABELS: Record<CapaStatus, string> = {
  open: 'Open',
  in_progress: 'In Progress',
  under_review: 'Under Review',
  completed: 'Completed',
  verified: 'Verified',
  closed: 'Closed',
}

const STATUS_BADGE: Record<CapaStatus, string> = {
  open: 'bg-red-50 text-red-700 border-red-200',
  in_progress: 'bg-blue-50 text-blue-700 border-blue-200',
  under_review: 'bg-purple-50 text-purple-700 border-purple-200',
  completed: 'bg-yellow-50 text-yellow-700 border-yellow-200',
  verified: 'bg-green-50 text-green-700 border-green-200',
  closed: 'bg-slate-50 text-slate-500 border-slate-200',
}

const OPEN_STATUSES: CapaStatus[] = ['open', 'in_progress']
const INACTIVE_STATUSES: CapaStatus[] = ['completed', 'verified', 'closed']

function isOverdue(action: CapaActionRow, today: string): boolean {
  return (
    action.dueDate !== null &&
    action.dueDate < today &&
    !INACTIVE_STATUSES.includes(action.capaStatus)
  )
}

function isEffectivenessPending(action: CapaActionRow): boolean {
  return (
    action.effectivenessCheckRequired &&
    action.effectivenessCheckResult === 'pending' &&
    action.capaStatus === 'completed'
  )
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

type KpiChipProps = {
  label: string
  value: number
  icon: React.ElementType
  danger?: boolean
  warn?: boolean
}

function KpiChip({ label, value, icon: Icon, danger, warn }: KpiChipProps) {
  const cls =
    danger && value > 0
      ? 'bg-red-50 border-red-200 text-red-700'
      : warn && value > 0
      ? 'bg-amber-50 border-amber-200 text-amber-700'
      : 'bg-card border-border text-foreground'

  const iconCls =
    danger && value > 0
      ? 'text-red-500'
      : warn && value > 0
      ? 'text-amber-500'
      : 'text-muted-foreground'

  return (
    <div className={`flex items-center gap-3 rounded-lg border px-4 py-3 ${cls}`}>
      <Icon className={`w-4 h-4 flex-shrink-0 ${iconCls}`} />
      <div>
        <p className="text-xl font-bold leading-none">{value}</p>
        <p className="text-xs mt-0.5 opacity-75">{label}</p>
      </div>
    </div>
  )
}

function StatusBadge({ status }: { status: CapaStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${STATUS_BADGE[status]}`}
    >
      {STATUS_LABELS[status]}
    </span>
  )
}

type CapaTableProps = {
  actions: CapaActionRow[]
  deviationsById: Map<string, DeviationRow>
  studiesById: Map<string, StudyRow>
  today: string
}

function CapaTable({ actions, deviationsById, studiesById, today }: CapaTableProps) {
  if (actions.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card px-6 py-12 text-center">
        <p className="text-sm text-muted-foreground">
          No CAPA actions on record for this organization.
        </p>
      </div>
    )
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/40">
            <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Study
            </th>
            <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Deviation
            </th>
            <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Status
            </th>
            <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Owner
            </th>
            <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Due Date
            </th>
            <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Corrective Action
            </th>
            <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Effectiveness
            </th>
            <th className="px-4 py-2.5" />
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {actions.map((action) => {
            const deviation = deviationsById.get(action.deviationId)
            const study = studiesById.get(action.studyId)
            const overdue = isOverdue(action, today)
            const effectPending = isEffectivenessPending(action)

            return (
              <tr key={action.id} className="bg-card hover:bg-muted/30 transition-colors">
                <td className="px-4 py-3 text-xs text-foreground">
                  {study?.name ?? <span className="text-muted-foreground">—</span>}
                </td>
                <td className="px-4 py-3">
                  {deviation ? (
                    <div>
                      <p className="font-mono text-xs font-medium text-foreground">
                        {deviation.deviation_type?.replace(/_/g, ' ') ?? '—'}
                      </p>
                      {deviation.description && (
                        <p className="text-xs text-muted-foreground line-clamp-1 max-w-[14rem]">
                          {deviation.description}
                        </p>
                      )}
                    </div>
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={action.capaStatus} />
                </td>
                <td className="px-4 py-3 text-xs text-muted-foreground">
                  {action.ownerId ?? '—'}
                </td>
                <td className={`px-4 py-3 text-xs ${overdue ? 'text-red-600 font-semibold' : 'text-foreground'}`}>
                  {action.dueDate
                    ? new Date(action.dueDate).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                      })
                    : <span className="text-muted-foreground">—</span>}
                  {overdue && (
                    <span className="ml-1 text-red-500 text-[10px] font-medium">OVERDUE</span>
                  )}
                </td>
                <td className="px-4 py-3 text-xs text-foreground max-w-[18rem]">
                  <p className="line-clamp-2">{action.correctiveAction}</p>
                </td>
                <td className="px-4 py-3 text-xs">
                  {action.effectivenessCheckRequired ? (
                    <span
                      className={
                        effectPending
                          ? 'text-amber-700 font-medium'
                          : action.effectivenessCheckResult === 'pass'
                          ? 'text-green-700 font-medium'
                          : action.effectivenessCheckResult === 'fail'
                          ? 'text-red-700 font-medium'
                          : 'text-muted-foreground'
                      }
                    >
                      {action.effectivenessCheckResult === null
                        ? 'Required'
                        : action.effectivenessCheckResult === 'pending'
                        ? 'Pending'
                        : action.effectivenessCheckResult === 'pass'
                        ? 'Pass'
                        : action.effectivenessCheckResult === 'fail'
                        ? 'Fail'
                        : 'N/A'}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </td>
                <td className="px-4 py-3 text-xs">
                  <Link
                    href={`/capa/${action.id}`}
                    className="text-primary font-medium hover:underline"
                  >
                    View
                  </Link>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function CapaPage() {
  const user = await getSessionUser()
  if (!user) redirect('/login')

  const organizationId = await getPrimaryOrganizationId(user.id)

  if (!organizationId) {
    return (
      <div className="flex flex-col h-full bg-accent">
        <div className="px-6 py-5 bg-card border-b border-border">
          <h1 className="heading-serif text-xl text-foreground">CAPA Actions</h1>
          <p className="text-sm text-muted-foreground">No organization access found.</p>
        </div>
      </div>
    )
  }

  const supabase = await createServerClient()

  const capaActions = await loadCapaActions(supabase, { organizationId })

  // Load associated deviations for context labels
  const deviationIds = [...new Set(capaActions.map((c) => c.deviationId))]
  const { data: deviationsRaw } = deviationIds.length > 0
    ? await supabase
        .from('protocol_deviations')
        .select('id, deviation_type, description, study_id')
        .in('id', deviationIds)
    : { data: [] as DeviationRow[] }

  const deviations = (deviationsRaw ?? []) as DeviationRow[]

  // Load study names for context
  const studyIds = [...new Set(capaActions.map((c) => c.studyId))]
  const { data: studiesRaw } = studyIds.length > 0
    ? await supabase
        .from('studies')
        .select('id, name')
        .in('id', studyIds)
    : { data: [] as StudyRow[] }

  const studies = (studiesRaw ?? []) as StudyRow[]

  // Build lookup maps
  const deviationsById = new Map(deviations.map((d) => [d.id, d]))
  const studiesById = new Map(studies.map((s) => [s.id, s]))

  // Compute KPIs
  const today = new Date().toISOString().slice(0, 10)
  const totalOpen = capaActions.filter((a) => OPEN_STATUSES.includes(a.capaStatus)).length
  const totalOverdue = capaActions.filter((a) => isOverdue(a, today)).length
  const totalEffectivenessPending = capaActions.filter(isEffectivenessPending).length

  return (
    <div className="flex flex-col h-full bg-accent">
      {/* Header */}
      <div className="px-6 py-5 bg-card border-b border-border">
        <h1 className="heading-serif text-xl text-foreground flex items-center gap-2">
          <ClipboardCheck className="w-5 h-5 text-blue-500" />
          CAPA Actions
        </h1>
        <p className="text-sm text-muted-foreground">
          Corrective and preventive actions linked to protocol deviations.
        </p>
      </div>

      <div className="vilo-ops-scroll min-h-0 flex-1 overflow-y-auto p-6 scrollbar-thin space-y-6">
        {/* Summary bar */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <KpiChip
            label="Open (open + in progress)"
            value={totalOpen}
            icon={ClipboardCheck}
            warn
          />
          <KpiChip
            label="Overdue"
            value={totalOverdue}
            icon={Clock}
            danger
          />
          <KpiChip
            label="Effectiveness Check Pending"
            value={totalEffectivenessPending}
            icon={AlertCircle}
            warn
          />
        </div>

        {/* CAPA table */}
        <CapaTable
          actions={capaActions}
          deviationsById={deviationsById}
          studiesById={studiesById}
          today={today}
        />
      </div>
    </div>
  )
}
