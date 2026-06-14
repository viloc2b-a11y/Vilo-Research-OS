import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ChevronLeft, FileCheck } from 'lucide-react'
import { getSessionUser, getPrimaryOrganizationId } from '@/lib/auth/session'
import { createServerClient } from '@/lib/supabase/server'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type StudyRow = {
  id: string
  name: string
}

type IRBApprovalDbRow = {
  id: string
  study_id: string
  organization_id: string
  approval_type: string
  approval_number: string | null
  approved_date: string
  expiration_date: string | null
  submission_date: string | null
  next_renewal_due_date: string | null
  status: string
  notes: string | null
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function daysUntilExpiration(expirationDate: string | null): number | null {
  if (!expirationDate) return null
  const now = Date.UTC(
    new Date().getUTCFullYear(),
    new Date().getUTCMonth(),
    new Date().getUTCDate(),
  )
  const target = new Date(expirationDate)
  const t = Date.UTC(target.getUTCFullYear(), target.getUTCMonth(), target.getUTCDate())
  return Math.floor((t - now) / 86_400_000)
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

function formatApprovalType(type: string): string {
  return type
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

type StatusBadgeProps = {
  status: string
  days: number | null
}

function StatusBadge({ status, days }: StatusBadgeProps) {
  let cls = 'bg-slate-50 text-slate-600 border-slate-200'

  if (status === 'expired' || (days !== null && days < 0)) {
    cls = 'bg-red-50 text-red-700 border-red-200'
  } else if (days !== null && days <= 30) {
    cls = 'bg-orange-50 text-orange-700 border-orange-200'
  } else if (days !== null && days <= 60) {
    cls = 'bg-yellow-50 text-yellow-700 border-yellow-200'
  } else if (status === 'active') {
    cls = 'bg-green-50 text-green-700 border-green-200'
  } else if (status === 'pending_renewal') {
    cls = 'bg-blue-50 text-blue-700 border-blue-200'
  }

  const label = status
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')

  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${cls}`}>
      {label}
    </span>
  )
}

function DaysBadge({ days }: { days: number | null }) {
  if (days === null) return <span className="text-muted-foreground">—</span>
  if (days < 0)
    return <span className="font-semibold text-red-600">{Math.abs(days)}d overdue</span>
  if (days <= 30)
    return <span className="font-semibold text-orange-600">{days}d</span>
  if (days <= 60)
    return <span className="font-semibold text-yellow-700">{days}d</span>
  return <span className="text-foreground">{days}d</span>
}

// ---------------------------------------------------------------------------
// Summary bar
// ---------------------------------------------------------------------------

type SummaryBarProps = {
  totalActive: number
  totalExpiringSoon: number
  totalExpired: number
}

function SummaryBar({ totalActive, totalExpiringSoon, totalExpired }: SummaryBarProps) {
  return (
    <div className="flex flex-wrap items-center gap-4 rounded-lg border border-border bg-card px-4 py-3">
      <span className="text-sm text-muted-foreground">
        <span className="font-semibold text-foreground">{totalActive}</span> active
      </span>
      {totalExpiringSoon > 0 && (
        <span className="inline-flex items-center gap-1.5 rounded-full border border-yellow-200 bg-yellow-50 px-3 py-1 text-xs font-semibold text-yellow-700">
          {totalExpiringSoon} expiring ≤60d
        </span>
      )}
      {totalExpired > 0 && (
        <span className="inline-flex items-center gap-1.5 rounded-full border border-red-200 bg-red-50 px-3 py-1 text-xs font-semibold text-red-700">
          {totalExpired} expired
        </span>
      )}
      {totalExpiringSoon === 0 && totalExpired === 0 && totalActive > 0 && (
        <span className="inline-flex items-center gap-1.5 rounded-full border border-green-200 bg-green-50 px-3 py-1 text-xs font-semibold text-green-700">
          All current
        </span>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Table
// ---------------------------------------------------------------------------

type IRBTableProps = {
  approvals: IRBApprovalDbRow[]
  studiesById: Map<string, StudyRow>
}

function IRBTable({ approvals, studiesById }: IRBTableProps) {
  if (approvals.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card px-4 py-8 text-center">
        <p className="text-sm text-muted-foreground">No IRB approvals found for this organization.</p>
      </div>
    )
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/40">
            <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Study</th>
            <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Approval Type</th>
            <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Approval #</th>
            <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Approved</th>
            <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Expires</th>
            <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Next Renewal</th>
            <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">Days Left</th>
            <th className="px-4 py-2.5 text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {approvals.map((row) => {
            const study = studiesById.get(row.study_id)
            const days = daysUntilExpiration(row.expiration_date)
            return (
              <tr key={row.id} className="bg-card hover:bg-muted/30 transition-colors">
                <td className="px-4 py-2.5 font-medium text-foreground">
                  {study?.name ?? <span className="text-muted-foreground text-xs">{row.study_id.slice(0, 8)}…</span>}
                </td>
                <td className="px-4 py-2.5 text-foreground">{formatApprovalType(row.approval_type)}</td>
                <td className="px-4 py-2.5 font-mono text-xs text-foreground">{row.approval_number ?? '—'}</td>
                <td className="px-4 py-2.5 text-foreground">{formatDate(row.approved_date)}</td>
                <td className="px-4 py-2.5 text-foreground">{formatDate(row.expiration_date)}</td>
                <td className="px-4 py-2.5 text-foreground">{formatDate(row.next_renewal_due_date)}</td>
                <td className="px-4 py-2.5 text-right tabular-nums">
                  <DaysBadge days={days} />
                </td>
                <td className="px-4 py-2.5 text-center">
                  <StatusBadge status={row.status} days={days} />
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

export default async function IRBApprovalsPage() {
  const user = await getSessionUser()
  if (!user) redirect('/login')

  const organizationId = await getPrimaryOrganizationId(user.id)

  if (!organizationId) {
    return (
      <div className="flex flex-col h-full bg-accent">
        <div className="px-6 py-5 bg-card border-b border-border">
          <h1 className="heading-serif text-xl text-foreground">IRB Approvals</h1>
          <p className="text-sm text-muted-foreground">No organization access found.</p>
        </div>
      </div>
    )
  }

  const supabase = await createServerClient()

  const [{ data: studyRows }, { data: allApprovals }] = await Promise.all([
    supabase
      .from('studies')
      .select('id, name')
      .eq('organization_id', organizationId)
      .neq('status', 'archived')
      .order('name'),
    supabase
      .from('irb_approvals')
      .select('*')
      .eq('organization_id', organizationId)
      .order('expiration_date', { ascending: true, nullsFirst: false }),
  ])

  const studies = (studyRows ?? []) as StudyRow[]
  const approvals = (allApprovals ?? []) as IRBApprovalDbRow[]

  const studiesById = new Map(studies.map((s) => [s.id, s]))

  const today = new Date().toISOString().slice(0, 10)

  const totalActive = approvals.filter((a) => a.status === 'active').length
  const totalExpired = approvals.filter(
    (a) => a.status === 'expired' || (a.expiration_date !== null && a.expiration_date < today),
  ).length
  const totalExpiringSoon = approvals.filter((a) => {
    const days = daysUntilExpiration(a.expiration_date)
    return days !== null && days >= 0 && days <= 60 && a.status !== 'expired'
  }).length

  return (
    <div className="flex flex-col h-full bg-accent">
      {/* Header */}
      <div className="px-6 py-5 bg-card border-b border-border">
        <Link
          href="/regulatory-intelligence"
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mb-2"
        >
          <ChevronLeft className="w-3 h-3" />
          Regulatory Intelligence
        </Link>
        <h1 className="heading-serif text-xl text-foreground flex items-center gap-2">
          <FileCheck className="w-5 h-5 text-blue-500" />
          IRB Approvals
        </h1>
        <p className="text-sm text-muted-foreground">
          All IRB approvals across studies with expiration tracking.
        </p>
      </div>

      <div className="vilo-ops-scroll min-h-0 flex-1 overflow-y-auto p-6 scrollbar-thin space-y-6">
        <SummaryBar
          totalActive={totalActive}
          totalExpiringSoon={totalExpiringSoon}
          totalExpired={totalExpired}
        />

        <IRBTable approvals={approvals} studiesById={studiesById} />
      </div>
    </div>
  )
}
