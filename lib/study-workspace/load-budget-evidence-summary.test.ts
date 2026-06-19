import { describe, expect, it } from 'vitest'
import {
  deriveBudgetNegotiationIntelligence,
} from './load-budget-evidence-summary'
import type {
  StudyBudgetNegotiationLedgerEntry,
  StudyBudgetNegotiationLineItem,
  StudyBudgetEvidenceSummary,
} from './load-budget-evidence-summary'
import type { ActivityCodeEntry } from '@/lib/cliniq-core/activity-code-library'

// ── Fixtures ──────────────────────────────────────────────────────────────────

type SummaryInput = Parameters<typeof deriveBudgetNegotiationIntelligence>[0]['summary']

function makeLineItem(
  overrides: Partial<StudyBudgetNegotiationLineItem> = {},
): StudyBudgetNegotiationLineItem {
  return {
    label: 'Test Item',
    category: 'procedure',
    amount: 100,
    currency: 'USD',
    note: null,
    status: 'proposed',
    financialTruth: false,
    ...overrides,
  }
}

function makeLedgerEntry(
  eventType: StudyBudgetNegotiationLedgerEntry['eventType'],
  lineItems: StudyBudgetNegotiationLineItem[],
): StudyBudgetNegotiationLedgerEntry {
  return {
    id: `entry-${eventType}`,
    eventType,
    title: eventType,
    summary: '',
    reason: null,
    recommendedNextStep: null,
    ownerRole: 'coordinator',
    negotiationRound: 1,
    protocolVersionId: null,
    studySubjectId: null,
    visitId: null,
    procedureId: null,
    sourceDocumentId: null,
    sourceChunkId: null,
    actorUserId: null,
    createdAt: new Date().toISOString(),
    linkedObjects: [],
    lineItems,
    eventPayload: {},
  }
}

function makeSummary(
  ledger: StudyBudgetNegotiationLedgerEntry[],
  overrides: Partial<SummaryInput> = {},
): SummaryInput {
  return {
    negotiationLedger: ledger,
    negotiationReadiness: 'blocked',
    negotiationState: {
      key: 'missing_evidence',
      label: '',
      nextStep: '',
      sequence: [],
    },
    negotiationFocusAreas: [],
    paymentTermsHintCount: null,
    invoiceDueHintCount: null,
    passThroughHintCount: null,
    screenFailureHintCount: null,
    invoiceableProcedureHintCount: null,
    soaComparison: {
      visitCount: null,
      procedureCount: null,
      conditionalProcedureCount: null,
      requiredProcedureCount: null,
      summary: '',
    },
    ...overrides,
  }
}

// Small catalog with 3-4 entries covering the test scenarios
const testCatalog: ActivityCodeEntry[] = [
  {
    id: '1',
    code: 'COORD_HOUR',
    name: 'Coordinator Time',
    category: 'operational',
    typical_unit: 'per_hour',
    fmv_low: 65,
    fmv_high: 85,
    sub_category: null,
    organization_id: null,
    notes: null,
  },
  {
    id: '2',
    code: 'IRB_ANNUAL',
    name: 'IRB Annual Renewal Fee',
    category: 'regulatory',
    typical_unit: 'flat',
    fmv_low: null,
    fmv_high: null,
    sub_category: null,
    organization_id: null,
    notes: null,
  },
  {
    id: '3',
    code: 'ECG',
    name: 'Electrocardiogram (ECG)',
    category: 'clinical',
    typical_unit: 'per_visit',
    fmv_low: 50,
    fmv_high: 80,
    sub_category: null,
    organization_id: null,
    notes: null,
  },
  {
    // Narrow band so a below-fmv_low amount can land a gap in the moderate
    // window [10, 20]; COORD_HOUR's wide band only ever yields >20 (high).
    id: '4',
    code: 'MOD_TEST',
    name: 'Moderate Band Activity',
    category: 'financial',
    typical_unit: 'flat',
    fmv_low: 95,
    fmv_high: 100,
    sub_category: null,
    organization_id: null,
    notes: null,
  },
]

function sponsorOfferWith(
  amount: number,
  activity_code: string,
): StudyBudgetNegotiationLedgerEntry[] {
  return [
    makeLedgerEntry('sponsor_offer_received', [
      makeLineItem({ label: 'Item', amount, activity_code }),
    ]),
  ]
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('deriveBudgetNegotiationIntelligence', () => {
  it('1. empty ledger — returns output without crash; no perActivityDetails; no unpricedItems', () => {
    const result = deriveBudgetNegotiationIntelligence({
      summary: makeSummary([]),
    })
    expect(result.fmvGap).toBeDefined()
    expect(result.fmvGap.perActivityDetails).toBeUndefined()
    expect(result.unpricedItems).toBeUndefined()
    expect(result.fmvGap.level).toBe('unknown')
  })

  it('2. no sponsor_offer_received event — no perActivityDetails; fallback path unchanged', () => {
    const ledger = [
      makeLedgerEntry('counteroffer_drafted', [makeLineItem({ label: 'Site Fee', amount: 500 })]),
    ]
    const result = deriveBudgetNegotiationIntelligence({
      summary: makeSummary(ledger),
      activityCodeCatalog: testCatalog,
    })
    expect(result.fmvGap.perActivityDetails).toBeUndefined()
    // No sponsor offer means sponsorOfferUsd sums to 0, gapUsd will be non-null only if
    // sponsorOfferLineItems.length > 0 for the offer event — not present here
    expect(result.fmvGap.sponsorOfferUsd).toBeNull()
  })

  it('3. line items, no activity_code, no catalog — identical to pre-change behavior; perActivityDetails undefined', () => {
    const ledger = [
      makeLedgerEntry('sponsor_offer_received', [
        makeLineItem({ label: 'Site Fee', amount: 5000, category: 'procedure' }),
        makeLineItem({ label: 'Visit Fee', amount: 1000, category: 'visit' }),
      ]),
    ]
    const withoutCatalog = deriveBudgetNegotiationIntelligence({ summary: makeSummary(ledger) })
    const withEmptyCatalog = deriveBudgetNegotiationIntelligence({
      summary: makeSummary(ledger),
      activityCodeCatalog: [],
    })
    // Both must be identical in the enriched fields
    expect(withoutCatalog.fmvGap.perActivityDetails).toBeUndefined()
    expect(withEmptyCatalog.fmvGap.perActivityDetails).toBeUndefined()
    // Family-level benchmark must be computed
    expect(withoutCatalog.fmvGap.benchmarkFamily).not.toBe('unclassified')
    expect(withoutCatalog.fmvGap.gapUsd).toEqual(withEmptyCatalog.fmvGap.gapUsd)
    expect(withoutCatalog.fmvGap.level).toEqual(withEmptyCatalog.fmvGap.level)
  })

  it('4. catalog present, no matching code on items — perActivityDetails undefined; family fallback', () => {
    const ledger = [
      makeLedgerEntry('sponsor_offer_received', [
        makeLineItem({ label: 'Site Fee', amount: 5000, category: 'procedure' }),
      ]),
    ]
    const result = deriveBudgetNegotiationIntelligence({
      summary: makeSummary(ledger),
      activityCodeCatalog: testCatalog,
    })
    expect(result.fmvGap.perActivityDetails).toBeUndefined()
    // Family-level benchmark still computed
    expect(result.fmvGap.gapUsd).not.toBeNull()
  })

  it('5. matched code, amount below fmv_low — perActivityDetails has detail with "Gap: N%"; level reflects gap', () => {
    // COORD_HOUR: fmv_low=65, fmv_high=85; amount=45 → gap = (85-45)/85*100 = 47%
    const ledger = [
      makeLedgerEntry('sponsor_offer_received', [
        makeLineItem({ label: 'Coordinator', amount: 45, activity_code: 'COORD_HOUR' }),
      ]),
    ]
    const result = deriveBudgetNegotiationIntelligence({
      summary: makeSummary(ledger),
      activityCodeCatalog: testCatalog,
    })
    expect(result.fmvGap.perActivityDetails).toBeDefined()
    expect(result.fmvGap.perActivityDetails).toHaveLength(1)
    const detail = result.fmvGap.perActivityDetails![0]
    expect(detail).toContain('Coordinator Time (Operational)')
    expect(detail).toContain('$45/per_hour offered')
    expect(detail).toContain('expected $65–85/per_hour')
    expect(detail).toContain('Gap: 47%.')
    // gap > 20 → level must be high
    expect(result.fmvGap.level).toBe('high')
  })

  it('6. matched code, amount within range (>= fmv_low) — detail rendered WITHOUT "Gap:" clause; gap not counted', () => {
    // ECG: fmv_low=50, fmv_high=80; amount=60 (within range)
    const ledger = [
      makeLedgerEntry('sponsor_offer_received', [
        makeLineItem({ label: 'ECG', amount: 60, activity_code: 'ECG' }),
      ]),
    ]
    const result = deriveBudgetNegotiationIntelligence({
      summary: makeSummary(ledger),
      activityCodeCatalog: testCatalog,
    })
    expect(result.fmvGap.perActivityDetails).toBeDefined()
    expect(result.fmvGap.perActivityDetails).toHaveLength(1)
    const detail = result.fmvGap.perActivityDetails![0]
    expect(detail).toContain('Electrocardiogram (ECG) (Clinical)')
    expect(detail).not.toContain('Gap:')
    // No gap percents → enriched level should be 'low'
    expect(result.fmvGap.level).toBe('low')
  })

  it('7. matched code but entry fmv_low/fmv_high null — no detail produced; no fabricated range', () => {
    // IRB_ANNUAL has fmv_low=null, fmv_high=null → no detail
    const ledger = [
      makeLedgerEntry('sponsor_offer_received', [
        makeLineItem({ label: 'IRB Annual', amount: 1500, activity_code: 'IRB_ANNUAL' }),
      ]),
    ]
    const result = deriveBudgetNegotiationIntelligence({
      summary: makeSummary(ledger),
      activityCodeCatalog: testCatalog,
    })
    expect(result.fmvGap.perActivityDetails).toBeUndefined()
  })

  it('8. unpriced items with matching codes — unpricedItems contains named list', () => {
    // IRB_ANNUAL and COORD_HOUR both unpriced
    const ledger = [
      makeLedgerEntry('term_adjusted', [
        makeLineItem({ label: 'IRB', amount: null, status: 'unpriced', activity_code: 'IRB_ANNUAL' }),
        makeLineItem({ label: 'Coordinator', amount: null, status: 'unpriced', activity_code: 'COORD_HOUR' }),
      ]),
    ]
    const result = deriveBudgetNegotiationIntelligence({
      summary: makeSummary(ledger),
      activityCodeCatalog: testCatalog,
    })
    expect(result.unpricedItems).toBeDefined()
    expect(result.unpricedItems).toHaveLength(2)
    expect(result.unpricedItems).toContain('IRB Annual Renewal Fee (Regulatory)')
    expect(result.unpricedItems).toContain('Coordinator Time (Operational)')
  })

  it('9. unpriced items without codes — unpricedItems still populated with label fallback', () => {
    const ledger = [
      makeLedgerEntry('sponsor_offer_received', [
        makeLineItem({ label: 'Mystery Fee', amount: null, status: 'unpriced' }),
        makeLineItem({ label: 'Lab Cost', amount: null, status: 'unpriced' }),
      ]),
    ]
    const result = deriveBudgetNegotiationIntelligence({
      summary: makeSummary(ledger),
      activityCodeCatalog: testCatalog,
    })
    expect(result.unpricedItems).toBeDefined()
    expect(result.unpricedItems).toHaveLength(2)
    expect(result.unpricedItems).toContain('Mystery Fee')
    expect(result.unpricedItems).toContain('Lab Cost')
  })

  // ── FMV gap severity boundary cases (R3-B: moderate branch + cutoffs) ─────────
  // MOD_TEST: fmv_low=95, fmv_high=100. gap% = round((100 - amount) / 100 * 100).

  it('10. gap in (10,20) — enriched level is moderate', () => {
    // amount=88 → gap = round((100-88)/100*100) = 12 → moderate
    const result = deriveBudgetNegotiationIntelligence({
      summary: makeSummary(sponsorOfferWith(88, 'MOD_TEST')),
      activityCodeCatalog: testCatalog,
    })
    expect(result.fmvGap.perActivityDetails![0]).toContain('Gap: 12%.')
    expect(result.fmvGap.level).toBe('moderate')
  })

  it('11. boundary gap == 20 — moderate (not high, since rule is > 20)', () => {
    // amount=80 → gap = 20 → moderate
    const result = deriveBudgetNegotiationIntelligence({
      summary: makeSummary(sponsorOfferWith(80, 'MOD_TEST')),
      activityCodeCatalog: testCatalog,
    })
    expect(result.fmvGap.perActivityDetails![0]).toContain('Gap: 20%.')
    expect(result.fmvGap.level).toBe('moderate')
  })

  it('12. boundary gap == 21 — high (> 20)', () => {
    // amount=79 → gap = 21 → high
    const result = deriveBudgetNegotiationIntelligence({
      summary: makeSummary(sponsorOfferWith(79, 'MOD_TEST')),
      activityCodeCatalog: testCatalog,
    })
    expect(result.fmvGap.perActivityDetails![0]).toContain('Gap: 21%.')
    expect(result.fmvGap.level).toBe('high')
  })

  it('13. boundary gap == 10 vs 9 — 10 is moderate, 9 is low', () => {
    // amount=90 → gap = 10 → moderate
    const moderate = deriveBudgetNegotiationIntelligence({
      summary: makeSummary(sponsorOfferWith(90, 'MOD_TEST')),
      activityCodeCatalog: testCatalog,
    })
    expect(moderate.fmvGap.perActivityDetails![0]).toContain('Gap: 10%.')
    expect(moderate.fmvGap.level).toBe('moderate')

    // amount=91 → gap = 9 → low (only gap present, below moderate cutoff)
    const low = deriveBudgetNegotiationIntelligence({
      summary: makeSummary(sponsorOfferWith(91, 'MOD_TEST')),
      activityCodeCatalog: testCatalog,
    })
    expect(low.fmvGap.perActivityDetails![0]).toContain('Gap: 9%.')
    expect(low.fmvGap.level).toBe('low')
  })

  it('14. same unpriced code across multiple ledger rounds — deduped to one entry (R3-D)', () => {
    const ledger = [
      makeLedgerEntry('term_adjusted', [
        makeLineItem({ label: 'IRB', amount: null, status: 'unpriced', activity_code: 'IRB_ANNUAL' }),
      ]),
      makeLedgerEntry('counteroffer_drafted', [
        makeLineItem({ label: 'IRB', amount: null, status: 'unpriced', activity_code: 'IRB_ANNUAL' }),
      ]),
    ]
    const result = deriveBudgetNegotiationIntelligence({
      summary: makeSummary(ledger),
      activityCodeCatalog: testCatalog,
    })
    expect(result.unpricedItems).toEqual(['IRB Annual Renewal Fee (Regulatory)'])
  })
})
