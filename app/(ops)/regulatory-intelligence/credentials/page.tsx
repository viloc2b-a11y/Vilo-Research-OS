import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ChevronLeft, UserCheck } from 'lucide-react'
import { getSessionUser, getPrimaryOrganizationId } from '@/lib/auth/session'
import { createServerClient } from '@/lib/supabase/server'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type StudyRow = {
  id: string
  name: string
}

type CredentialDbRow = {
  id: string
  organization_id: string
  user_id: string
  credential_type: string
  study_id: string | null
  issue_date: string | null
  expiration_date: string | null
  credential_number: string | null
  status: string
  notes: string | null
  created_at: string
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

function formatCredentialType(type: string): string {
  return type
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

function StatusBadge({ status, days }: { status: string; days: number | null }) {
  let cls = 'bg-slate-50 text-slate-600 border-slate-200'

  if (status === 'expired' || (days !== null && days < 0)) {
    cls = 'bg-red-50 text-red-700 border-red-200'
  } else if (days !== null && days <= 30) {
    cls = 'bg-orange-50 text-orange-700 border-orange-200'
  } else if (days !== null && days <= 60) {
    cls = 'bg-yellow-50 text-yellow-700 border-yellow-200'
  } else if (status === 'current') {
    cls = 'bg-green-50 text-green-700 border-green-200'
  } else if (status === 'expiring_soon') {
    cls = 'bg-yellow-50 text-yellow-700 border-yellow-200'
  } else if (status === 'pending') {
    cls = 'bg-blue-50 text-blue-700 border-blue-200'
  } else if (status === 'waived') {
    cls = 'bg-slate-50 text-slate-500 border-slate-200'
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
  totalCurrent: number
  totalExpiringSoon: number
  totalExpired: number
}

function SummaryBar({ totalCurrent, totalExpiringSoon, totalExpired }: SummaryBarProps) {
  return (
    <div className="flex flex-wrap items-center gap-4 rounded-lg border border-border bg-card px-4 py-3">
      <span className="text-sm text-muted-foreground">
        <span className="font-semibold text-foreground">{totalCurrent}</span> current
      </span>
      {totalExpiringSoon > 0 && (
        <span className="inline-flex items-center gap-1.5 rounded-full border border-yellow-200 bg-yellow-50 px-3 py-1 text-xs font-semibold text-yellow-700">
          {totalExpiringSoon} expiring soon
        </span>
      )}
      {totalExpired > 0 && (
        <span className="inline-flex items-center gap-1.5 rounded-full border border-red-200 bg-red-50 px-3 py-1 text-xs font-semibold text-red-700">
          {totalExpired} expired
        </span>
      )}
      {totalExpiringSoon === 0 && totalExpired === 0 && totalCurrent > 0 && (
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

type CredentialsTableProps = {
  credentials: CredentialDbRow[]
  studiesById: Map<string, StudyRow>
}

function CredentialsTable({ credentials, studiesById }: CredentialsTableProps) {
  if (credentials.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card px-4 py-8 text-center">
        <p className="text-sm text-muted-foreground">No staff credentials found for this organization.</p>
      </div>
    )
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/40">
            <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">User</th>
            <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Credential Type</th>
            <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Study Scope</th>
            <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Issued</th>
            <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Expires</th>
            <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">Days Left</th>
            <th className="px-4 py-2.5 text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {credentials.map((row) => {
            const study = row.study_id ? studiesById.get(row.study_id) : null
            const days = daysUntilExpiration(row.expiration_date)
            return (
              <tr key={row.id} className="bg-card hover:bg-muted/30 transition-colors">
                <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">
                  {row.user_id.slice(0, 8)}…
                </td>
                <td className="px-4 py-2.5 text-foreground">
                  {formatCredentialType(row.credential_type)}
                </td>
                <td className="px-4 py-2.5 text-foreground">
                  {study ? (
                    <span>{study.name}</span>
                  ) : row.study_id ? (
                    <span className="font-mono text-xs text-muted-foreground">{row.study_id.slice(0, 8)}…</span>
                  ) : (
                    <span className="text-muted-foreground text-xs">Org-wide</span>
                  )}
                </td>
                <td className="px-4 py-2.5 text-foreground">{formatDate(row.issue_date)}</td>
                <td className="px-4 py-2.5 text-foreground">{formatDate(row.expiration_date)}</td>
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

export default async function StaffCredentialsPage() {
  const user = await getSessionUser()
  if (!user) redirect('/login')

  const organizationId = await getPrimaryOrganizationId(user.id)

  if (!organizationId) {
    return (
      <div className="flex flex-col h-full bg-accent">
        <div className="px-6 py-5 bg-card border-b border-border">
          <h1 className="heading-serif text-xl text-foreground">Staff Credentials</h1>
          <p className="text-sm text-muted-foreground">No organization access found.</p>
        </div>
      </div>
    )
  }

  const supabase = await createServerClient()

  const [{ data: allCredentials }, { data: studyRows }] = await Promise.all([
    supabase
      .from('investigator_credentials')
      .select('*')
      .eq('organization_id', organizationId)
      .order('expiration_date', { ascending: true, nullsFirst: false }),
    supabase
      .from('studies')
      .select('id, name')
      .eq('organization_id', organizationId)
      .neq('status', 'archived'),
  ])

  const credentials = (allCredentials ?? []) as CredentialDbRow[]
  const studies = (studyRows ?? []) as StudyRow[]

  const studiesById = new Map(studies.map((s) => [s.id, s]))

  const today = new Date().toISOString().slice(0, 10)

  const totalCurrent = credentials.filter((c) => c.status === 'current').length
  const totalExpired = credentials.filter(
    (c) => c.status === 'expired' || (c.expiration_date !== null && c.expiration_date < today),
  ).length
  const totalExpiringSoon = credentials.filter((c) => {
    const days = daysUntilExpiration(c.expiration_date)
    return (days !== null && days >= 0 && days <= 60 && c.status !== 'expired') || c.status === 'expiring_soon'
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
          <UserCheck className="w-5 h-5 text-blue-500" />
          Staff Credentials
        </h1>
        <p className="text-sm text-muted-foreground">
          All investigator credentials with expiration tracking.
        </p>
      </div>

      <div className="vilo-ops-scroll min-h-0 flex-1 overflow-y-auto p-6 scrollbar-thin space-y-6">
        <SummaryBar
          totalCurrent={totalCurrent}
          totalExpiringSoon={totalExpiringSoon}
          totalExpired={totalExpired}
        />

        <CredentialsTable credentials={credentials} studiesById={studiesById} />
      </div>
    </div>
  )
}
