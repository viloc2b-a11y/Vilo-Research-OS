// app/(ops)/financial-intelligence/page.tsx
// Financial Intelligence — study-level revenue reconciliation view

import { organizationIdsFromMemberships } from '@/lib/rbac/org-scope'
import { getOrganizationMemberships, getSessionUser } from '@/lib/auth/session'
import { createServerClient } from '@/lib/supabase/server'
import { computeStudyFinancialSummary, type StudyFinancialSummary } from '@/lib/financial-runtime/compute-study'
import Link from 'next/link'
import { DollarSign, TrendingUp, AlertTriangle, Users } from 'lucide-react'

// ============================================================================
// Helpers
// ============================================================================

function formatCents(cents: number): string {
  if (cents === 0) return '—'
  return `$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}

function formatRate(rate: number): string {
  return `${(rate * 100).toFixed(1)}%`
}

function earnRateColor(rate: number): string {
  if (rate >= 0.9) return 'text-green-600'
  if (rate >= 0.7) return 'text-amber-600'
  return 'text-red-600'
}

// ============================================================================
// Study selector (no study_id in query)
// ============================================================================

interface StudySelectorProps {
  studies: Array<{ id: string; name: string; slug: string | null }>
}

function StudySelector({ studies }: StudySelectorProps) {
  return (
    <div className="flex flex-col h-full bg-accent">
      <div className="px-6 py-5 bg-card border-b border-border">
        <h1 className="heading-serif text-xl text-foreground">Financial Intelligence</h1>
        <p className="text-sm text-muted-foreground">Select a study to view its financial reconciliation summary.</p>
      </div>
      <div className="p-6 space-y-2">
        {studies.length === 0 && (
          <p className="text-sm text-muted-foreground">No studies available for your organization.</p>
        )}
        {studies.map((study) => (
          <Link
            key={study.id}
            href={`/financial-intelligence?study_id=${study.id}`}
            className="block vilo-card-interactive p-4"
          >
            <span className="font-medium text-foreground text-sm">{study.name}</span>
            {study.slug && (
              <span className="ml-2 mono-id">{study.slug}</span>
            )}
          </Link>
        ))}
      </div>
    </div>
  )
}

// ============================================================================
// Summary view
// ============================================================================

interface SummaryViewProps {
  summary: StudyFinancialSummary
  studyName: string
}

function SummaryView({ summary, studyName }: SummaryViewProps) {
  const subjectRows = summary.perSubject

  return (
    <div className="flex flex-col h-full bg-accent">
      {/* Header */}
      <div className="px-6 py-5 bg-card border-b border-border">
        <div className="mb-1 flex items-center gap-2">
          <Link href="/financial-intelligence" className="text-xs text-muted-foreground hover:text-primary">
            Financial Intelligence
          </Link>
          <span className="text-xs text-muted-foreground">/</span>
          <span className="text-xs text-foreground font-medium">{studyName}</span>
        </div>
        <h1 className="heading-serif text-xl text-foreground">Financial Reconciliation</h1>
        <p className="text-sm text-muted-foreground">
          {summary.subjectCount} subjects · {summary.visitCount} visits
        </p>
      </div>

      {/* KPI strip */}
      <div className="px-6 py-4 bg-card border-b border-border grid grid-cols-4 gap-4">
        <div className="p-4 rounded-xl bg-card border border-border">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-4 h-4 text-primary" />
            <span className="text-xs text-muted-foreground">Expected</span>
          </div>
          <p className="text-2xl font-bold text-foreground">{formatCents(summary.totalExpectedCents)}</p>
        </div>
        <div className="p-4 rounded-xl bg-card border border-border">
          <div className="flex items-center gap-2 mb-2">
            <DollarSign className="w-4 h-4 text-primary" />
            <span className="text-xs text-muted-foreground">Earned</span>
          </div>
          <p className={`text-2xl font-bold ${earnRateColor(summary.earnRate)}`}>
            {formatCents(summary.totalEarnedCents)}
          </p>
          <p className={`text-xs mt-1 ${earnRateColor(summary.earnRate)}`}>
            {formatRate(summary.earnRate)} earn rate
          </p>
        </div>
        <div className="p-4 rounded-xl bg-card border border-border">
          <div className="flex items-center gap-2 mb-2">
            <DollarSign className="w-4 h-4 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Invoiced</span>
          </div>
          <p className="text-2xl font-bold text-foreground">{formatCents(summary.totalInvoicedCents)}</p>
        </div>
        <div className="p-4 rounded-xl bg-card border border-border">
          <div className="flex items-center gap-2 mb-2">
            <Users className="w-4 h-4 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Paid</span>
          </div>
          <p className="text-2xl font-bold text-foreground">{formatCents(summary.totalPaidCents)}</p>
          {summary.leakageItemCount > 0 && (
            <p className="text-xs mt-1 text-amber-600 flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" />
              {summary.leakageItemCount} leakage items
            </p>
          )}
        </div>
      </div>

      {/* Per-subject table */}
      <div className="vilo-ops-scroll min-h-0 flex-1 overflow-y-auto p-6 scrollbar-thin">
        <div className="vilo-card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Subject
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Expected
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Earned
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Invoiced
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Paid
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Earn Rate
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {subjectRows.map((row) => {
                const subjectEarnRate = row.expectedCents > 0 ? row.earnedCents / row.expectedCents : 0
                return (
                  <tr key={row.subjectId} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 font-medium text-foreground">
                      <span className="mono-id">{row.subjectCode}</span>
                    </td>
                    <td className="px-4 py-3 text-right text-muted-foreground">
                      {formatCents(row.expectedCents)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className={earnRateColor(subjectEarnRate)}>
                        {formatCents(row.earnedCents)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-muted-foreground">
                      {formatCents(row.invoicedCents)}
                    </td>
                    <td className="px-4 py-3 text-right text-muted-foreground">
                      {formatCents(row.paidCents)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className={`font-semibold ${earnRateColor(subjectEarnRate)}`}>
                        {formatRate(subjectEarnRate)}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
            {/* Summary row */}
            <tfoot>
              <tr className="border-t-2 border-border bg-muted/20">
                <td className="px-4 py-3 font-semibold text-foreground">Total</td>
                <td className="px-4 py-3 text-right font-semibold text-foreground">
                  {formatCents(summary.totalExpectedCents)}
                </td>
                <td className="px-4 py-3 text-right font-semibold">
                  <span className={earnRateColor(summary.earnRate)}>
                    {formatCents(summary.totalEarnedCents)}
                  </span>
                </td>
                <td className="px-4 py-3 text-right font-semibold text-foreground">
                  {formatCents(summary.totalInvoicedCents)}
                </td>
                <td className="px-4 py-3 text-right font-semibold text-foreground">
                  {formatCents(summary.totalPaidCents)}
                </td>
                <td className="px-4 py-3 text-right font-semibold">
                  <span className={earnRateColor(summary.earnRate)}>
                    {formatRate(summary.earnRate)}
                  </span>
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  )
}

// ============================================================================
// Page
// ============================================================================

export default async function FinancialIntelligencePage({
  searchParams,
}: {
  searchParams: Promise<{ study_id?: string }>
}) {
  const user = await getSessionUser()
  const memberships = user ? await getOrganizationMemberships(user.id) : []
  const organizationIds = organizationIdsFromMemberships(memberships)

  const supabase = await createServerClient()

  const { study_id: studyId } = await searchParams

  // No study selected — show study selector
  if (!studyId) {
    const studiesQuery = supabase
      .from('studies')
      .select('id, name, slug')
      .neq('status', 'archived')
      .order('name', { ascending: true })

    const { data: studies } = organizationIds.length > 0
      ? await studiesQuery.in('organization_id', organizationIds)
      : await studiesQuery.limit(0)

    return <StudySelector studies={studies ?? []} />
  }

  // Study selected — resolve org and verify membership
  const { data: study } = await supabase
    .from('studies')
    .select('id, name, slug, organization_id')
    .eq('id', studyId)
    .maybeSingle()

  if (!study) {
    return (
      <div className="p-6">
        <p className="text-sm text-destructive">Study not found.</p>
      </div>
    )
  }

  const organizationId = String(study.organization_id)
  const hasMembership = organizationIds.includes(organizationId)

  if (!hasMembership) {
    return (
      <div className="p-6">
        <p className="text-sm text-destructive">You do not have access to this study.</p>
      </div>
    )
  }

  let summary: StudyFinancialSummary | null = null
  let summaryError: string | null = null

  try {
    summary = await computeStudyFinancialSummary({ supabase, organizationId, studyId })
  } catch (err) {
    summaryError = err instanceof Error ? err.message : 'Failed to compute financial summary'
  }

  if (summaryError || !summary) {
    return (
      <div className="p-6">
        <p className="text-sm text-destructive">
          Could not load financial summary: {summaryError ?? 'Unknown error'}
        </p>
      </div>
    )
  }

  return <SummaryView summary={summary} studyName={study.name} />
}
