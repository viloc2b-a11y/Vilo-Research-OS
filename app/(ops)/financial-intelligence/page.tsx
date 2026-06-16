// app/(ops)/financial-intelligence/page.tsx
// Financial Intelligence — study-level revenue reconciliation view

import { redirect } from 'next/navigation'
import { organizationIdsFromMemberships } from '@/lib/rbac/org-scope'
import { getOrganizationMemberships, getSessionUser } from '@/lib/auth/session'
import { activeMemberships } from '@/lib/auth/membership-access'
import {
  canAccessFinancialIntelligencePage,
  canViewFinancialData,
  canViewPortfolioFinance,
  canViewInvoices,
  isUserCoordinatorRole,
  isUserPiRole,
} from '@/lib/rbac/permissions'
import { CoordinatorRevenueProtectionPanel } from '@/components/financial-intelligence/CoordinatorRevenueProtectionPanel'
import { PiRevenueAwarenessPanel } from '@/components/financial-intelligence/PiRevenueAwarenessPanel'
import { sourceCapturePath, sourceResponseSetPath, visitDetailPath } from '@/lib/ops/paths'
import { createServerClient } from '@/lib/supabase/server'
import { computeStudyFinancialSummary, type StudyFinancialSummary } from '@/lib/financial-runtime/compute-study'
import Link from 'next/link'
import { DollarSign, TrendingUp, AlertTriangle, Users, FileText } from 'lucide-react'

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
// Portfolio summary card (canViewPortfolioFinance only)
// ============================================================================

interface PortfolioTotals {
  totalExpectedCents: number
  totalEarnedCents: number
  totalInvoicedCents: number
  totalPaidCents: number
  leakageItemCount: number
}

function PortfolioSummaryCard({ totals, studyCount }: { totals: PortfolioTotals; studyCount: number }) {
  const portfolioEarnRate = totals.totalExpectedCents > 0
    ? totals.totalEarnedCents / totals.totalExpectedCents
    : 0

  return (
    <div className="px-6 pt-5 pb-4">
      <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
        Portfolio Summary — {studyCount} {studyCount === 1 ? 'study' : 'studies'}
      </h2>
      <div className="grid grid-cols-5 gap-3">
        <div className="p-4 rounded-xl bg-card border border-border">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-4 h-4 text-primary" />
            <span className="text-xs text-muted-foreground">Expected</span>
          </div>
          <p className="text-xl font-bold text-foreground">{formatCents(totals.totalExpectedCents)}</p>
        </div>
        <div className="p-4 rounded-xl bg-card border border-border">
          <div className="flex items-center gap-2 mb-2">
            <DollarSign className="w-4 h-4 text-primary" />
            <span className="text-xs text-muted-foreground">Earned</span>
          </div>
          <p className={`text-xl font-bold ${earnRateColor(portfolioEarnRate)}`}>
            {formatCents(totals.totalEarnedCents)}
          </p>
          <p className={`text-xs mt-1 ${earnRateColor(portfolioEarnRate)}`}>
            {formatRate(portfolioEarnRate)} earn rate
          </p>
        </div>
        <div className="p-4 rounded-xl bg-card border border-border">
          <div className="flex items-center gap-2 mb-2">
            <DollarSign className="w-4 h-4 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Invoiced</span>
          </div>
          <p className="text-xl font-bold text-foreground">{formatCents(totals.totalInvoicedCents)}</p>
        </div>
        <div className="p-4 rounded-xl bg-card border border-border">
          <div className="flex items-center gap-2 mb-2">
            <Users className="w-4 h-4 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Paid</span>
          </div>
          <p className="text-xl font-bold text-foreground">{formatCents(totals.totalPaidCents)}</p>
        </div>
        <div className="p-4 rounded-xl bg-card border border-border">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-4 h-4 text-amber-500" />
            <span className="text-xs text-muted-foreground">Leakage items</span>
          </div>
          <p className={`text-xl font-bold ${totals.leakageItemCount > 0 ? 'text-amber-600' : 'text-foreground'}`}>
            {totals.leakageItemCount}
          </p>
        </div>
      </div>
    </div>
  )
}

// ============================================================================
// Invoice context note (canViewInvoices only)
// ============================================================================

function InvoiceContextNote() {
  return (
    <div className="mx-6 mb-4 flex items-start gap-2 rounded-lg border border-border bg-muted/30 px-4 py-3">
      <FileText className="w-4 h-4 mt-0.5 shrink-0 text-muted-foreground" />
      <p className="text-xs text-muted-foreground">
        Invoice-ready line items are visible in the study detail. Disputes and write-offs are managed by Finance.
      </p>
    </div>
  )
}

// ============================================================================
// Study selector (no study_id in query)
// ============================================================================

interface StudySelectorProps {
  studies: Array<{ id: string; name: string; slug: string | null }>
  portfolioTotals?: PortfolioTotals
  showInvoiceNote?: boolean
}

function StudySelector({ studies, portfolioTotals, showInvoiceNote }: StudySelectorProps) {
  return (
    <div className="flex flex-col h-full bg-accent">
      <div className="px-6 py-5 bg-card border-b border-border">
        <h1 className="heading-serif text-xl text-foreground">Financial Intelligence</h1>
        <p className="text-sm text-muted-foreground">Select a study to view its financial reconciliation summary.</p>
      </div>

      {portfolioTotals && (
        <div className="bg-card border-b border-border">
          <PortfolioSummaryCard totals={portfolioTotals} studyCount={studies.length} />
          {showInvoiceNote && <InvoiceContextNote />}
        </div>
      )}

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
  if (!user) redirect('/login')
  const rawMemberships = await getOrganizationMemberships(user.id)
  const memberships = activeMemberships(rawMemberships)
  if (!canAccessFinancialIntelligencePage(memberships)) redirect('/')
  const organizationIds = organizationIdsFromMemberships(memberships)

  const isCoordinator = isUserCoordinatorRole(memberships)
  const isPi = isUserPiRole(memberships)
  const isFinancialRole = canViewFinancialData(memberships)
  const canSeePortfolioView = canViewPortfolioFinance(memberships)
  const canSeeInvoiceView = canViewInvoices(memberships)

  const supabase = await createServerClient()

  const { study_id: studyId } = await searchParams

  // Coordinator view — operational revenue coaching
  if (isCoordinator && !isFinancialRole) {
    const [unsignedResult, sourceResult] = await Promise.allSettled([
      supabase
        .from('procedure_executions')
        .select('id, procedure_definitions(label, code), visits(id, study_subjects(subject_identifier), visit_definitions(label, code)), studies(name, slug)')
        .in('organization_id', organizationIds)
        .eq('is_signed', false)
        .in('execution_status', ['completed', 'verified'])
        .order('updated_at', { ascending: false })
        .limit(20),
      supabase
        .from('source_response_sets')
        .select('id, organization_id, study_id, visit_id, studies(name, slug), study_subjects(subject_identifier)')
        .in('organization_id', organizationIds)
        .in('status', ['draft', 'in_progress'])
        .order('opened_at', { ascending: false })
        .limit(20),
    ])

    const unsignedProcs = unsignedResult.status === 'fulfilled' ? (unsignedResult.value.data ?? []) : []
    const sourceSets = sourceResult.status === 'fulfilled' ? (sourceResult.value.data ?? []) : []

    const signatureItems = unsignedProcs.map((row) => {
      const r = row as Record<string, unknown>
      const visit = r.visits as Record<string, unknown> | null
      const visitDef = visit?.visit_definitions as Record<string, unknown> | null
      const subject = visit?.study_subjects as Record<string, unknown> | null
      const procDef = r.procedure_definitions as Record<string, unknown> | null
      return {
        id: String(r.id),
        title: String(procDef?.label ?? 'Procedure'),
        detail: `${String(subject?.subject_identifier ?? '')} · ${String(visitDef?.label ?? '')}`,
        href: visit?.id ? visitDetailPath(String(visit.id)) : '/',
        severity: 'warning' as const,
      }
    })

    const sourceItems = sourceSets.map((row) => {
      const r = row as Record<string, unknown>
      const study = r.studies as Record<string, unknown> | null
      const subject = r.study_subjects as Record<string, unknown> | null
      return {
        id: String(r.id),
        title: `Complete source — ${String(study?.name ?? 'Study')}`,
        detail: String(subject?.subject_identifier ?? ''),
        href: sourceResponseSetPath(String(r.id)),
        severity: 'info' as const,
      }
    })

    return (
      <div className="flex flex-col h-full bg-accent">
        <div className="flex-1 overflow-auto p-6">
          <CoordinatorRevenueProtectionPanel signatureItems={signatureItems} sourceItems={sourceItems} />
        </div>
      </div>
    )
  }

  // PI view — signature awareness
  if (isPi && !isFinancialRole) {
    const unsignedResult = await supabase
      .from('procedure_executions')
      .select('id, procedure_definitions(label), visits(id, study_subjects(subject_identifier), visit_definitions(label))')
      .in('organization_id', organizationIds)
      .eq('is_signed', false)
      .in('execution_status', ['completed', 'verified'])
      .order('updated_at', { ascending: false })
      .limit(30)
    const unsignedProcs = unsignedResult.data ?? []

    const pendingSignatures = unsignedProcs.map((row) => {
      const r = row as Record<string, unknown>
      const visit = r.visits as Record<string, unknown> | null
      const visitDef = visit?.visit_definitions as Record<string, unknown> | null
      const subject = visit?.study_subjects as Record<string, unknown> | null
      const procDef = r.procedure_definitions as Record<string, unknown> | null
      return {
        id: String(r.id),
        procedureLabel: String(procDef?.label ?? 'Procedure'),
        visitLabel: String(visitDef?.label ?? 'Visit'),
        subjectIdentifier: String(subject?.subject_identifier ?? ''),
        signHref: visit?.id ? visitDetailPath(String(visit.id)) : '/',
      }
    })

    return (
      <div className="flex flex-col h-full bg-accent">
        <div className="flex-1 overflow-auto p-6">
          <PiRevenueAwarenessPanel pendingSignatures={pendingSignatures} />
        </div>
      </div>
    )
  }

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

    const studyList = studies ?? []

    // Compute portfolio totals for privileged roles
    let portfolioTotals: PortfolioTotals | undefined
    if (canSeePortfolioView && studyList.length > 0) {
      const summaries = await Promise.allSettled(
        studyList.map((s) =>
          computeStudyFinancialSummary({
            supabase,
            organizationId: organizationIds[0] ?? '',
            studyId: s.id,
          }),
        ),
      )
      const resolved = summaries
        .filter((r): r is PromiseFulfilledResult<StudyFinancialSummary> => r.status === 'fulfilled')
        .map((r) => r.value)

      if (resolved.length > 0) {
        portfolioTotals = {
          totalExpectedCents: resolved.reduce((sum, s) => sum + s.totalExpectedCents, 0),
          totalEarnedCents: resolved.reduce((sum, s) => sum + s.totalEarnedCents, 0),
          totalInvoicedCents: resolved.reduce((sum, s) => sum + s.totalInvoicedCents, 0),
          totalPaidCents: resolved.reduce((sum, s) => sum + s.totalPaidCents, 0),
          leakageItemCount: resolved.reduce((sum, s) => sum + s.leakageItemCount, 0),
        }
      }
    }

    return (
      <StudySelector
        studies={studyList}
        portfolioTotals={portfolioTotals}
        showInvoiceNote={canSeeInvoiceView}
      />
    )
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
