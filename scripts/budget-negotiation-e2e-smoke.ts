/**
 * Budget negotiation end-to-end smoke.
 *
 * Default: offline fixture smoke that exercises the same budget/runtime/export helpers.
 * Live: if Supabase env is available, validates the real study workspace budget summary
 * and export document generation without introducing a parallel truth source.
 *
 * Run:
 *   npx tsx scripts/budget-negotiation-e2e-smoke.ts
 */
import { createClient } from '@supabase/supabase-js'
import { PILOT_FIXTURE_DEFAULTS } from '../lib/runtime-validation/pilot-fixture-defaults'
import { loadProtocolSetupModel } from '../lib/studies/load-protocol-setup'
import {
  buildBudgetNegotiationExportMarkdown,
  deriveBudgetNegotiationState,
  loadStudyBudgetEvidenceSummary,
  type StudyBudgetEvidenceSummary,
  type StudyBudgetNegotiationLedgerEntry,
} from '../lib/study-workspace/load-budget-evidence-summary'

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message)
}

function createLedgerEntry(
  eventType: StudyBudgetNegotiationLedgerEntry['eventType'],
  title: string,
  summary: string,
  createdAt: string,
  eventPayload: Record<string, unknown> = {},
): StudyBudgetNegotiationLedgerEntry {
  const lineItems = Array.isArray(eventPayload.line_items)
    ? eventPayload.line_items
        .map((item) => {
          if (!item || typeof item !== 'object' || Array.isArray(item)) return null
          const record = item as Record<string, unknown>
          const label = typeof record.label === 'string' ? record.label.trim() : ''
          if (!label) return null
          return {
            label,
            category: typeof record.category === 'string' ? record.category.trim() : 'other',
            amount:
              typeof record.amount === 'number' && Number.isFinite(record.amount)
                ? record.amount
                : typeof record.amount === 'string' && Number.isFinite(Number(record.amount))
                  ? Number(record.amount)
                  : null,
            currency:
              typeof record.currency === 'string' ? record.currency.trim().toUpperCase() || null : null,
            note: typeof record.note === 'string' ? record.note.trim() || null : null,
          }
        })
        .filter((item): item is NonNullable<typeof item> => item !== null)
    : []
  return {
    id: `${eventType}-${createdAt}`,
    eventType,
    title,
    summary,
    reason: null,
    recommendedNextStep: null,
    ownerRole: 'coordinator',
    negotiationRound: 1,
    protocolVersionId: 'protocol-version-smoke',
    studySubjectId: 'subject-smoke',
    visitId: 'visit-smoke',
    procedureId: null,
    sourceDocumentId: 'source-document-smoke',
    sourceChunkId: null,
    actorUserId: 'actor-smoke',
    createdAt,
    linkedObjects: [
      { kind: 'study', id: PILOT_FIXTURE_DEFAULTS.studyId },
      { kind: 'protocol_version', id: 'protocol-version-smoke' },
      { kind: 'source_document', id: 'source-document-smoke' },
    ],
    lineItems,
    eventPayload,
  }
}

function buildOfflineSummary(): {
  summary: StudyBudgetEvidenceSummary
  studyName: string
  protocolSetup: Awaited<ReturnType<typeof loadProtocolSetupModel>> | null
} {
  const protocolSetup = {
    visits: [
      {
        id: 'visit-screening',
        code: 'SCR',
        label: 'Screening',
        eligibleArms: 'Arm A',
        eligibleSubjectRoles: 'Participant',
        modality: 'in_person',
      },
      {
        id: 'visit-baseline',
        code: 'BL',
        label: 'Baseline',
        eligibleArms: 'Arm A',
        eligibleSubjectRoles: 'Participant',
        modality: 'in_person',
      },
    ],
    procedureMaps: [
      {
        id: 'map-1',
        visitLabel: 'Screening',
        procedureLabel: 'CBC',
        isConditional: false,
        conditionLabel: null,
      },
      {
        id: 'map-2',
        visitLabel: 'Baseline',
        procedureLabel: 'AE review',
        isConditional: true,
        conditionLabel: 'If adverse event present',
      },
    ],
    error: null,
  } satisfies Awaited<ReturnType<typeof loadProtocolSetupModel>>

  const ledger = [
    createLedgerEntry(
      'counteroffer_sent',
      'Counteroffer sent',
      'Site counteroffer was sent back to the sponsor.',
      '2026-06-03T12:04:00.000Z',
      {
        line_items: [
          { label: 'Screening visit', category: 'visit', amount: 250, currency: 'USD' },
        ],
      },
    ),
    createLedgerEntry(
      'counteroffer_drafted',
      'Counteroffer drafted',
      'Site drafted response from the protocol SOA and indexed evidence.',
      '2026-06-03T12:03:00.000Z',
    ),
    createLedgerEntry(
      'sponsor_offer_received',
      'Sponsor offer received',
      'Sponsor budget terms were captured for review.',
      '2026-06-03T12:02:00.000Z',
      {
        visit_payment: '250',
        procedure_payment: '125 per procedure',
        payment_terms: 'net 30',
        invoice_due_terms: 'due within 15 days',
        line_items: [
          { label: 'Screening visit', category: 'visit', amount: 250, currency: 'USD' },
          { label: 'CBC', category: 'procedure', amount: 125, currency: 'USD' },
        ],
      },
    ),
  ]

  const negotiationState = deriveBudgetNegotiationState({
    hasBudgetEvidence: true,
    negotiationLedger: ledger,
  })
  const budgetIntelligence = {
    fmvGap: {
      level: 'high' as const,
      summary: 'FMV gap relative to the biospecimen reference family is +$853.50.',
      details: [
        'Benchmark family: biospecimen',
        'Sponsor offer total: $375.00',
        'Reference families: Pharma 24393.93, Biospecimen 1424.25, IVD 3782.70',
      ],
      benchmarkFamily: 'biospecimen',
      benchmarkUsd: 1424.25,
      sponsorOfferUsd: 375,
      gapUsd: 1049.25,
    },
    operationalBurdenGap: {
      level: 'moderate' as const,
      summary:
        'Operational burden gap is moderate: 1 required procedure mapping(s) remain to be explicitly reflected.',
      details: [
        'Required procedure mappings: 1',
        'Structured procedure line items: 1',
        'Structured visit line items: 1',
      ],
      missingRequiredProcedureLineItems: 1,
      procedureLineItemCount: 1,
    },
    paymentTermRisk: {
      level: 'moderate' as const,
      summary:
        'Payment term risk is present, but the sponsor terms and indexed evidence provide partial support.',
      details: ['Payment terms hints: 2', 'Invoice due hints: 1'],
    },
    passThroughRisk: {
      level: 'low' as const,
      summary: 'Pass-through risk is low because sponsor terms preserve reimbursable cost handling.',
      details: ['Pass-through hints: 1', 'Pass-through line items: 0'],
    },
    screenFailureProtectionGap: {
      level: 'high' as const,
      summary:
        'Screen failure protection gap is high because the $0 visit logic is not clearly protected in the sponsor offer.',
      details: ['Screen failure hints: 1', 'Screen fail line items: 0'],
    },
    recommendedCounterofferLanguage: [
      'Separate visit payment from procedure payment so the SOA burden stays visible.',
      'State payment terms and invoice due timing explicitly in the response.',
      'Preserve pass-through reimbursement at actual cost with supporting documentation.',
      'Keep screen-fail economics separate from billable procedure revenue.',
      'Use the biospecimen FMV reference family as the negotiation anchor while keeping the protocol SOA as the execution baseline.',
    ],
    projectedRevenueImpact: {
      benchmarkUsd: 1424.25,
      sponsorOfferUsd: 375,
      projectedDeltaUsd: 1049.25,
      summary: 'Projected negotiation upside is approximately $1049.25 against the current sponsor offer.',
    },
  }

  const summary: StudyBudgetEvidenceSummary = {
    budgetDocumentCount: 2,
    contractDocumentCount: 1,
    budgetChunkCount: 8,
    contractChunkCount: 3,
    activeBudgetReferenceCount: 1,
    activeContractReferenceCount: 1,
    paymentTermsHintCount: 2,
    invoiceDueHintCount: 1,
    passThroughHintCount: 1,
    screenFailureHintCount: 1,
    invoiceableProcedureHintCount: 2,
    negotiationFocusAreas: [
      { label: 'Payment terms', count: 2, nextStep: 'Confirm invoice timing and payment cadence.' },
      { label: 'Invoice due', count: 1, nextStep: 'Verify due date language and invoice submission rules.' },
      { label: 'Pass-through', count: 1, nextStep: 'Check reimbursable cost language and actual-cost policy.' },
      { label: 'Screen failure', count: 1, nextStep: 'Confirm screen-fail payment handling and zero-visit policy.' },
      { label: 'Invoiceable procedures', count: 2, nextStep: 'Review procedure-level billable language for the budget.' },
    ],
    soaComparison: {
      visitCount: protocolSetup.visits.length,
      procedureCount: protocolSetup.procedureMaps.length,
      conditionalProcedureCount: protocolSetup.procedureMaps.filter((row) => row.isConditional).length,
      requiredProcedureCount: protocolSetup.procedureMaps.filter((row) => !row.isConditional).length,
      summary: 'SOA loaded with 2 visits and 2 procedure mappings (1 conditional / 1 required).',
    },
    counterofferDraft: {
      title: 'Draft counteroffer response',
      summary: 'Use the SOA and indexed evidence to answer the sponsor proposal.',
      items: [
        {
          label: 'Separate visit and procedure payment',
          ask: 'Keep visit payment independent from procedure payment.',
          rationale: 'Bundled visit fees obscure real execution burden.',
        },
        {
          label: 'Protect screen-fail economics',
          ask: 'Keep billable procedures invoiceable when visit payment is $0.',
          rationale: 'Screen failure should not erase lab, imaging, or procedure revenue.',
        },
      ],
    },
    negotiationLedger: ledger,
    negotiationReadiness: 'ready',
    negotiationReason: 'Budget and CTA evidence is indexed and ready for negotiation review.',
    negotiationNextStep: 'Review candidate source chunks before negotiating terms.',
    negotiationState,
    budgetIntelligence,
    unavailable: [],
  }

  return {
    summary,
    studyName: 'Budget Negotiation Smoke Study',
    protocolSetup,
  }
}

async function loadLiveSummary() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  if (!url || !serviceKey) return null

  const supabase = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const studyId = process.env.BUDGET_NEGOTIATION_SMOKE_STUDY_ID?.trim() ?? PILOT_FIXTURE_DEFAULTS.studyId
  const organizationId =
    process.env.BUDGET_NEGOTIATION_SMOKE_ORG_ID?.trim() ?? PILOT_FIXTURE_DEFAULTS.organizationId

  const protocolSetup = await loadProtocolSetupModel({ studyId, organizationId })
  const summary = await loadStudyBudgetEvidenceSummary(studyId, organizationId, protocolSetup, supabase)
  const { data: study } = await supabase.from('studies').select('name').eq('id', studyId).maybeSingle()

  return {
    summary,
    studyName: String(study?.name ?? 'Study'),
    studyId,
    organizationId,
    protocolSetup,
  }
}

async function main() {
  const live = await loadLiveSummary()
  const source = live ?? buildOfflineSummary()
  const markdown = buildBudgetNegotiationExportMarkdown({
    studyName: source.studyName,
    studyId: live?.studyId ?? PILOT_FIXTURE_DEFAULTS.studyId,
    organizationId: live?.organizationId ?? PILOT_FIXTURE_DEFAULTS.organizationId,
    generatedAt: new Date().toISOString(),
    summary: source.summary,
    protocolSetup: source.protocolSetup,
  })

  assert(markdown.includes('# Budget Negotiation Counteroffer Export'), 'export heading is present')
  assert(markdown.includes('## Operational sequence'), 'operational sequence is present')
  assert(markdown.includes('Counteroffer drafted'), 'counteroffer draft is present')
  assert(markdown.includes('Current state: Counteroffer sent'), 'current state is derived from the latest event')
  assert(markdown.includes('Latest sponsor offer snapshot'), 'sponsor offer snapshot is exported')
  assert(markdown.includes('Structured line items: 2'), 'structured line items are exported')
  assert(markdown.includes('| Label | Category | Amount | Currency | Note | Response guidance |'), 'line item table is exported')
  assert(markdown.includes('Screening visit'), 'line item label is exported')
  assert(markdown.includes('## Budget negotiation intelligence v1'), 'budget intelligence section is exported')
  assert(markdown.includes('FMV gap:'), 'FMV gap summary is exported')
  assert(markdown.includes('Recommended counteroffer language:'), 'counteroffer language is exported')
  assert(
    markdown.includes('Financial Runtime remains the source of truth'),
    'financial guardrail is included',
  )
  assert(source.summary.negotiationState.key === 'counteroffer_sent', 'state derivation reached counteroffer_sent')
  assert(source.summary.budgetIntelligence.fmvGap.level !== 'unknown', 'FMV gap is derived')
  assert(source.summary.budgetIntelligence.recommendedCounterofferLanguage.length > 0, 'counteroffer language exists')
  assert(
    source.summary.negotiationLedger[0]?.lineItems.length === 1,
    'latest counteroffer carries persisted line items',
  )

  console.log('Budget negotiation end-to-end smoke test passed.')
  console.log(
    `Mode: ${live ? 'live' : 'offline fixture'} | Current state: ${source.summary.negotiationState.label}`,
  )
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
