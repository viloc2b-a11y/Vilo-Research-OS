'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import type {
  StudyBudgetEvidenceSummary,
  StudyBudgetNegotiationEventType,
} from '@/lib/study-workspace/load-budget-evidence-summary'

type BudgetNegotiationLedgerPanelProps = {
  studyId: string
  summary: StudyBudgetEvidenceSummary
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

export function BudgetNegotiationLedgerPanel({ studyId, summary }: BudgetNegotiationLedgerPanelProps) {
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
  const [lineItems, setLineItems] = useState<BudgetLineItemDraft[]>([
    { label: '', category: 'visit', amount: '', currency: 'USD', note: '' },
  ])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState<string | null>(null)

  const latestLedger = useMemo(() => summary.negotiationLedger.slice(0, 5), [summary.negotiationLedger])

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
      event_payload: buildEventPayload(amount, currency),
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
    <div className="mt-4 rounded border border-slate-100 bg-white p-3">
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
