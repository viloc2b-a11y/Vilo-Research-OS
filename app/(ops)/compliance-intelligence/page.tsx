// app/(ops)/compliance-intelligence/page.tsx
// Compliance Intelligence Dashboard — portfolio-level visibility into
// protocol deviations, CAPA status, and query burden.

import { redirect } from 'next/navigation'
import Link from 'next/link'
import {
  AlertTriangle,
  ShieldAlert,
  ClipboardCheck,
  AlertCircle,
  FileWarning,
  MessageCircleWarning,
} from 'lucide-react'
import { getSessionUser, getOrganizationMemberships } from '@/lib/auth/session'
import { activeMemberships } from '@/lib/auth/membership-access'
import { organizationIdsFromMemberships } from '@/lib/rbac/org-scope'
import { createServerClient } from '@/lib/supabase/server'
import { computeComplianceSummary } from '@/lib/compliance-intelligence/compute-compliance-summary'
import type { ComplianceSummary, ComplianceRiskLevel } from '@/lib/compliance-intelligence/compute-compliance-summary'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type PageProps = {
  searchParams: Promise<{ study_id?: string }>
}

type StudyOption = { id: string; name: string; slug: string | null }

// ---------------------------------------------------------------------------
// Risk level helpers
// ---------------------------------------------------------------------------

const RISK_COLORS: Record<ComplianceRiskLevel, { badge: string; label: string }> = {
  critical: { badge: 'bg-red-100 text-red-800 ring-red-300', label: 'Critical' },
  elevated: { badge: 'bg-orange-100 text-orange-800 ring-orange-300', label: 'Elevated' },
  moderate: { badge: 'bg-yellow-100 text-yellow-800 ring-yellow-300', label: 'Moderate' },
  low:      { badge: 'bg-green-100 text-green-800 ring-green-300', label: 'Low' },
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function RiskBadge({ level }: { level: ComplianceRiskLevel }) {
  const { badge, label } = RISK_COLORS[level]
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold ring-1 ring-inset ${badge}`}
    >
      <ShieldAlert className="w-3.5 h-3.5" />
      {label} Risk
    </span>
  )
}

type KpiCardProps = {
  label: string
  value: number
  icon: React.ElementType
  highlight?: boolean
  danger?: boolean
}

function KpiCard({ label, value, icon: Icon, highlight, danger }: KpiCardProps) {
  const cardCls = danger && value > 0
    ? 'bg-red-50 border-red-200'
    : highlight && value > 0
    ? 'bg-amber-50 border-amber-200'
    : 'bg-card border-border'

  const valueCls = danger && value > 0
    ? 'text-red-700'
    : highlight && value > 0
    ? 'text-amber-700'
    : 'text-foreground'

  const iconCls = danger && value > 0
    ? 'text-red-500'
    : highlight && value > 0
    ? 'text-amber-500'
    : 'text-muted-foreground'

  return (
    <div className={`rounded-xl border p-4 ${cardCls}`}>
      <div className="flex items-center gap-2 mb-2">
        <Icon className={`w-4 h-4 ${iconCls}`} />
        <span className="text-xs text-muted-foreground">{label}</span>
      </div>
      <p className={`text-2xl font-bold ${valueCls}`}>{value}</p>
    </div>
  )
}

function QueryBurdenBar({ score }: { score: number }) {
  const pct = Math.min(100, Math.max(0, score))
  const color =
    pct >= 70 ? 'bg-red-500' :
    pct >= 40 ? 'bg-orange-400' :
    pct >= 20 ? 'bg-yellow-400' :
    'bg-green-500'

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-medium text-foreground">Query Burden Score</span>
        <span className="text-lg font-bold text-foreground">{pct}</span>
      </div>
      <div className="h-2.5 w-full rounded-full bg-muted overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        Composite score (findings × 3 + queries × 2 + critical deviations × 10), capped at 100.
      </p>
    </div>
  )
}

function NotificationAlerts({ summary }: { summary: ComplianceSummary }) {
  const hasSponsor = summary.sponsorNotifiableDeviations > 0
  const hasIrb = summary.irbNotifiableDeviations > 0

  if (!hasSponsor && !hasIrb) return null

  return (
    <div className="flex flex-col gap-2">
      {hasSponsor && (
        <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3">
          <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-red-600" />
          <p className="text-sm text-red-800">
            <span className="font-semibold">{summary.sponsorNotifiableDeviations} deviation(s)</span> require sponsor notification.
          </p>
        </div>
      )}
      {hasIrb && (
        <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3">
          <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-red-600" />
          <p className="text-sm text-red-800">
            <span className="font-semibold">{summary.irbNotifiableDeviations} deviation(s)</span> require IRB notification.
          </p>
        </div>
      )}
    </div>
  )
}

function SubjectBreakdownTable({
  rows,
}: {
  rows: NonNullable<ComplianceSummary['perSubject']>
}) {
  if (rows.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">No compliance events found for any subject.</p>
    )
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/40">
            <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Subject
            </th>
            <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Deviations
            </th>
            <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Findings
            </th>
            <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Queries
            </th>
            <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Total
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map((row) => {
            const total = row.deviationCount + row.findingCount + row.queryCount
            return (
              <tr key={row.subjectId} className="bg-card hover:bg-muted/30 transition-colors">
                <td className="px-4 py-2.5 font-mono text-xs font-medium text-foreground">
                  {row.subjectCode}
                </td>
                <td className={`px-4 py-2.5 text-right font-medium ${row.deviationCount > 0 ? 'text-amber-700' : 'text-muted-foreground'}`}>
                  {row.deviationCount}
                </td>
                <td className={`px-4 py-2.5 text-right font-medium ${row.findingCount > 0 ? 'text-orange-700' : 'text-muted-foreground'}`}>
                  {row.findingCount}
                </td>
                <td className={`px-4 py-2.5 text-right font-medium ${row.queryCount > 0 ? 'text-blue-700' : 'text-muted-foreground'}`}>
                  {row.queryCount}
                </td>
                <td className="px-4 py-2.5 text-right font-bold text-foreground">
                  {total}
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

export default async function ComplianceIntelligencePage({ searchParams }: PageProps) {
  const user = await getSessionUser()
  if (!user) redirect('/login')

  const memberships = activeMemberships(await getOrganizationMemberships(user.id))
  if (memberships.length === 0) redirect('/login')

  const organizationIds = organizationIdsFromMemberships(memberships)
  const organizationId = organizationIds[0] ?? null

  if (!organizationId) {
    return (
      <div className="flex flex-col h-full bg-accent">
        <div className="px-6 py-5 bg-card border-b border-border">
          <h1 className="heading-serif text-xl text-foreground">Compliance Intelligence</h1>
          <p className="text-sm text-muted-foreground">No organization access found.</p>
        </div>
      </div>
    )
  }

  // Load available studies for the selector
  const supabase = await createServerClient()
  const { data: studyRows } = await supabase
    .from('studies')
    .select('id, name, slug')
    .in('organization_id', organizationIds)
    .neq('status', 'archived')
    .order('name', { ascending: true })

  const studies: StudyOption[] = (studyRows ?? []).map((s) => ({
    id: s.id as string,
    name: s.name as string,
    slug: s.slug as string | null,
  }))

  const { study_id: studyIdParam } = await searchParams
  const studyId = studyIdParam ?? undefined
  const selectedStudy = studies.find((s) => s.id === studyId) ?? null

  // Load compliance summary
  let summary: ComplianceSummary | null = null
  let summaryError: string | null = null

  try {
    summary = await computeComplianceSummary({
      supabase,
      organizationId,
      studyId,
    })
  } catch (err) {
    summaryError = err instanceof Error ? err.message : 'Failed to load compliance data.'
  }

  return (
    <div className="flex flex-col h-full bg-accent">
      {/* Header */}
      <div className="px-6 py-5 bg-card border-b border-border">
        <div className="flex items-center justify-between mb-1">
          <div>
            <h1 className="heading-serif text-xl text-foreground flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              Compliance Intelligence
            </h1>
            <p className="text-sm text-muted-foreground">
              Protocol deviations, CAPA status, and query burden — portfolio-level overview.
            </p>
          </div>
          {summary && (
            <RiskBadge level={summary.riskLevel} />
          )}
        </div>
      </div>

      <div className="vilo-ops-scroll min-h-0 flex-1 overflow-y-auto p-6 scrollbar-thin space-y-6">
        {/* Study selector */}
        <div className="rounded-lg border border-border bg-card px-4 py-3">
          <form method="get" className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <label
                htmlFor="compliance-study-filter"
                className="block text-xs font-medium text-muted-foreground"
              >
                Study scope
              </label>
              <select
                id="compliance-study-filter"
                name="study_id"
                defaultValue={studyId ?? ''}
                className="h-8 min-w-[12rem] rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
              >
                <option value="">All studies (portfolio)</option>
                {studies.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.slug ? `${s.slug} — ` : ''}{s.name}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="submit"
              className="h-8 rounded-lg border border-input bg-background px-3 text-sm font-medium hover:bg-muted"
            >
              Apply
            </button>
            {studyId && (
              <Link
                href="/compliance-intelligence"
                className="text-sm text-primary hover:underline self-end"
              >
                Clear filter
              </Link>
            )}
          </form>
          {selectedStudy && (
            <p className="mt-2 text-xs text-muted-foreground">
              Filtered to <span className="font-medium text-foreground">{selectedStudy.name}</span>.
            </p>
          )}
        </div>

        {summaryError && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3">
            <p className="text-sm text-red-800">Failed to load compliance data: {summaryError}</p>
          </div>
        )}

        {summary && (
          <>
            {/* Notification alerts */}
            <NotificationAlerts summary={summary} />

            {/* KPI row */}
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-4">
              <KpiCard
                label="Open Deviations"
                value={summary.openDeviations}
                icon={FileWarning}
                highlight
              />
              <KpiCard
                label="Critical Deviations"
                value={summary.criticalDeviations}
                icon={AlertTriangle}
                danger
              />
              <KpiCard
                label="CAPA Open"
                value={summary.openCapa}
                icon={ClipboardCheck}
                highlight
              />
              <KpiCard
                label="CAPA Overdue"
                value={summary.overdueCapa}
                icon={ClipboardCheck}
                danger
              />
              <KpiCard
                label="Open Findings"
                value={summary.openFindings}
                icon={AlertCircle}
                highlight
              />
              <KpiCard
                label="Open Queries"
                value={summary.openQueries}
                icon={MessageCircleWarning}
                highlight
              />
            </div>

            {/* Query burden score */}
            <QueryBurdenBar score={summary.queryBurdenScore} />

            {/* Per-subject breakdown */}
            {summary.perSubject !== undefined && (
              <div>
                <h2 className="text-sm font-semibold text-foreground mb-3">
                  Subject Breakdown
                </h2>
                <SubjectBreakdownTable rows={summary.perSubject} />
              </div>
            )}

            {summary.perSubject === undefined && (
              <div className="rounded-lg border border-border bg-card px-4 py-3">
                <p className="text-sm text-muted-foreground">
                  Select a specific study to see the per-subject breakdown.
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
