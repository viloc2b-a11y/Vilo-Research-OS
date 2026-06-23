/**
 * Demo financial seed for ClinIQ Financial Revenue Protection Pipeline.
 *
 * Seeds the pilot fixture study with budget negotiation events, visit financial
 * runtime projections, invoices, and payments so the full pipeline renders
 * dollar values instead of "Not Yet Available".
 *
 * Usage:
 *   npx tsx scripts/seed-demo-financial.ts
 *   npx tsx scripts/seed-demo-financial.ts --dry-run
 *
 * Env:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *
 * Safe to run multiple times — all inserts are idempotent.
 */

import { createHash } from 'node:crypto'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { PILOT_FIXTURE_DEFAULTS } from '../lib/runtime-validation/pilot-fixture-defaults'

// ── Demo constants ─────────────────────────────────────────────────────────────

const DEMO_STUDY_ID = PILOT_FIXTURE_DEFAULTS.studyId
const DEMO_ORG_ID = PILOT_FIXTURE_DEFAULTS.organizationId
const DEMO_SUBJECT_ID = PILOT_FIXTURE_DEFAULTS.studySubjectId
const DEMO_VISIT_ID = PILOT_FIXTURE_DEFAULTS.visitId

/** Accepted unit cost per procedure ($285.00) */
const UNIT_COST = 285.00
/** Procedure counts that produce visible leakage at every stage */
const EXPECTED_PROC_COUNT = 48
const EXECUTED_PROC_COUNT = 44
const EARNED_PROC_COUNT = 38
/** Invoice and payment amounts — intentionally below earned to show gap */
const INVOICE_TOTAL = 9500.00
const PAYMENT_AMOUNT = 7200.00

// Stable seed identifiers — used for idempotency guards
const SEED_TAG = 'demo-financial-seed-v1'
const NEGOTIATION_EVENT_SEED_KEY = `${SEED_TAG}:negotiation`
const INVOICE_SEED_NUMBER = `DEMO-INV-001-${DEMO_STUDY_ID.slice(0, 8)}`
const PAYMENT_REF = `DEMO-PAY-001-${DEMO_STUDY_ID.slice(0, 8)}`

// ── Helpers ────────────────────────────────────────────────────────────────────

function stableSerialize(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value)
  if (Array.isArray(value)) {
    return `[${(value as unknown[]).map((item) => stableSerialize(item)).join(',')}]`
  }
  const record = value as Record<string, unknown>
  const keys = Object.keys(record).sort()
  return `{${keys.map((key) => `${JSON.stringify(key)}:${stableSerialize(record[key])}`).join(',')}}`
}

function computeStateHash(snapshot: Record<string, unknown>): string {
  return createHash('sha256').update(stableSerialize(snapshot)).digest('hex')
}

function log(message: string) {
  process.stdout.write(`${message}\n`)
}

function warn(message: string) {
  process.stderr.write(`[WARN] ${message}\n`)
}

// ── Validation ─────────────────────────────────────────────────────────────────

async function validateStudyExists(supabase: SupabaseClient): Promise<boolean> {
  const { data, error } = await supabase
    .from('studies')
    .select('id, name')
    .eq('id', DEMO_STUDY_ID)
    .maybeSingle()

  if (error) {
    warn(`Could not verify study: ${error.message}`)
    return false
  }
  if (!data) {
    warn(`Study ${DEMO_STUDY_ID} not found. Run the pilot fixture provisioning first.`)
    return false
  }
  log(`Study: ${data.name} (${data.id})`)
  return true
}

async function validateSubjectExists(supabase: SupabaseClient): Promise<boolean> {
  const { data, error } = await supabase
    .from('study_subjects')
    .select('id, subject_identifier')
    .eq('id', DEMO_SUBJECT_ID)
    .maybeSingle()

  if (error) {
    warn(`Could not verify subject: ${error.message}`)
    return false
  }
  if (!data) {
    warn(`Subject ${DEMO_SUBJECT_ID} not found. Run the pilot fixture provisioning first.`)
    return false
  }
  log(`Subject: ${data.subject_identifier} (${data.id})`)
  return true
}

async function validateVisitExists(supabase: SupabaseClient): Promise<boolean> {
  const { data, error } = await supabase
    .from('visits')
    .select('id')
    .eq('id', DEMO_VISIT_ID)
    .maybeSingle()

  if (error) {
    warn(`Could not verify visit: ${error.message}`)
    return false
  }
  if (!data) {
    warn(`Visit ${DEMO_VISIT_ID} not found. Run the pilot fixture provisioning first.`)
    return false
  }
  log(`Visit: ${data.id}`)
  return true
}

// ── Step 1: Seed budget negotiation events ─────────────────────────────────────
//
// Line items live inside event_payload.line_items (JSONB).
// The state_hash must be computed with the same algorithm as appendStudyBudgetNegotiationEvent.
//
// We seed 4 events to represent the full negotiation lifecycle:
//   1. sponsor_offer_received — initial offer (proposed, not accepted)
//   2. counteroffer_sent — site counteroffer (countered, pass-through gap)
//   3. term_accepted — accepted procedure line item at $285 (financialTruth=true)
//   4. term_accepted — accepted visit fee at $150 (financialTruth=true)

async function seedNegotiationEvents(supabase: SupabaseClient, dryRun: boolean): Promise<{
  inserted: number
  skipped: number
  acceptedEventId: string | null
}> {
  log('\n[1/4] Seeding negotiation events...')

  // Check for existing demo events for this study
  const { data: existing, error: existingError } = await supabase
    .from('study_budget_negotiation_events')
    .select('id, event_type, event_payload')
    .eq('organization_id', DEMO_ORG_ID)
    .eq('study_id', DEMO_STUDY_ID)
    .order('created_at', { ascending: true })

  if (existingError) {
    warn(`Could not check existing events: ${existingError.message}`)
  }

  // Check if demo seed events already exist (identified by seed_tag in event_payload)
  const alreadySeeded = (existing ?? []).filter((row) => {
    const payload = row.event_payload as Record<string, unknown> | null
    return payload?.seed_tag === SEED_TAG
  })

  if (alreadySeeded.length >= 4) {
    log(`  Skipped: ${alreadySeeded.length} demo events already present.`)
    // Return the ID of the accepted procedure event so invoice can reference it
    const acceptedEvent = alreadySeeded.find((row) => row.event_type === 'term_accepted')
    return { inserted: 0, skipped: alreadySeeded.length, acceptedEventId: acceptedEvent?.id ?? null }
  }

  const eventsToInsert = buildNegotiationEvents()

  if (dryRun) {
    log(`  [dry-run] Would insert ${eventsToInsert.length} events.`)
    return { inserted: eventsToInsert.length, skipped: 0, acceptedEventId: null }
  }

  let inserted = 0
  let acceptedEventId: string | null = null

  for (const event of eventsToInsert) {
    const { data, error } = await supabase
      .from('study_budget_negotiation_events')
      .insert(event)
      .select('id')
      .single()

    if (error) {
      warn(`  Failed to insert ${event.event_type}: ${error.message}`)
    } else {
      log(`  Inserted: ${event.event_type} (round ${event.negotiation_round})`)
      inserted++
      if (event.event_type === 'term_accepted' && acceptedEventId === null) {
        acceptedEventId = data?.id ?? null
      }
    }
  }

  return { inserted, skipped: alreadySeeded.length, acceptedEventId }
}

function buildNegotiationEvents() {
  const baseRow = {
    organization_id: DEMO_ORG_ID,
    study_id: DEMO_STUDY_ID,
    owner_role: 'coordinator',
    actor_user_id: null,
    study_subject_id: null,
    visit_id: null,
    procedure_id: null,
    source_document_id: null,
    source_chunk_id: null,
    protocol_version_id: null,
  }

  // Event 1: Sponsor offer (round 1)
  const sponsorOfferPayload = {
    seed_tag: SEED_TAG,
    line_items: [
      { label: 'Per-procedure fee', category: 'procedure', amount: 225, currency: 'USD', note: 'Initial sponsor offer — below FMV' },
      { label: 'Screening visit fee', category: 'visit', amount: 150, currency: 'USD', note: 'Bundled screening visit' },
      { label: 'Pass-through reimbursement', category: 'pass_through', amount: null, currency: 'USD', note: 'Actual cost — no cap stated' },
    ],
  }
  const sponsorOfferRow = {
    ...baseRow,
    event_type: 'sponsor_offer_received',
    title: 'Sponsor initial budget offer received',
    summary: 'Sponsor submitted initial budget offer at $225/procedure. FMV analysis shows a gap.',
    reason: null,
    recommended_next_step: 'Compare against FMV benchmark and protocol SOA, then prepare counteroffer.',
    negotiation_round: 1,
    event_payload: sponsorOfferPayload,
    created_at: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
    state_hash: computeStateHash({ ...baseRow, event_type: 'sponsor_offer_received', title: 'Sponsor initial budget offer received', negotiation_round: 1, event_payload: sponsorOfferPayload }),
  }

  // Event 2: Counteroffer sent (round 1) — pass-through not resolved
  const counterofferPayload = {
    seed_tag: SEED_TAG,
    line_items: [
      { label: 'Per-procedure fee — site ask', category: 'procedure', amount: 285, currency: 'USD', note: 'Site counter based on pharma FMV benchmark' },
      { label: 'Screening visit fee', category: 'visit', amount: 150, currency: 'USD', note: 'Accepted as stated' },
      { label: 'Pass-through — unresolved', category: 'pass_through', amount: null, currency: 'USD', note: 'Awaiting sponsor cap confirmation' },
    ],
  }
  const counterofferRow = {
    ...baseRow,
    event_type: 'counteroffer_sent',
    title: 'Site counteroffer sent to sponsor',
    summary: 'Site countered at $285/procedure. Pass-through cap remains open.',
    reason: 'Pharma FMV benchmark supports $285 unit cost. SOA includes 12 required procedures per visit.',
    recommended_next_step: 'Await sponsor response on procedure pricing and pass-through resolution.',
    negotiation_round: 1,
    event_payload: counterofferPayload,
    created_at: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
    state_hash: computeStateHash({ ...baseRow, event_type: 'counteroffer_sent', title: 'Site counteroffer sent to sponsor', negotiation_round: 1, event_payload: counterofferPayload }),
  }

  // Event 3: Term accepted — procedure pricing (financialTruth = true via term_accepted event type)
  const procedureAcceptedPayload = {
    seed_tag: SEED_TAG,
    accepted_financial_term: true,
    line_items: [
      { label: 'Per-procedure fee', category: 'procedure', amount: UNIT_COST, currency: 'USD', note: 'Agreed unit cost for invoiceable procedure execution' },
    ],
  }
  const procedureAcceptedRow = {
    ...baseRow,
    event_type: 'term_accepted',
    title: 'Procedure pricing accepted at $285.00',
    summary: `Sponsor accepted procedure unit cost of $${UNIT_COST.toFixed(2)}. This is the financial truth used for revenue projection.`,
    reason: 'Mutual agreement reached after round-1 negotiation.',
    recommended_next_step: 'Move accepted terms into Financial Runtime expectation and invoice logic.',
    negotiation_round: 1,
    event_payload: procedureAcceptedPayload,
    created_at: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    state_hash: computeStateHash({ ...baseRow, event_type: 'term_accepted', title: 'Procedure pricing accepted at $285.00', negotiation_round: 1, event_payload: procedureAcceptedPayload }),
  }

  // Event 4: Term accepted — visit fee (financialTruth = true)
  const visitFeeAcceptedPayload = {
    seed_tag: SEED_TAG,
    accepted_financial_term: true,
    line_items: [
      { label: 'Screening visit fee', category: 'visit', amount: 150, currency: 'USD', note: 'Agreed visit fee — separate from procedure revenue' },
    ],
  }
  const visitFeeAcceptedRow = {
    ...baseRow,
    event_type: 'term_accepted',
    title: 'Screening visit fee accepted at $150.00',
    summary: 'Sponsor accepted the $150 screening visit fee as a separate line item from procedure revenue.',
    reason: 'Visit fee keeps execution burden visible without bundling into per-procedure rate.',
    recommended_next_step: 'Apply visit fee to Financial Runtime for visit-level reconciliation.',
    negotiation_round: 1,
    event_payload: visitFeeAcceptedPayload,
    created_at: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000 + 60000).toISOString(),
    state_hash: computeStateHash({ ...baseRow, event_type: 'term_accepted', title: 'Screening visit fee accepted at $150.00', negotiation_round: 1, event_payload: visitFeeAcceptedPayload }),
  }

  // Order matters — most recent first in the ledger reader, but inserting oldest-first is natural
  return [sponsorOfferRow, counterofferRow, procedureAcceptedRow, visitFeeAcceptedRow]
}

// ── Step 2: Seed visit financial runtime projections ───────────────────────────
//
// visit_financial_runtime_projections has visit_id as PK.
// We upsert a single row for the pilot fixture visit with the aggregate procedure counts.
// The loader sums across all rows for the study — one row is sufficient for demo.

async function seedVisitRuntimeProjections(supabase: SupabaseClient, dryRun: boolean): Promise<{ action: 'inserted' | 'updated' | 'skipped' | 'dry-run' }> {
  log('\n[2/4] Seeding visit financial runtime projections...')

  // Check for existing row
  const { data: existing, error: existingError } = await supabase
    .from('visit_financial_runtime_projections')
    .select('visit_id, expected_procedure_count, executed_procedure_count, earned_procedure_count, snapshot')
    .eq('study_id', DEMO_STUDY_ID)
    .eq('visit_id', DEMO_VISIT_ID)
    .maybeSingle()

  if (existingError) {
    warn(`Could not check existing projection: ${existingError.message}`)
  }

  if (existing) {
    const snap = existing.snapshot as Record<string, unknown> | null
    if (snap?.seed_tag === SEED_TAG) {
      log(`  Skipped: projection already seeded (expected=${existing.expected_procedure_count}, executed=${existing.executed_procedure_count}, earned=${existing.earned_procedure_count}).`)
      return { action: 'skipped' }
    }
    log(`  Row exists but not from this seed — will update with demo data.`)
  }

  const earnedRateBasisPoints = Math.round((EARNED_PROC_COUNT / EXPECTED_PROC_COUNT) * 10000)
  const leakageScore = Math.round(((EXPECTED_PROC_COUNT - EARNED_PROC_COUNT) / EXPECTED_PROC_COUNT) * 100)

  const projectionRow = {
    visit_id: DEMO_VISIT_ID,
    organization_id: DEMO_ORG_ID,
    study_id: DEMO_STUDY_ID,
    study_subject_id: DEMO_SUBJECT_ID,
    computed_at: new Date().toISOString(),
    financial_version: 1,
    expected_procedure_count: EXPECTED_PROC_COUNT,
    executed_procedure_count: EXECUTED_PROC_COUNT,
    earned_procedure_count: EARNED_PROC_COUNT,
    leakage_item_count: EXPECTED_PROC_COUNT - EARNED_PROC_COUNT,
    leakage_score: leakageScore,
    earned_rate_basis_points: earnedRateBasisPoints,
    visit_financial_burden_score: leakageScore,
    expected: { procedure_count: EXPECTED_PROC_COUNT, seed_tag: SEED_TAG },
    executed: { procedure_count: EXECUTED_PROC_COUNT, seed_tag: SEED_TAG },
    earned: { procedure_count: EARNED_PROC_COUNT, seed_tag: SEED_TAG },
    leakage: [
      { kind: 'execution_gap', count: EXPECTED_PROC_COUNT - EXECUTED_PROC_COUNT, description: 'Procedures expected but not executed (scheduling gap)' },
      { kind: 'earn_gap', count: EXECUTED_PROC_COUNT - EARNED_PROC_COUNT, description: 'Procedures executed but not eligible (compliance gap)' },
    ],
    coordinator_economics: {},
    unscheduled_burden: {},
    amendment_impact: {},
    procedure_attributions: [],
    safeguards: [],
    snapshot: {
      seed_tag: SEED_TAG,
      expected_revenue: EXPECTED_PROC_COUNT * UNIT_COST,
      earned_revenue: EARNED_PROC_COUNT * UNIT_COST,
      unit_cost: UNIT_COST,
    },
  }

  if (dryRun) {
    log(`  [dry-run] Would upsert projection for visit ${DEMO_VISIT_ID} (expected=${EXPECTED_PROC_COUNT}, executed=${EXECUTED_PROC_COUNT}, earned=${EARNED_PROC_COUNT}).`)
    return { action: 'dry-run' }
  }

  const { error } = await supabase
    .from('visit_financial_runtime_projections')
    .upsert(projectionRow, { onConflict: 'visit_id' })

  if (error) {
    warn(`  Failed to upsert visit projection: ${error.message}`)
    return { action: 'skipped' }
  }

  const action = existing ? 'updated' : 'inserted'
  log(`  ${action === 'inserted' ? 'Inserted' : 'Updated'}: visit projection (expected=${EXPECTED_PROC_COUNT}, executed=${EXECUTED_PROC_COUNT}, earned=${EARNED_PROC_COUNT}, leakage_score=${leakageScore}).`)
  return { action }
}

// ── Step 3: Seed financial invoice ─────────────────────────────────────────────
//
// financial_invoices has a unique constraint on (visit_id) and unique invoice_number.
// It also requires study_subject_id and visit_id as NOT NULL FKs.
// We use the pilot fixture visit so FK constraints are satisfied.
// The study-level invoice summary reads by study_id, not visit_id.

async function seedInvoice(supabase: SupabaseClient, acceptedEventId: string | null, dryRun: boolean): Promise<{ invoiceId: string | null; action: 'inserted' | 'skipped' | 'dry-run' }> {
  log('\n[3/4] Seeding financial invoice...')

  // Check by invoice_number (unique)
  const { data: existing, error: existingError } = await supabase
    .from('financial_invoices')
    .select('id, invoice_number, total_amount, invoice_status')
    .eq('invoice_number', INVOICE_SEED_NUMBER)
    .maybeSingle()

  if (existingError) {
    warn(`Could not check existing invoice: ${existingError.message}`)
  }

  if (existing) {
    log(`  Skipped: invoice ${existing.invoice_number} already exists (total=${existing.total_amount}, status=${existing.invoice_status}).`)
    return { invoiceId: existing.id, action: 'skipped' }
  }

  const invoiceRow = {
    invoice_number: INVOICE_SEED_NUMBER,
    organization_id: DEMO_ORG_ID,
    study_id: DEMO_STUDY_ID,
    study_subject_id: DEMO_SUBJECT_ID,
    visit_id: DEMO_VISIT_ID,
    pricing_event_id: acceptedEventId ?? null,
    currency: 'USD',
    invoice_status: 'sent' as const,
    invoice_date: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    sent_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    total_amount: INVOICE_TOTAL,
    source_financial_version: 1,
    source_computed_at: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
  }

  if (dryRun) {
    log(`  [dry-run] Would insert invoice ${INVOICE_SEED_NUMBER} (total=$${INVOICE_TOTAL.toFixed(2)}, status=sent).`)
    return { invoiceId: null, action: 'dry-run' }
  }

  const { data, error } = await supabase
    .from('financial_invoices')
    .insert(invoiceRow)
    .select('id')
    .single()

  if (error) {
    warn(`  Failed to insert invoice: ${error.message}`)
    return { invoiceId: null, action: 'skipped' }
  }

  log(`  Inserted: invoice ${INVOICE_SEED_NUMBER} (id=${data.id}, total=$${INVOICE_TOTAL.toFixed(2)}, status=sent).`)
  return { invoiceId: data.id, action: 'inserted' }
}

// ── Step 4: Seed financial payment ─────────────────────────────────────────────
//
// financial_payments has a unique payment_reference.
// Requires invoice_id, visit_id, and study_subject_id as NOT NULL FKs.

async function seedPayment(supabase: SupabaseClient, invoiceId: string | null, acceptedEventId: string | null, dryRun: boolean): Promise<{ action: 'inserted' | 'skipped' | 'dry-run' | 'blocked' }> {
  log('\n[4/4] Seeding financial payment...')

  if (!invoiceId) {
    warn('  Blocked: cannot seed payment without a valid invoice ID.')
    return { action: 'blocked' }
  }

  // Check by payment_reference (unique)
  const { data: existing, error: existingError } = await supabase
    .from('financial_payments')
    .select('id, payment_reference, amount_applied, payment_status')
    .eq('payment_reference', PAYMENT_REF)
    .maybeSingle()

  if (existingError) {
    warn(`Could not check existing payment: ${existingError.message}`)
  }

  if (existing) {
    log(`  Skipped: payment ${existing.payment_reference} already exists (amount=${existing.amount_applied}, status=${existing.payment_status}).`)
    return { action: 'skipped' }
  }

  const paymentRow = {
    payment_reference: PAYMENT_REF,
    organization_id: DEMO_ORG_ID,
    study_id: DEMO_STUDY_ID,
    study_subject_id: DEMO_SUBJECT_ID,
    visit_id: DEMO_VISIT_ID,
    invoice_id: invoiceId,
    pricing_event_id: acceptedEventId ?? null,
    currency: 'USD',
    payment_method: 'ach',
    payment_status: 'posted' as const,
    amount_received: PAYMENT_AMOUNT,
    amount_applied: PAYMENT_AMOUNT,
    amount_unapplied: 0,
    received_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    posted_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    notes: `Demo seed payment — ${SEED_TAG}`,
  }

  if (dryRun) {
    log(`  [dry-run] Would insert payment ${PAYMENT_REF} (amount=$${PAYMENT_AMOUNT.toFixed(2)}, status=posted).`)
    return { action: 'dry-run' }
  }

  const { error } = await supabase
    .from('financial_payments')
    .insert(paymentRow)

  if (error) {
    warn(`  Failed to insert payment: ${error.message}`)
    return { action: 'skipped' }
  }

  log(`  Inserted: payment ${PAYMENT_REF} (amount=$${PAYMENT_AMOUNT.toFixed(2)}, status=posted).`)
  return { action: 'inserted' }
}

// ── Summary ────────────────────────────────────────────────────────────────────

function printSummary(results: {
  negotiationEvents: { inserted: number; skipped: number; acceptedEventId: string | null }
  projection: { action: string }
  invoice: { invoiceId: string | null; action: string }
  payment: { action: string }
}) {
  const expectedRevenue = EXPECTED_PROC_COUNT * UNIT_COST
  const earnedRevenue = EARNED_PROC_COUNT * UNIT_COST
  const expectedVsEarned = expectedRevenue - earnedRevenue
  const earnedVsInvoiced = earnedRevenue - INVOICE_TOTAL
  const invoicedVsPaid = INVOICE_TOTAL - PAYMENT_AMOUNT

  log('\n── Demo Financial Seed Summary ────────────────────────────────────────────')
  log(`Study ID:          ${DEMO_STUDY_ID}`)
  log(`Organization ID:   ${DEMO_ORG_ID}`)
  log(`Subject ID:        ${DEMO_SUBJECT_ID}`)
  log(`Visit ID:          ${DEMO_VISIT_ID}`)
  log('')
  log(`Negotiation events: inserted=${results.negotiationEvents.inserted}, skipped=${results.negotiationEvents.skipped}`)
  log(`  Accepted event ID: ${results.negotiationEvents.acceptedEventId ?? 'n/a'}`)
  log(`Visit projection:   ${results.projection.action}`)
  log(`Invoice:            ${results.invoice.action} (ID: ${results.invoice.invoiceId ?? 'n/a'})`)
  log(`Payment:            ${results.payment.action}`)
  log('')
  log('── Expected UI values ─────────────────────────────────────────────────────')
  log(`  Accepted unit cost:    $${UNIT_COST.toFixed(2)} / procedure`)
  log(`  Expected procedures:   ${EXPECTED_PROC_COUNT}`)
  log(`  Executed procedures:   ${EXECUTED_PROC_COUNT}`)
  log(`  Earned procedures:     ${EARNED_PROC_COUNT}`)
  log(`  Expected revenue:      $${expectedRevenue.toFixed(2)}   (${EXPECTED_PROC_COUNT} × $${UNIT_COST.toFixed(2)})`)
  log(`  Earned revenue:        $${earnedRevenue.toFixed(2)}   (${EARNED_PROC_COUNT} × $${UNIT_COST.toFixed(2)})`)
  log(`  Invoiced amount:       $${INVOICE_TOTAL.toFixed(2)}`)
  log(`  Paid amount:           $${PAYMENT_AMOUNT.toFixed(2)}`)
  log('')
  log('── Leakage pipeline ───────────────────────────────────────────────────────')
  log(`  Expected → Earned gap: $${expectedVsEarned.toFixed(2)}  (execution gap)`)
  log(`  Earned → Invoiced gap: $${earnedVsInvoiced.toFixed(2)}   (uninvoiced work)`)
  log(`  Invoiced → Paid gap:   $${invoicedVsPaid.toFixed(2)}   (outstanding receivables)`)
  log('───────────────────────────────────────────────────────────────────────────')
}

// ── Main ───────────────────────────────────────────────────────────────────────

async function main() {
  const dryRun = process.argv.includes('--dry-run')

  if (dryRun) {
    log('[dry-run mode] No database writes will occur.\n')
  }

  // Load env
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()

  if (!url || !serviceKey) {
    // Try loading from .env.local
    try {
      const { loadEnvFiles } = await import('./lib/env.mjs' as string)
      loadEnvFiles()
    } catch {
      // env.mjs may not be importable in all contexts — continue with process.env
    }
  }

  const resolvedUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
  const resolvedKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()

  if (!resolvedUrl || !resolvedKey) {
    process.stderr.write(
      'Error: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.\n' +
      'Copy .env.example → .env.local and fill in the Supabase staging values.\n',
    )
    process.exit(1)
  }

  const supabase = createClient(resolvedUrl, resolvedKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  log(`Target study: ${DEMO_STUDY_ID}`)
  log(`Mode: ${dryRun ? 'dry-run (no writes)' : 'live'}`)
  log('')

  // Validate prerequisites
  log('Validating prerequisites...')
  const studyOk = await validateStudyExists(supabase)
  if (!studyOk) {
    process.stderr.write(
      'Prerequisite failed: study not found. Ensure the pilot fixture study is provisioned.\n' +
      'Run: npx tsx scripts/phase11-runtime-pilot-fixture.ts\n',
    )
    process.exit(1)
  }

  const subjectOk = await validateSubjectExists(supabase)
  const visitOk = await validateVisitExists(supabase)

  if (!subjectOk || !visitOk) {
    process.stderr.write(
      'Prerequisite failed: subject or visit not found. financial_invoices and financial_payments require real FK rows.\n' +
      'Run: npx tsx scripts/phase11-runtime-pilot-fixture.ts\n',
    )
    process.exit(1)
  }

  // Run all seed steps
  const negotiationResult = await seedNegotiationEvents(supabase, dryRun)
  const projectionResult = await seedVisitRuntimeProjections(supabase, dryRun)
  const invoiceResult = await seedInvoice(supabase, negotiationResult.acceptedEventId, dryRun)
  const paymentResult = await seedPayment(supabase, invoiceResult.invoiceId, negotiationResult.acceptedEventId, dryRun)

  printSummary({
    negotiationEvents: negotiationResult,
    projection: projectionResult,
    invoice: invoiceResult,
    payment: paymentResult,
  })

  log('\nDone.')
}

main().catch((err) => {
  process.stderr.write(`seed-demo-financial failed: ${err instanceof Error ? err.message : String(err)}\n`)
  process.exit(1)
})
