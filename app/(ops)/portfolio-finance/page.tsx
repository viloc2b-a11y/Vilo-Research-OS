import { redirect } from 'next/navigation'
import { Briefcase, TrendingUp, DollarSign, AlertTriangle } from 'lucide-react'
import { getSessionUser, getOrganizationMemberships } from '@/lib/auth/session'
import { activeMemberships } from '@/lib/auth/membership-access'
import { canViewPortfolioFinance } from '@/lib/rbac/permissions'
import { organizationIdsFromMemberships } from '@/lib/rbac/org-scope'
import { createServerClient } from '@/lib/supabase/server'
import { computeStudyFinancialSummary, type StudyFinancialSummary } from '@/lib/financial-runtime/compute-study'
import { loadRecentBudgetNegotiationLedger, type StudyBudgetNegotiationLedgerEntry } from '@/lib/study-workspace/load-budget-evidence-summary'
import { CoordinatorPageScroll } from '@/components/runtime-ui/CoordinatorPageScroll'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

type Study = { id: string; name: string; slug: string | null }

type StudyRow = {
  study: Study
  summary: StudyFinancialSummary | null
  ledger: StudyBudgetNegotiationLedgerEntry[]
  error: string | null
}

function formatProxy(cents: number): string {
  if (cents === 0) return '—'
  return (cents / 100).toLocaleString('en-US', { maximumFractionDigits: 0 })
}

function formatRate(rate: number): string {
  return `${(rate * 100).toFixed(1)}%`
}

function earnRateColor(rate: number): string {
  if (rate >= 0.9) return 'text-green-600'
  if (rate >= 0.7) return 'text-amber-600'
  return 'text-red-600'
}

function negotiationStatus(ledger: StudyBudgetNegotiationLedgerEntry[]): string {
  if (ledger.length === 0) return 'No events'
  const latest = ledger[0]
  if (latest.eventType === 'term_accepted') return 'Term accepted'
  return `Active – round ${latest.negotiationRound}`
}

function negotiationStatusVariant(ledger: StudyBudgetNegotiationLedgerEntry[]): 'default' | 'secondary' | 'outline' {
  if (ledger.length === 0) return 'outline'
  const latest = ledger[0]
  if (latest.eventType === 'term_accepted') return 'secondary'
  return 'default'
}

function formatEventType(eventType: string): string {
  return eventType.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

export default async function PortfolioFinancePage() {
  const user = await getSessionUser()
  if (!user) redirect('/login')

  const allMemberships = await getOrganizationMemberships(user.id)
  const memberships = activeMemberships(allMemberships)
  if (!canViewPortfolioFinance(memberships)) redirect('/')

  const supabase = await createServerClient()
  const orgIds = organizationIdsFromMemberships(memberships)

  const { data: studyRows } = await supabase
    .from('studies')
    .select('id, name, slug')
    .in('organization_id', orgIds)
    .eq('status', 'active')
    .order('name', { ascending: true })

  const studies: Study[] = (studyRows ?? []) as Study[]

  const orgIdForStudy = (studyId: string): string => {
    return orgIds[0] ?? ''
  }

  const studyResults = await Promise.allSettled(
    studies.map(async (study): Promise<StudyRow> => {
      const orgId = orgIdForStudy(study.id)
      const unavailable: string[] = []

      const [summaryResult, ledgerResult] = await Promise.allSettled([
        computeStudyFinancialSummary({ supabase, organizationId: orgId, studyId: study.id }),
        loadRecentBudgetNegotiationLedger({ supabase, organizationId: orgId, studyId: study.id, unavailable, limit: 3 }),
      ])

      return {
        study,
        summary: summaryResult.status === 'fulfilled' ? summaryResult.value : null,
        ledger: ledgerResult.status === 'fulfilled' ? ledgerResult.value : [],
        error: summaryResult.status === 'rejected' ? String(summaryResult.reason) : null,
      }
    }),
  )

  const rows: StudyRow[] = studyResults
    .filter((r): r is PromiseFulfilledResult<StudyRow> => r.status === 'fulfilled')
    .map((r) => r.value)

  const totals = rows.reduce(
    (acc, row) => {
      if (!row.summary) return acc
      acc.totalExpectedCents += row.summary.totalExpectedCents
      acc.totalEarnedCents += row.summary.totalEarnedCents
      acc.totalInvoicedCents += row.summary.totalInvoicedCents
      acc.totalPaidCents += row.summary.totalPaidCents
      acc.leakageItemCount += row.summary.leakageItemCount
      return acc
    },
    { totalExpectedCents: 0, totalEarnedCents: 0, totalInvoicedCents: 0, totalPaidCents: 0, leakageItemCount: 0 },
  )

  const portfolioEarnRate =
    totals.totalExpectedCents > 0 ? totals.totalEarnedCents / totals.totalExpectedCents : 0

  const outstanding = totals.totalInvoicedCents - totals.totalPaidCents

  const activeNegotiationRows = rows.filter(
    (r) => r.ledger.length > 0 && r.ledger[0].eventType !== 'term_accepted',
  )

  return (
    <CoordinatorPageScroll>
      <div className="px-6 py-5 bg-card border-b border-border flex items-center gap-3">
        <Briefcase className="w-5 h-5 text-primary" />
        <div>
          <h1 className="heading-serif text-xl text-foreground">Portfolio Finance</h1>
          <p className="text-sm text-muted-foreground">
            {studies.length} active {studies.length === 1 ? 'study' : 'studies'} · Proxy units, not real dollar amounts
          </p>
        </div>
      </div>

      <div className="p-6 space-y-6">

        {/* Section 1: Portfolio Totals */}
        <section>
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
            Portfolio Totals
          </h2>
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
            <div className="col-span-1 p-4 rounded-xl bg-card border border-border">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="w-4 h-4 text-primary" />
                <span className="text-xs text-muted-foreground">Expected</span>
              </div>
              <p className="text-xl font-bold text-foreground">{formatProxy(totals.totalExpectedCents)}</p>
              <p className="text-xs text-muted-foreground mt-1">procedure units</p>
            </div>
            <div className="col-span-1 p-4 rounded-xl bg-card border border-border">
              <div className="flex items-center gap-2 mb-2">
                <DollarSign className="w-4 h-4 text-primary" />
                <span className="text-xs text-muted-foreground">Earned</span>
              </div>
              <p className={`text-xl font-bold ${earnRateColor(portfolioEarnRate)}`}>
                {formatProxy(totals.totalEarnedCents)}
              </p>
              <p className={`text-xs mt-1 ${earnRateColor(portfolioEarnRate)}`}>
                {formatRate(portfolioEarnRate)} earn rate
              </p>
            </div>
            <div className="col-span-1 p-4 rounded-xl bg-card border border-border">
              <div className="flex items-center gap-2 mb-2">
                <DollarSign className="w-4 h-4 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">Invoiced</span>
              </div>
              <p className="text-xl font-bold text-foreground">{formatProxy(totals.totalInvoicedCents)}</p>
              <p className="text-xs text-muted-foreground mt-1">cents</p>
            </div>
            <div className="col-span-1 p-4 rounded-xl bg-card border border-border">
              <div className="flex items-center gap-2 mb-2">
                <DollarSign className="w-4 h-4 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">Paid</span>
              </div>
              <p className="text-xl font-bold text-foreground">{formatProxy(totals.totalPaidCents)}</p>
              <p className="text-xs text-muted-foreground mt-1">cents</p>
            </div>
            <div className="col-span-1 p-4 rounded-xl bg-card border border-border">
              <div className="flex items-center gap-2 mb-2">
                <DollarSign className={`w-4 h-4 ${outstanding > 0 ? 'text-amber-500' : 'text-muted-foreground'}`} />
                <span className="text-xs text-muted-foreground">Outstanding</span>
              </div>
              <p className={`text-xl font-bold ${outstanding > 0 ? 'text-amber-600' : 'text-foreground'}`}>
                {formatProxy(outstanding)}
              </p>
              <p className="text-xs text-muted-foreground mt-1">invoiced − paid</p>
            </div>
            <div className="col-span-1 p-4 rounded-xl bg-card border border-border">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className={`w-4 h-4 ${totals.leakageItemCount > 0 ? 'text-amber-500' : 'text-muted-foreground'}`} />
                <span className="text-xs text-muted-foreground">Leakage</span>
              </div>
              <p className={`text-xl font-bold ${totals.leakageItemCount > 0 ? 'text-amber-600' : 'text-foreground'}`}>
                {totals.leakageItemCount}
              </p>
              <p className="text-xs text-muted-foreground mt-1">items</p>
            </div>
          </div>
        </section>

        {/* Section 2: Per-Study Revenue Table */}
        <section>
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
            Per-Study Revenue
          </h2>
          <Card>
            <CardContent className="p-0">
              {rows.length === 0 ? (
                <p className="px-4 py-6 text-sm text-muted-foreground">No active studies found.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border bg-muted/40">
                        <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                          Study
                        </th>
                        <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                          Expected
                        </th>
                        <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                          Earned
                        </th>
                        <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                          Earn Rate
                        </th>
                        <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                          Invoiced
                        </th>
                        <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                          Paid
                        </th>
                        <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                          Leakage
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                          Negotiation
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {rows.map((row) => (
                        <tr key={row.study.id} className="hover:bg-muted/20 transition-colors">
                          <td className="px-4 py-3 font-medium text-foreground">
                            {row.study.name}
                            {row.study.slug && (
                              <span className="ml-2 mono-id">{row.study.slug}</span>
                            )}
                          </td>
                          {row.summary ? (
                            <>
                              <td className="px-4 py-3 text-right text-foreground tabular-nums">
                                {formatProxy(row.summary.totalExpectedCents)}
                              </td>
                              <td className="px-4 py-3 text-right tabular-nums">
                                <span className={earnRateColor(row.summary.earnRate)}>
                                  {formatProxy(row.summary.totalEarnedCents)}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-right tabular-nums">
                                <span className={earnRateColor(row.summary.earnRate)}>
                                  {formatRate(row.summary.earnRate)}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-right text-foreground tabular-nums">
                                {formatProxy(row.summary.totalInvoicedCents)}
                              </td>
                              <td className="px-4 py-3 text-right text-foreground tabular-nums">
                                {formatProxy(row.summary.totalPaidCents)}
                              </td>
                              <td className="px-4 py-3 text-right tabular-nums">
                                {row.summary.leakageItemCount > 0 ? (
                                  <span className="text-amber-600">{row.summary.leakageItemCount}</span>
                                ) : (
                                  <span className="text-muted-foreground">—</span>
                                )}
                              </td>
                            </>
                          ) : (
                            <td colSpan={6} className="px-4 py-3 text-sm text-muted-foreground italic">
                              Data unavailable
                            </td>
                          )}
                          <td className="px-4 py-3">
                            <Badge variant={negotiationStatusVariant(row.ledger)}>
                              {negotiationStatus(row.ledger)}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
          <p className="mt-2 text-xs text-muted-foreground">
            Expected and Earned are procedure-unit proxies (1 procedure = 100 cents). Invoiced and Paid reflect actual invoice amounts in cents.
          </p>
        </section>

        {/* Section 3: Amendment Exposure */}
        <section>
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
            Amendment Exposure
          </h2>
          <Card>
            <CardContent className="px-4 py-4">
              <p className="text-sm text-muted-foreground">
                Amendment financial exposure data unavailable. Amendment impacts track reconsent and training review status only — no financial line items are linked.
              </p>
            </CardContent>
          </Card>
        </section>

        {/* Section 4: Budget Negotiation Summary */}
        <section>
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
            Budget Negotiation Summary
          </h2>
          {activeNegotiationRows.length === 0 ? (
            <Card>
              <CardContent className="px-4 py-4">
                <p className="text-sm text-muted-foreground">No active budget negotiation events across portfolio.</p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border bg-muted/40">
                        <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                          Study
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                          Last Event
                        </th>
                        <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                          Round
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                          Date
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {activeNegotiationRows.map((row) => {
                        const latest = row.ledger[0]
                        return (
                          <tr key={row.study.id} className="hover:bg-muted/20 transition-colors">
                            <td className="px-4 py-3 font-medium text-foreground">
                              {row.study.name}
                            </td>
                            <td className="px-4 py-3 text-foreground">
                              {formatEventType(latest.eventType)}
                            </td>
                            <td className="px-4 py-3 text-right text-foreground tabular-nums">
                              {latest.negotiationRound}
                            </td>
                            <td className="px-4 py-3 text-muted-foreground">
                              {new Date(latest.createdAt).toLocaleDateString('en-US', {
                                year: 'numeric',
                                month: 'short',
                                day: 'numeric',
                              })}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
        </section>

      </div>
    </CoordinatorPageScroll>
  )
}
