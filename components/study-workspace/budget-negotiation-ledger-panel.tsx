'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import type {
  StudyBudgetEvidenceSummary,
  StudyBudgetNegotiationEventType,
  StudyBudgetNegotiationLedgerEntry,
} from '@/lib/study-workspace/load-budget-evidence-summary'
import type { StudyFinancialRuntimeSummary } from '@/lib/study-workspace/load-financial-runtime-summary'
import { computeRevenueProtection } from '@/lib/financial-runtime/revenue-protection'

type BudgetNegotiationLedgerPanelProps = {
  studyId: string
  summary: StudyBudgetEvidenceSummary
  financialRuntime?: StudyFinancialRuntimeSummary | null
}

type BudgetLineItemDraft = {
  label: string
  category: 'visit' | 'procedure' | 'pass_through' | 'screen_fail' | 'invoice_term' | 'other'
  amount: string
  currency: string
  note: string
}

const EVENT_OPTIONS: Array<{ value: StudyBudgetNegotiationEventType; label: string }> = [
  { value: 'sponsor_offer_received', label: 'Sponsor offer received' },
  { value: 'counteroffer_drafted', label: 'Counteroffer drafted' },
  { value: 'counteroffer_sent', label: 'Counteroffer sent' },
  { value: 'sponsor_reply_received', label: 'Sponsor reply received' },
  { value: 'term_accepted', label: 'Term accepted' },
  { value: 'term_rejected', label: 'Term rejected' },
  { value: 'term_adjusted', label: 'Term adjusted' },
  { value: 'evidence_linked', label: 'Evidence linked' },
]

// --- Coverage Summary helpers ---

function deriveCoverageSummary(ledger: StudyBudgetNegotiationLedgerEntry[]) {
  const allLineItems = ledger.flatMap((event) => event.lineItems)
  const acceptedCount = allLineItems.filter((item) => item.financialTruth).length
  const unpricedCount = allLineItems.filter(
    (item) => !item.financialTruth && item.status === 'unpriced',
  ).length
  const proposedCount = allLineItems.filter((item) => item.status === 'proposed').length
  const counteredCount = allLineItems.filter((item) => item.status === 'countered').length
  const rejectedCount = allLineItems.filter((item) => item.status === 'rejected').length
  const openGaps = proposedCount + counteredCount + unpricedCount
  return { acceptedCount, unpricedCount, proposedCount, counteredCount, rejectedCount, openGaps }
}

// Separate ledger entries into evidence (not financial truth) and financial truth
function partitionLedger(ledger: StudyBudgetNegotiationLedgerEntry[]) {
  const evidenceEventTypes: StudyBudgetNegotiationEventType[] = [
    'sponsor_offer_received',
    'counteroffer_drafted',
    'counteroffer_sent',
    'sponsor_reply_received',
    'evidence_linked',
  ]
  const evidence = ledger.filter((event) => evidenceEventTypes.includes(event.eventType))
  const financialTruth = ledger.filter((event) => !evidenceEventTypes.includes(event.eventType))
  return { evidence, financialTruth }
}

export function BudgetNegotiationLedgerPanel({ studyId, summary, financialRuntime }: BudgetNegotiationLedgerPanelProps) {
  const router = useRouter()
  const [eventType, setEventType] = useState<StudyBudgetNegotiationEventType>('sponsor_offer_received')
  const [title, setTitle] = useState('Sponsor offer')
  const [negotiationSummary, setNegotiationSummary] = useState('')
  const [reason, setReason] = useState('')
  const [nextStep, setNextStep] = useState('')
  const [ownerRole, setOwnerRole] = useState('coordinator')
  const [negotiationRound, setNegotiationRound] = useState('1')
  const [amount, setAmount] = useState('')
  const [currency, setCurrency] = useState('USD')
  const [visitPayment, setVisitPayment] = useState('')
  const [procedurePayment, setProcedurePayment] = useState('')
  const [passThroughTerms, setPassThroughTerms] = useState('')
  const [screenFailTerms, setScreenFailTerms] = useState('')
  const [paymentTerms, setPaymentTerms] = useState('')
  const [invoiceDueTerms, setInvoiceDueTerms] = useState('')
  const [pricingEffective, setPricingEffective] = useState(false)
  const [lineItems, setLineItems] = useState<BudgetLineItemDraft[]>([
    { label: '', category: 'visit', amount: '', currency: 'USD', note: '' },
  ])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState<string | null>(null)

  const latestLedger = useMemo(() => summary.negotiationLedger.slice(0, 5), [summary.negotiationLedger])
  const coverageSummary = useMemo(() => deriveCoverageSummary(summary.negotiationLedger), [summary.negotiationLedger])
  const { evidence: evidenceLedger, financialTruth: financialTruthLedger } = useMemo(
    () => partitionLedger(latestLedger),
    [latestLedger],
  )

  async function submitEvent(payload: {
    event_type: StudyBudgetNegotiationEventType
    title: string
    summary: string
    reason?: string | null
    recommended_next_step?: string | null
    owner_role?: string
    negotiation_round?: number
    event_payload?: Record<string, unknown>
  }) {
    setSaving(true)
    setError(null)
    setStatus(null)
    try {
      const res = await fetch(`/api/study-workspace/${studyId}/budget-negotiation-events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const json = (await res.json().catch(() => null)) as { error?: string; ok?: boolean } | null
      if (!res.ok || !json?.ok) {
        throw new Error(json?.error ?? 'Failed to save negotiation event')
      }

      setStatus('Event recorded')
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save negotiation event')
    } finally {
      setSaving(false)
    }
  }

  async function handleManualSubmit() {
    await submitEvent({
      event_type: eventType,
      title: title.trim(),
      summary: negotiationSummary.trim(),
      reason: reason.trim() || null,
      recommended_next_step: nextStep.trim() || null,
      owner_role: ownerRole.trim() || 'coordinator',
      negotiation_round: Number.isFinite(Number(negotiationRound)) ? Math.max(1, Math.trunc(Number(negotiationRound))) : 1,
      event_payload: buildStructuredEventPayload({
        eventType,
        amount,
        currency,
        visitPayment,
        procedurePayment,
        passThroughTerms,
        screenFailTerms,
        paymentTerms,
        invoiceDueTerms,
        lineItems,
        pricingEffective,
      }),
    })
  }

  async function handleSponsorOfferSubmit() {
    await submitEvent({
      event_type: 'sponsor_offer_received',
      title: title.trim() || 'Sponsor offer',
      summary:
        negotiationSummary.trim() ||
        'Structured sponsor offer captured for budget negotiation review.',
      reason: reason.trim() || null,
      recommended_next_step:
        nextStep.trim() || 'Compare sponsor terms against the protocol SOA and draft a counteroffer.',
      owner_role: ownerRole.trim() || 'coordinator',
      negotiation_round: Number.isFinite(Number(negotiationRound)) ? Math.max(1, Math.trunc(Number(negotiationRound))) : 1,
      event_payload: buildSponsorOfferPayload({
        amount,
        currency,
        visitPayment,
        procedurePayment,
        passThroughTerms,
        screenFailTerms,
        paymentTerms,
        invoiceDueTerms,
        lineItems,
      }),
    })
  }

  function updateLineItem(index: number, patch: Partial<BudgetLineItemDraft>) {
    setLineItems((current) =>
      current.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item)),
    )
  }

  function addLineItem() {
    setLineItems((current) => [
      ...current,
      { label: '', category: 'procedure', amount: '', currency: 'USD', note: '' },
    ])
  }

  function removeLineItem(index: number) {
    setLineItems((current) => (current.length <= 1 ? current : current.filter((_, i) => i !== index)))
  }

  async function handleDraftCounteroffer() {
    await submitEvent({
      event_type: 'counteroffer_drafted',
      title: summary.counterofferDraft.title,
      summary: summary.counterofferDraft.summary,
      reason: 'Draft generated from protocol SOA and indexed Budget / CTA evidence.',
      recommended_next_step: 'Review the draft and send if sponsor terms are acceptable.',
      owner_role: 'coordinator',
      negotiation_round: latestLedger.length > 0 ? latestLedger[0].negotiationRound + 1 : 1,
      event_payload: {
        draft_items: summary.counterofferDraft.items,
        negotiation_focus_areas: summary.negotiationFocusAreas,
      },
    })
  }

  return (
    <div className="mt-4 space-y-4">

      {/* ── Section 1: Coverage Summary ── */}
      <div className="rounded border border-slate-200 bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Coverage Summary
          </p>
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-700">
            Financial Truth Status
          </span>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <CoverageChip
            label="Accepted Terms"
            value={coverageSummary.acceptedCount}
            tone="accepted"
          />
          <CoverageChip
            label="Proposed"
            value={coverageSummary.proposedCount}
            tone="proposed"
          />
          <CoverageChip
            label="Countered"
            value={coverageSummary.counteredCount}
            tone="countered"
          />
          <CoverageChip
            label="Unpriced"
            value={coverageSummary.unpricedCount}
            tone="unpriced"
          />
          <CoverageChip
            label="Rejected"
            value={coverageSummary.rejectedCount}
            tone="rejected"
          />
          <CoverageChip
            label="Open Gaps"
            value={coverageSummary.openGaps}
            tone={coverageSummary.openGaps > 0 ? 'unpriced' : 'accepted'}
          />
        </div>
        {coverageSummary.unpricedCount > 0 ? (
          <p className="mt-3 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-900">
            {coverageSummary.unpricedCount} unpriced line item(s) cannot drive invoiceable pricing.
            Record accepted or effective financial terms to resolve.
          </p>
        ) : null}
        {coverageSummary.acceptedCount === 0 && summary.negotiationLedger.length > 0 ? (
          <p className="mt-3 rounded border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-900">
            No accepted financial terms yet. Invoiceable pricing is blocked until at least one
            term is accepted or marked as effective.
          </p>
        ) : null}
      </div>

      {/* ── Section 2: Negotiation Advisor ── */}
      <div className="rounded border border-slate-200 bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Negotiation Advisor
          </p>
          <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${advisorRiskClassName(summary.budgetIntelligence.fmvGap.level)}`}>
            FMV: {summary.budgetIntelligence.fmvGap.level}
          </span>
        </div>
        <p className="mt-2 text-xs text-slate-700">
          {summary.budgetIntelligence.projectedRevenueImpact.summary}
        </p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <AdvisorSignal
            label="FMV Gap"
            summary={summary.budgetIntelligence.fmvGap.summary}
            level={summary.budgetIntelligence.fmvGap.level}
          />
          <AdvisorSignal
            label="Operational Burden"
            summary={summary.budgetIntelligence.operationalBurdenGap.summary}
            level={summary.budgetIntelligence.operationalBurdenGap.level}
          />
          <AdvisorSignal
            label="Payment Term Risk"
            summary={summary.budgetIntelligence.paymentTermRisk.summary}
            level={summary.budgetIntelligence.paymentTermRisk.level}
          />
          <AdvisorSignal
            label="Screen Failure Gap"
            summary={summary.budgetIntelligence.screenFailureProtectionGap.summary}
            level={summary.budgetIntelligence.screenFailureProtectionGap.level}
          />
        </div>
        {summary.budgetIntelligence.recommendedCounterofferLanguage.length > 0 ? (
          <div className="mt-3 rounded border border-slate-100 bg-slate-50 p-3">
            <p className="text-xs font-medium text-slate-600">Recommended negotiation language</p>
            <ul className="mt-2 space-y-1">
              {summary.budgetIntelligence.recommendedCounterofferLanguage.map((line) => (
                <li key={line} className="flex items-start gap-2 text-xs text-slate-700">
                  <span className="mt-0.5 text-teal-600">›</span>
                  <span>{line}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>

      {/* ── Section 3: Negotiation Evidence vs Financial Truth ── */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Evidence column — offers, counteroffers */}
        <div className="rounded border border-slate-200 bg-white p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Negotiation Evidence
            </p>
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-700">
              Offers / Counteroffers
            </span>
          </div>
          <p className="mt-1 text-[11px] text-slate-400">
            These events record the negotiation history. They do not drive invoiceable pricing.
          </p>
          {evidenceLedger.length > 0 ? (
            <div className="mt-3 space-y-2">
              {evidenceLedger.map((event) => (
                <LedgerEventCard key={event.id} event={event} />
              ))}
            </div>
          ) : (
            <p className="mt-3 text-xs text-slate-500">
              No evidence events yet. Record the sponsor offer or save the draft counteroffer to start.
            </p>
          )}
        </div>

        {/* Financial Truth column — accepted/adjusted terms */}
        <div className="rounded border border-teal-100 bg-teal-50/30 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-teal-700">
              Financial Truth
            </p>
            <span className="rounded-full bg-teal-100 px-2.5 py-1 text-[11px] font-semibold text-teal-800">
              Accepted / Effective Terms
            </span>
          </div>
          <p className="mt-1 text-[11px] text-teal-600">
            Only accepted and effective terms can drive invoiceable pricing.
          </p>
          {financialTruthLedger.length > 0 ? (
            <div className="mt-3 space-y-2">
              {financialTruthLedger.map((event) => (
                <LedgerEventCard key={event.id} event={event} highlightTruth />
              ))}
            </div>
          ) : (
            <p className="mt-3 text-xs text-teal-700">
              No accepted or effective financial terms recorded yet. Accept or mark a term as
              effective to enable invoiceable pricing.
            </p>
          )}
        </div>
      </div>

      {/* ── Section 4: Revenue Protection Pipeline ── */}
      <RevenueProtectionPanel summary={summary} financialRuntime={financialRuntime ?? null} />

      {/* ── Section 5: Negotiation Action (form) ── */}
      <div className="rounded border border-slate-100 bg-white p-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Negotiation action</p>
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-700">
            Study-scoped append-only event
          </span>
        </div>

        <div className="mt-3 grid gap-3 lg:grid-cols-[1.2fr_1fr]">
          <div className="space-y-3 rounded border border-slate-100 bg-slate-50 p-3">
            <div className="rounded border border-slate-100 bg-white p-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                  Sponsor offer input
                </p>
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-700">
                  Structured fields
                </span>
              </div>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <label className="block text-xs">
                  <span className="mb-1 block font-medium text-slate-600">Visit payment</span>
                  <input
                    value={visitPayment}
                    onChange={(event) => setVisitPayment(event.target.value)}
                    className="w-full rounded border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"
                    placeholder="e.g. 250"
                  />
                </label>
                <label className="block text-xs">
                  <span className="mb-1 block font-medium text-slate-600">Procedure payment</span>
                  <input
                    value={procedurePayment}
                    onChange={(event) => setProcedurePayment(event.target.value)}
                    className="w-full rounded border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"
                    placeholder="e.g. 125 per procedure"
                  />
                </label>
              </div>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <label className="block text-xs">
                  <span className="mb-1 block font-medium text-slate-600">Pass-through terms</span>
                  <input
                    value={passThroughTerms}
                    onChange={(event) => setPassThroughTerms(event.target.value)}
                    className="w-full rounded border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"
                    placeholder="e.g. reimbursable at cost"
                  />
                </label>
                <label className="block text-xs">
                  <span className="mb-1 block font-medium text-slate-600">Screen fail terms</span>
                  <input
                    value={screenFailTerms}
                    onChange={(event) => setScreenFailTerms(event.target.value)}
                    className="w-full rounded border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"
                    placeholder="e.g. $0 visit, procedures remain billable"
                  />
                </label>
              </div>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <label className="block text-xs">
                  <span className="mb-1 block font-medium text-slate-600">Payment terms</span>
                  <input
                    value={paymentTerms}
                    onChange={(event) => setPaymentTerms(event.target.value)}
                    className="w-full rounded border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"
                    placeholder="e.g. net 30"
                  />
                </label>
                <label className="block text-xs">
                  <span className="mb-1 block font-medium text-slate-600">Invoice due</span>
                  <input
                    value={invoiceDueTerms}
                    onChange={(event) => setInvoiceDueTerms(event.target.value)}
                    className="w-full rounded border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"
                    placeholder="e.g. due within 15 days"
                  />
                </label>
              </div>
              <div className="mt-3 rounded border border-slate-100 bg-slate-50 p-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                    Budget line items
                  </p>
                  <button
                    type="button"
                    onClick={addLineItem}
                    className="rounded border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700"
                  >
                    Add line item
                  </button>
                </div>
                <div className="mt-3 space-y-3">
                  {lineItems.map((item, index) => (
                    <div key={`${index}-${item.category}`} className="rounded border border-slate-100 bg-white p-3">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <p className="text-xs font-medium text-slate-500">Item {index + 1}</p>
                        <button
                          type="button"
                          onClick={() => removeLineItem(index)}
                          className="text-xs font-medium text-rose-700 disabled:text-slate-300"
                          disabled={lineItems.length <= 1}
                        >
                          Remove
                        </button>
                      </div>
                      <div className="mt-3 grid gap-3 sm:grid-cols-2">
                        <label className="block text-xs">
                          <span className="mb-1 block font-medium text-slate-600">Label</span>
                          <input
                            value={item.label}
                            onChange={(event) => updateLineItem(index, { label: event.target.value })}
                            className="w-full rounded border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"
                            placeholder="e.g. Day 1 visit fee"
                          />
                        </label>
                        <label className="block text-xs">
                          <span className="mb-1 block font-medium text-slate-600">Category</span>
                          <select
                            value={item.category}
                            onChange={(event) =>
                              updateLineItem(index, {
                                category: event.target.value as BudgetLineItemDraft['category'],
                              })
                            }
                            className="w-full rounded border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"
                          >
                            <option value="visit">Visit</option>
                            <option value="procedure">Procedure</option>
                            <option value="pass_through">Pass-through</option>
                            <option value="screen_fail">Screen fail</option>
                            <option value="invoice_term">Invoice term</option>
                            <option value="other">Other</option>
                          </select>
                        </label>
                      </div>
                      <div className="mt-3 grid gap-3 sm:grid-cols-3">
                        <label className="block text-xs">
                          <span className="mb-1 block font-medium text-slate-600">Amount</span>
                          <input
                            value={item.amount}
                            onChange={(event) => updateLineItem(index, { amount: event.target.value })}
                            inputMode="decimal"
                            className="w-full rounded border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"
                            placeholder="Optional"
                          />
                        </label>
                        <label className="block text-xs">
                          <span className="mb-1 block font-medium text-slate-600">Currency</span>
                          <input
                            value={item.currency}
                            onChange={(event) =>
                              updateLineItem(index, { currency: event.target.value.toUpperCase() })
                            }
                            className="w-full rounded border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"
                          />
                        </label>
                        <label className="block text-xs">
                          <span className="mb-1 block font-medium text-slate-600">Note</span>
                          <input
                            value={item.note}
                            onChange={(event) => updateLineItem(index, { note: event.target.value })}
                            className="w-full rounded border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"
                            placeholder="What is this line for?"
                          />
                        </label>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={handleSponsorOfferSubmit}
                  disabled={saving}
                  className="rounded bg-teal-700 px-3 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Record sponsor offer
                </button>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-xs">
                <span className="mb-1 block font-medium text-slate-600">Event type</span>
                <select
                  value={eventType}
                  onChange={(event) => setEventType(event.target.value as StudyBudgetNegotiationEventType)}
                  className="w-full rounded border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"
                >
                  {EVENT_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-xs">
                <span className="mb-1 block font-medium text-slate-600">Owner role</span>
                <input
                  value={ownerRole}
                  onChange={(event) => setOwnerRole(event.target.value)}
                  className="w-full rounded border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"
                />
              </label>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-xs">
                <span className="mb-1 block font-medium text-slate-600">Title</span>
                <input
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  className="w-full rounded border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"
                  placeholder="Sponsor offer"
                />
              </label>
              <label className="block text-xs">
                <span className="mb-1 block font-medium text-slate-600">Negotiation round</span>
                <input
                  value={negotiationRound}
                  onChange={(event) => setNegotiationRound(event.target.value)}
                  inputMode="numeric"
                  className="w-full rounded border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"
                />
              </label>
            </div>

            <label className="block text-xs">
              <span className="mb-1 block font-medium text-slate-600">Summary</span>
              <textarea
                value={negotiationSummary}
                onChange={(event) => setNegotiationSummary(event.target.value)}
                rows={3}
                className="w-full rounded border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"
                placeholder="Summarize the sponsor's terms or the site's response."
              />
            </label>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-xs">
                <span className="mb-1 block font-medium text-slate-600">Reason</span>
                <input
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  className="w-full rounded border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"
                  placeholder="Why this event matters"
                />
              </label>
              <label className="block text-xs">
                <span className="mb-1 block font-medium text-slate-600">Recommended next step</span>
                <input
                  value={nextStep}
                  onChange={(event) => setNextStep(event.target.value)}
                  className="w-full rounded border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"
                  placeholder="What should happen next"
                />
              </label>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-xs">
                <span className="mb-1 block font-medium text-slate-600">Amount</span>
                <input
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                  inputMode="decimal"
                  className="w-full rounded border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"
                  placeholder="Optional"
                />
              </label>
              <label className="block text-xs">
                <span className="mb-1 block font-medium text-slate-600">Currency</span>
                <input
                  value={currency}
                  onChange={(event) => setCurrency(event.target.value.toUpperCase())}
                  className="w-full rounded border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"
                />
              </label>
            </div>

            {eventType === 'term_adjusted' ? (
              <label className="flex items-start gap-2 rounded border border-amber-100 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                <input
                  type="checkbox"
                  checked={pricingEffective}
                  onChange={(event) => setPricingEffective(event.target.checked)}
                  className="mt-0.5 rounded border-amber-300"
                />
                <span>
                  <span className="block font-medium">Approved/effective for pricing</span>
                  Only checked adjusted terms can become Financial Runtime pricing.
                </span>
              </label>
            ) : null}

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleManualSubmit}
                disabled={saving || !title.trim() || !negotiationSummary.trim()}
                className="rounded bg-slate-900 px-3 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                Record event
              </button>
              <button
                type="button"
                onClick={handleDraftCounteroffer}
                disabled={saving}
                className="rounded border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-900 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Save draft counteroffer
              </button>
            </div>

            {error ? <p className="text-xs text-rose-700">{error}</p> : null}
            {status ? <p className="text-xs text-teal-700">{status}</p> : null}
          </div>

          <div className="space-y-3 rounded border border-slate-100 bg-slate-50 p-3">
            <div className="rounded border border-slate-100 bg-white p-3 text-xs">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-medium uppercase tracking-wide text-slate-500">SOA comparison</p>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 font-semibold text-slate-700">
                  Protocol context
                </span>
              </div>
              <p className="mt-2 text-slate-700">{summary.soaComparison.summary}</p>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <MetricChip label="Visits" value={summary.soaComparison.visitCount} />
                <MetricChip label="Procedures" value={summary.soaComparison.procedureCount} />
                <MetricChip label="Conditional" value={summary.soaComparison.conditionalProcedureCount} />
                <MetricChip label="Required" value={summary.soaComparison.requiredProcedureCount} />
              </div>
            </div>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Recent ledger entries</p>
            {latestLedger.length > 0 ? (
              <div className="space-y-2">
                {latestLedger.map((event) => (
                  <div key={event.id} className="rounded border border-slate-100 bg-white p-3 text-xs">
                    <p className="font-medium text-slate-800">{event.title}</p>
                    <p className="mt-1 text-slate-600">{event.summary}</p>
                    <p className="mt-1 text-slate-500">
                      {event.eventType} · round {event.negotiationRound} · {new Date(event.createdAt).toLocaleString()}
                    </p>
                    {event.lineItems.length > 0 ? (
                      <div className="mt-2 space-y-1">
                        {event.lineItems.map((lineItem, index) => (
                          <div
                            key={`${event.id}-${index}-${lineItem.label}`}
                            className="flex flex-wrap items-center justify-between gap-2 rounded bg-slate-50 px-2 py-1"
                          >
                            <span className="text-slate-700">
                              {lineItem.label} · {lineItem.category}
                            </span>
                            <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${lineStatusClassName(lineItem.status)}`}>
                              {lineItem.status}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-500">
                No negotiation ledger entries yet. Record the sponsor offer or save the draft counteroffer to start the history.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// --- Revenue Protection Panel ---

function formatCurrency(value: number): string {
  return value.toLocaleString('en-US', { style: 'currency', currency: 'USD' })
}

type PipelineStageProps = {
  label: string
  value: string | number | null
  isCount?: boolean
}

function PipelineStage({ label, value, isCount = false }: PipelineStageProps) {
  const displayValue =
    value === null
      ? 'Not Yet Available'
      : isCount
        ? String(value)
        : formatCurrency(value as number)

  const isEmpty = value === null

  return (
    <div className="flex flex-col items-center gap-1 min-w-[96px]">
      <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </span>
      <span
        className={`text-sm font-bold ${isEmpty ? 'text-slate-300' : 'text-slate-800'}`}
      >
        {displayValue}
      </span>
    </div>
  )
}

function RevenueProtectionPanel({
  summary,
  financialRuntime,
}: {
  summary: StudyBudgetEvidenceSummary
  financialRuntime: StudyFinancialRuntimeSummary | null
}) {
  const protection = useMemo(
    () => computeRevenueProtection(summary, financialRuntime),
    [summary, financialRuntime],
  )

  const hasAnyData =
    protection.expected_revenue !== null ||
    protection.executed_work_count !== null ||
    protection.earned_revenue !== null

  const leakageItems: Array<{ label: string; value: number; tone: 'rose' | 'amber' }> = []
  if (protection.leakage.expected_vs_earned !== null && protection.leakage.expected_vs_earned > 0) {
    leakageItems.push({
      label: 'Expected vs Earned — revenue at risk',
      value: protection.leakage.expected_vs_earned,
      tone: 'rose',
    })
  }
  if (protection.leakage.earned_vs_invoiced !== null && protection.leakage.earned_vs_invoiced > 0) {
    leakageItems.push({
      label: 'Earned vs Invoiced — uninvoiced work',
      value: protection.leakage.earned_vs_invoiced,
      tone: 'amber',
    })
  }
  if (protection.leakage.invoiced_vs_paid !== null && protection.leakage.invoiced_vs_paid > 0) {
    leakageItems.push({
      label: 'Invoiced vs Paid — outstanding receivables',
      value: protection.leakage.invoiced_vs_paid,
      tone: 'amber',
    })
  }

  return (
    <div className="rounded border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Revenue Protection Pipeline
        </p>
        <span
          className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
            hasAnyData
              ? 'bg-teal-50 text-teal-800'
              : 'bg-slate-100 text-slate-500'
          }`}
        >
          {hasAnyData ? 'Partial data' : 'Not Yet Available'}
        </span>
      </div>

      {/* Pipeline stages */}
      <div className="mt-4 flex flex-wrap items-start justify-start gap-0">
        <PipelineStage label="Expected" value={protection.expected_revenue} />
        <span className="mt-4 px-1 text-slate-300 text-sm select-none">›</span>
        <PipelineStage label="Executed" value={protection.executed_work_count} isCount />
        <span className="mt-4 px-1 text-slate-300 text-sm select-none">›</span>
        <PipelineStage label="Earned" value={protection.earned_revenue} />
        <span className="mt-4 px-1 text-slate-300 text-sm select-none">›</span>
        <PipelineStage label="Invoiced" value={protection.invoiced_amount} />
        <span className="mt-4 px-1 text-slate-300 text-sm select-none">›</span>
        <PipelineStage label="Paid" value={protection.paid_amount} />
      </div>

      {/* Leakage indicators */}
      {leakageItems.length > 0 ? (
        <div className="mt-4 space-y-2">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
            Revenue at Risk
          </p>
          {leakageItems.map((item) => (
            <div
              key={item.label}
              className={`flex items-center justify-between rounded border px-3 py-2 text-xs font-medium ${
                item.tone === 'rose'
                  ? 'border-rose-200 bg-rose-50 text-rose-900'
                  : 'border-amber-200 bg-amber-50 text-amber-900'
              }`}
            >
              <span>{item.label}</span>
              <span className="ml-3 shrink-0 font-bold">{formatCurrency(item.value)}</span>
            </div>
          ))}
        </div>
      ) : null}

      {/* Contextual explanation */}
      {!hasAnyData ? (
        <p className="mt-3 text-xs text-slate-500">
          The Expected → Executed → Earned → Invoiced → Paid pipeline requires accepted financial
          terms and executed visit data from the Financial Runtime. Accept negotiation terms and
          complete visits to populate this view.
        </p>
      ) : (protection.invoiced_amount === null || protection.paid_amount === null) ? (
        <p className="mt-3 text-xs text-slate-400">
          Invoiced and Paid stages require a study-level invoice aggregation feed. Individual
          visit invoices exist in the Financial Runtime but are not yet rolled up here.
        </p>
      ) : null}
    </div>
  )
}

// --- Sub-components ---

function CoverageChip({
  label,
  value,
  tone,
}: {
  label: string
  value: number
  tone: 'accepted' | 'proposed' | 'countered' | 'unpriced' | 'rejected'
}) {
  const toneClass = {
    accepted: 'border-teal-200 bg-teal-50 text-teal-900',
    proposed: 'border-slate-200 bg-slate-50 text-slate-700',
    countered: 'border-amber-200 bg-amber-50 text-amber-900',
    unpriced: value > 0 ? 'border-orange-300 bg-orange-50 text-orange-900' : 'border-slate-200 bg-slate-50 text-slate-500',
    rejected: 'border-rose-200 bg-rose-50 text-rose-900',
  }[tone]

  return (
    <div className={`rounded border px-2.5 py-2 ${toneClass}`}>
      <p className="text-[10px] font-medium uppercase tracking-wide opacity-70">{label}</p>
      <p className="mt-0.5 text-lg font-bold leading-none">{value}</p>
    </div>
  )
}

function AdvisorSignal({
  label,
  summary,
  level,
}: {
  label: string
  summary: string
  level: 'low' | 'moderate' | 'high' | 'unknown'
}) {
  const levelClass = {
    high: 'border-rose-200 bg-rose-50',
    moderate: 'border-amber-200 bg-amber-50',
    low: 'border-teal-100 bg-teal-50',
    unknown: 'border-slate-200 bg-slate-50',
  }[level]

  const badgeClass = {
    high: 'bg-rose-100 text-rose-800',
    moderate: 'bg-amber-100 text-amber-800',
    low: 'bg-teal-100 text-teal-800',
    unknown: 'bg-slate-100 text-slate-600',
  }[level]

  return (
    <div className={`rounded border p-2.5 ${levelClass}`}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-semibold text-slate-700">{label}</p>
        <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${badgeClass}`}>
          {level}
        </span>
      </div>
      <p className="mt-1 text-[11px] text-slate-600 leading-snug">{summary}</p>
    </div>
  )
}

function LedgerEventCard({
  event,
  highlightTruth = false,
}: {
  event: StudyBudgetNegotiationLedgerEntry
  highlightTruth?: boolean
}) {
  const hasTruthItems = event.lineItems.some((item) => item.financialTruth)
  const containerClass = highlightTruth && hasTruthItems
    ? 'rounded border border-teal-200 bg-white p-3 text-xs'
    : 'rounded border border-slate-100 bg-white p-3 text-xs'

  return (
    <div className={containerClass}>
      <div className="flex items-start justify-between gap-2">
        <p className="font-medium text-slate-800">{event.title}</p>
        {highlightTruth && hasTruthItems ? (
          <span className="shrink-0 rounded-full bg-teal-100 px-1.5 py-0.5 text-[10px] font-semibold text-teal-800">
            pricing source
          </span>
        ) : null}
      </div>
      <p className="mt-1 text-slate-600">{event.summary}</p>
      <p className="mt-1 text-slate-500">
        {event.eventType} · round {event.negotiationRound} · {new Date(event.createdAt).toLocaleString()}
      </p>
      {event.lineItems.length > 0 ? (
        <div className="mt-2 space-y-1">
          {event.lineItems.map((lineItem, index) => (
            <div
              key={`${event.id}-${index}-${lineItem.label}`}
              className={`flex flex-wrap items-center justify-between gap-2 rounded px-2 py-1 ${
                lineItem.status === 'unpriced'
                  ? 'bg-orange-50 ring-1 ring-orange-200'
                  : 'bg-slate-50'
              }`}
            >
              <span className="text-slate-700">
                {lineItem.label} · {lineItem.category}
                {lineItem.amount !== null ? ` · $${lineItem.amount}` : ''}
              </span>
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${lineStatusClassName(lineItem.status)}`}>
                {lineItem.status}
              </span>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  )
}

function MetricChip({ label, value }: { label: string; value: number | null }) {
  return (
    <div className="rounded border border-slate-100 bg-slate-50 px-2.5 py-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-slate-600">{label}</span>
        <span className="font-semibold text-slate-900">{value === null ? '—' : value}</span>
      </div>
    </div>
  )
}

function buildEventPayload(amount: string, currency: string) {
  const parsedAmount = Number(amount)
  const payload: Record<string, unknown> = {}
  if (amount.trim() && Number.isFinite(parsedAmount)) {
    payload.amount = parsedAmount
    payload.currency = currency.trim().toUpperCase() || 'USD'
  }
  return payload
}

function buildStructuredEventPayload(input: {
  eventType: StudyBudgetNegotiationEventType
  amount: string
  currency: string
  visitPayment: string
  procedurePayment: string
  passThroughTerms: string
  screenFailTerms: string
  paymentTerms: string
  invoiceDueTerms: string
  lineItems: BudgetLineItemDraft[]
  pricingEffective: boolean
}) {
  const payload = buildSponsorOfferPayload(input)
  if (
    input.eventType === 'sponsor_offer_received' ||
    input.eventType === 'counteroffer_drafted' ||
    input.eventType === 'counteroffer_sent' ||
    input.eventType === 'sponsor_reply_received' ||
    input.eventType === 'evidence_linked'
  ) {
    payload.evidence_only = true
  }
  if (input.eventType === 'term_accepted') {
    payload.accepted_financial_term = true
  }
  if (input.eventType === 'term_adjusted' && input.pricingEffective) {
    payload.approved_for_pricing = true
    payload.pricing_effective = true
  }
  return payload
}

function buildSponsorOfferPayload(input: {
  amount: string
  currency: string
  visitPayment: string
  procedurePayment: string
  passThroughTerms: string
  screenFailTerms: string
  paymentTerms: string
  invoiceDueTerms: string
  lineItems: BudgetLineItemDraft[]
}) {
  const payload = buildEventPayload(input.amount, input.currency)
  if (input.visitPayment.trim()) payload.visit_payment = input.visitPayment.trim()
  if (input.procedurePayment.trim()) payload.procedure_payment = input.procedurePayment.trim()
  if (input.passThroughTerms.trim()) payload.pass_through_terms = input.passThroughTerms.trim()
  if (input.screenFailTerms.trim()) payload.screen_fail_terms = input.screenFailTerms.trim()
  if (input.paymentTerms.trim()) payload.payment_terms = input.paymentTerms.trim()
  if (input.invoiceDueTerms.trim()) payload.invoice_due_terms = input.invoiceDueTerms.trim()
  const lineItems = input.lineItems
    .filter((item) => item.label.trim() || item.amount.trim() || item.note.trim())
    .map((item) => ({
      label: item.label.trim(),
      category: item.category,
      amount: item.amount.trim() ? Number(item.amount) : null,
      currency: item.currency.trim().toUpperCase() || 'USD',
      note: item.note.trim() || null,
    }))
  if (lineItems.length > 0) payload.line_items = lineItems
  return payload
}

function lineStatusClassName(status: string) {
  if (status === 'accepted') return 'bg-teal-100 text-teal-800'
  if (status === 'rejected') return 'bg-rose-100 text-rose-800'
  if (status === 'countered') return 'bg-amber-100 text-amber-800'
  if (status === 'proposed') return 'bg-slate-200 text-slate-700'
  if (status === 'unpriced') return 'bg-orange-100 text-orange-800'
  return 'bg-slate-200 text-slate-700'
}

function advisorRiskClassName(level: string) {
  if (level === 'high') return 'bg-rose-50 text-rose-800'
  if (level === 'moderate') return 'bg-amber-50 text-amber-800'
  if (level === 'low') return 'bg-teal-50 text-teal-800'
  return 'bg-slate-100 text-slate-600'
}
