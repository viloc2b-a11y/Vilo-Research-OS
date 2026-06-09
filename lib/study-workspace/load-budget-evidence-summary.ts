import { createHash } from 'crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createServerClient } from '@/lib/supabase/server'
import type { ProtocolSetupModel } from '@/lib/studies/load-protocol-setup'

type BudgetEvidenceDomain = 'budget_analysis' | 'contract_analysis'

export type StudyBudgetNegotiationEventType =
  | 'sponsor_offer_received'
  | 'counteroffer_drafted'
  | 'counteroffer_sent'
  | 'sponsor_reply_received'
  | 'term_accepted'
  | 'term_rejected'
  | 'term_adjusted'
  | 'evidence_linked'

export type StudyBudgetNegotiationLedgerEntry = {
  id: string
  eventType: StudyBudgetNegotiationEventType
  title: string
  summary: string
  reason: string | null
  recommendedNextStep: string | null
  ownerRole: string
  negotiationRound: number
  protocolVersionId: string | null
  studySubjectId: string | null
  visitId: string | null
  procedureId: string | null
  sourceDocumentId: string | null
  sourceChunkId: string | null
  actorUserId: string | null
  createdAt: string
  linkedObjects: {
    kind: 'study' | 'subject' | 'visit' | 'procedure' | 'source_document' | 'source_chunk' | 'protocol_version'
    id: string
  }[]
  lineItems: StudyBudgetNegotiationLineItem[]
  eventPayload: Record<string, unknown>
}

export type StudyBudgetNegotiationLineItem = {
  label: string
  category: string
  amount: number | null
  currency: string | null
  note: string | null
}

export type StudyBudgetCounterofferItem = {
  label: string
  ask: string
  rationale: string
}

export type StudyBudgetCounterofferDraft = {
  title: string
  summary: string
  items: StudyBudgetCounterofferItem[]
}

export type StudyBudgetSoaComparison = {
  visitCount: number | null
  procedureCount: number | null
  conditionalProcedureCount: number | null
  requiredProcedureCount: number | null
  summary: string
}

export type StudyBudgetNegotiationStateKey =
  | 'missing_evidence'
  | 'soa_reviewed'
  | 'sponsor_offer_received'
  | 'counteroffer_drafted'
  | 'counteroffer_sent'
  | 'sponsor_reply_received'
  | 'term_accepted'
  | 'term_adjusted'
  | 'term_rejected'

export type StudyBudgetNegotiationStateStep = {
  key: StudyBudgetNegotiationStateKey
  label: string
  status: 'complete' | 'current' | 'pending'
}

export type StudyBudgetNegotiationState = {
  key: StudyBudgetNegotiationStateKey
  label: string
  nextStep: string
  sequence: StudyBudgetNegotiationStateStep[]
}

export type StudyBudgetNegotiationSignalLevel = 'low' | 'moderate' | 'high' | 'unknown'

export type StudyBudgetNegotiationSignal = {
  level: StudyBudgetNegotiationSignalLevel
  summary: string
  details: string[]
}

export type StudyBudgetNegotiationIntelligence = {
  fmvGap: StudyBudgetNegotiationSignal & {
    benchmarkFamily: string
    benchmarkUsd: number | null
    sponsorOfferUsd: number | null
    gapUsd: number | null
  }
  operationalBurdenGap: StudyBudgetNegotiationSignal & {
    missingRequiredProcedureLineItems: number | null
    procedureLineItemCount: number | null
  }
  paymentTermRisk: StudyBudgetNegotiationSignal
  passThroughRisk: StudyBudgetNegotiationSignal
  screenFailureProtectionGap: StudyBudgetNegotiationSignal
  recommendedCounterofferLanguage: string[]
  projectedRevenueImpact: {
    benchmarkUsd: number | null
    sponsorOfferUsd: number | null
    projectedDeltaUsd: number | null
    summary: string
  }
}

export type StudyBudgetEvidenceSummary = {
  budgetDocumentCount: number | null
  contractDocumentCount: number | null
  budgetChunkCount: number | null
  contractChunkCount: number | null
  activeBudgetReferenceCount: number | null
  activeContractReferenceCount: number | null
  paymentTermsHintCount: number | null
  invoiceDueHintCount: number | null
  passThroughHintCount: number | null
  screenFailureHintCount: number | null
  invoiceableProcedureHintCount: number | null
  negotiationFocusAreas: {
    label: string
    count: number | null
    nextStep: string
  }[]
  soaComparison: StudyBudgetSoaComparison
  counterofferDraft: StudyBudgetCounterofferDraft
  negotiationLedger: StudyBudgetNegotiationLedgerEntry[]
  negotiationReadiness: 'ready' | 'review_needed' | 'blocked'
  negotiationReason: string
  negotiationNextStep: string
  negotiationState: StudyBudgetNegotiationState
  budgetIntelligence: StudyBudgetNegotiationIntelligence
  unavailable: string[]
}

const EMPTY_SUMMARY: StudyBudgetEvidenceSummary = {
  budgetDocumentCount: null,
  contractDocumentCount: null,
  budgetChunkCount: null,
  contractChunkCount: null,
  activeBudgetReferenceCount: null,
  activeContractReferenceCount: null,
  paymentTermsHintCount: null,
  invoiceDueHintCount: null,
  passThroughHintCount: null,
  screenFailureHintCount: null,
  invoiceableProcedureHintCount: null,
  negotiationFocusAreas: [],
  soaComparison: {
    visitCount: null,
    procedureCount: null,
    conditionalProcedureCount: null,
    requiredProcedureCount: null,
    summary: 'Protocol SOA is not loaded yet.',
  },
  counterofferDraft: {
    title: 'Draft counteroffer response',
    summary: 'Budget and CTA evidence have not been indexed yet.',
    items: [],
  },
  negotiationLedger: [],
  negotiationReadiness: 'blocked',
  negotiationReason: 'Budget and CTA evidence have not been indexed yet.',
  negotiationNextStep: 'Open Document Intelligence and ingest Budget / CTA documents.',
  negotiationState: {
    key: 'missing_evidence',
    label: 'Evidence missing',
    nextStep: 'Open Document Intelligence and ingest Budget / CTA documents.',
    sequence: [],
  },
  budgetIntelligence: {
    fmvGap: {
      level: 'unknown',
      summary: 'FMV gap is unavailable until sponsor line items are captured.',
      details: [],
      benchmarkFamily: 'unclassified',
      benchmarkUsd: null,
      sponsorOfferUsd: null,
      gapUsd: null,
    },
    operationalBurdenGap: {
      level: 'unknown',
      summary: 'Operational burden gap is unavailable until sponsor line items are captured.',
      details: [],
      missingRequiredProcedureLineItems: null,
      procedureLineItemCount: null,
    },
    paymentTermRisk: {
      level: 'unknown',
      summary: 'Payment term risk is unavailable until sponsor terms are captured.',
      details: [],
    },
    passThroughRisk: {
      level: 'unknown',
      summary: 'Pass-through risk is unavailable until sponsor terms are captured.',
      details: [],
    },
    screenFailureProtectionGap: {
      level: 'unknown',
      summary: 'Screen failure protection gap is unavailable until sponsor terms are captured.',
      details: [],
    },
    recommendedCounterofferLanguage: [],
    projectedRevenueImpact: {
      benchmarkUsd: null,
      sponsorOfferUsd: null,
      projectedDeltaUsd: null,
      summary: 'Projected revenue impact is unavailable until sponsor line items are captured.',
    },
  },
  unavailable: [],
}

const TERM_HINT_PATTERNS = {
  paymentTerms: [
    'payment term',
    'net 30',
    'net 45',
    'net 60',
    'payment within',
  ],
  invoiceDue: [
    'invoice due',
    'due date',
    'days of receipt',
    'receipt of invoice',
    'invoice submission',
  ],
  passThrough: [
    'pass-through',
    'pass through',
    'reimbursable expense',
    'reimbursement',
    'actual cost',
  ],
  screenFailure: [
    'screen failure',
    'screen fail',
    'screening failure',
    'sf visit',
  ],
  invoiceableProcedure: [
    'invoiceable',
    'billable',
    'procedure payment',
    'per procedure',
    'unscheduled procedure',
  ],
} as const

function stableSerialize(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value)
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableSerialize(item)).join(',')}]`
  }
  const record = value as Record<string, unknown>
  const keys = Object.keys(record).sort()
  return `{${keys.map((key) => `${JSON.stringify(key)}:${stableSerialize(record[key])}`).join(',')}}`
}

function computeBudgetNegotiationStateHash(snapshot: Record<string, unknown>): string {
  return createHash('sha256').update(stableSerialize(snapshot)).digest('hex')
}

const BUDGET_NEGOTIATION_SEQUENCE: Array<{
  key: StudyBudgetNegotiationStateKey
  label: string
  nextStep: string
}> = [
  {
    key: 'missing_evidence',
    label: 'Evidence missing',
    nextStep: 'Open Document Intelligence and ingest Budget / CTA documents.',
  },
  {
    key: 'soa_reviewed',
    label: 'SOA reviewed',
    nextStep: 'Capture the sponsor offer or draft the site response.',
  },
  {
    key: 'sponsor_offer_received',
    label: 'Sponsor offer received',
    nextStep: 'Compare the sponsor terms against the protocol SOA.',
  },
  {
    key: 'counteroffer_drafted',
    label: 'Counteroffer drafted',
    nextStep: 'Review the draft and prepare it for sending.',
  },
  {
    key: 'counteroffer_sent',
    label: 'Counteroffer sent',
    nextStep: 'Wait for the sponsor reply and record the next response.',
  },
  {
    key: 'sponsor_reply_received',
    label: 'Sponsor reply received',
    nextStep: 'Resolve acceptance, adjustment, or rejection and record the outcome.',
  },
  {
    key: 'term_accepted',
    label: 'Term accepted',
    nextStep: 'Move the agreed terms into Financial Runtime expectation and invoice logic.',
  },
  {
    key: 'term_adjusted',
    label: 'Term adjusted',
    nextStep: 'Record the revised terms and continue the negotiation ledger.',
  },
  {
    key: 'term_rejected',
    label: 'Term rejected',
    nextStep: 'Escalate the unresolved term or revisit the evidence basis.',
  },
]

const FMV_REFERENCE_TOTALS = {
  pharma: 24393.93,
  biospecimen: 1424.25,
  ivd: 3782.7,
} as const

function buildBudgetNegotiationSequence(currentKey: StudyBudgetNegotiationStateKey) {
  const currentIndex = BUDGET_NEGOTIATION_SEQUENCE.findIndex((step) => step.key === currentKey)
  return BUDGET_NEGOTIATION_SEQUENCE.map((step, index) => ({
    key: step.key,
    label: step.label,
    status:
      currentIndex < 0
        ? ('pending' as const)
        : index < currentIndex
          ? ('complete' as const)
          : index === currentIndex
            ? ('current' as const)
            : ('pending' as const),
  }))
}

function countLineItemsByCategory(
  items: StudyBudgetNegotiationLineItem[],
  categories: string[],
) {
  const set = new Set(categories.map((value) => value.toLowerCase()))
  return items.filter((item) => set.has(item.category.toLowerCase())).length
}

function sumLineItemAmounts(items: StudyBudgetNegotiationLineItem[]) {
  return items.reduce((sum, item) => sum + (typeof item.amount === 'number' ? item.amount : 0), 0)
}

function chooseFmvBenchmark(protocolProcedureCount: number | null, sponsorOfferLineItems: StudyBudgetNegotiationLineItem[]) {
  const procedureCount = protocolProcedureCount ?? 0
  const procedureLineItemCount = countLineItemsByCategory(sponsorOfferLineItems, ['procedure'])
  const visitLineItemCount = countLineItemsByCategory(sponsorOfferLineItems, ['visit'])
  const hasCollectionSignals = countLineItemsByCategory(sponsorOfferLineItems, ['pass_through', 'screen_fail', 'invoice_term']) > 0

  if (procedureCount >= 10 || procedureLineItemCount >= 4) {
    return {
      family: 'pharma',
      benchmarkUsd:
        FMV_REFERENCE_TOTALS.pharma * 0.55 +
        FMV_REFERENCE_TOTALS.ivd * 0.25 +
        FMV_REFERENCE_TOTALS.biospecimen * 0.2,
    }
  }
  if (hasCollectionSignals || visitLineItemCount >= 2) {
    return {
      family: 'biospecimen',
      benchmarkUsd:
        FMV_REFERENCE_TOTALS.biospecimen * 0.55 +
        FMV_REFERENCE_TOTALS.ivd * 0.3 +
        FMV_REFERENCE_TOTALS.pharma * 0.15,
    }
  }
  if (procedureCount > 0 || procedureLineItemCount > 0) {
    return {
      family: 'ivd',
      benchmarkUsd:
        FMV_REFERENCE_TOTALS.ivd * 0.5 +
        FMV_REFERENCE_TOTALS.biospecimen * 0.25 +
        FMV_REFERENCE_TOTALS.pharma * 0.25,
    }
  }
  return {
    family: 'blended',
    benchmarkUsd:
      FMV_REFERENCE_TOTALS.pharma * 0.34 +
      FMV_REFERENCE_TOTALS.biospecimen * 0.33 +
      FMV_REFERENCE_TOTALS.ivd * 0.33,
  }
}

export function deriveBudgetNegotiationState(input: {
  hasBudgetEvidence: boolean
  negotiationLedger: StudyBudgetNegotiationLedgerEntry[]
}): StudyBudgetNegotiationState {
  if (!input.hasBudgetEvidence) {
    return {
      key: 'missing_evidence',
      label: 'Evidence missing',
      nextStep: 'Open Document Intelligence and ingest Budget / CTA documents.',
      sequence: buildBudgetNegotiationSequence('missing_evidence'),
    }
  }

  const latestEvent = input.negotiationLedger[0]
  const currentKey: StudyBudgetNegotiationStateKey =
    latestEvent?.eventType === 'counteroffer_drafted'
      ? 'counteroffer_drafted'
      : latestEvent?.eventType === 'counteroffer_sent'
        ? 'counteroffer_sent'
        : latestEvent?.eventType === 'sponsor_offer_received'
          ? 'sponsor_offer_received'
          : latestEvent?.eventType === 'sponsor_reply_received'
            ? 'sponsor_reply_received'
            : latestEvent?.eventType === 'term_accepted'
              ? 'term_accepted'
              : latestEvent?.eventType === 'term_adjusted'
                ? 'term_adjusted'
                : latestEvent?.eventType === 'term_rejected'
                  ? 'term_rejected'
                  : 'soa_reviewed'

  const currentStep = BUDGET_NEGOTIATION_SEQUENCE.find((step) => step.key === currentKey) ?? BUDGET_NEGOTIATION_SEQUENCE[0]
  return {
    key: currentStep.key,
    label: currentStep.label,
    nextStep: currentStep.nextStep,
    sequence: buildBudgetNegotiationSequence(currentStep.key),
  }
}

export function deriveBudgetNegotiationIntelligence(input: {
  summary: Pick<
    StudyBudgetEvidenceSummary,
    | 'negotiationLedger'
    | 'negotiationReadiness'
    | 'negotiationState'
    | 'negotiationFocusAreas'
    | 'paymentTermsHintCount'
    | 'invoiceDueHintCount'
    | 'passThroughHintCount'
    | 'screenFailureHintCount'
    | 'invoiceableProcedureHintCount'
    | 'soaComparison'
  >
}) : StudyBudgetNegotiationIntelligence {
  const latestSponsorOffer = [...input.summary.negotiationLedger].find(
    (event) => event.eventType === 'sponsor_offer_received',
  )
  const sponsorOfferLineItems = latestSponsorOffer?.lineItems ?? []
  const sponsorOfferUsd = sumLineItemAmounts(sponsorOfferLineItems)
  const procedureLineItemCount = countLineItemsByCategory(sponsorOfferLineItems, ['procedure'])
  const visitLineItemCount = countLineItemsByCategory(sponsorOfferLineItems, ['visit'])
  const passThroughLineItemCount = countLineItemsByCategory(sponsorOfferLineItems, ['pass_through'])
  const screenFailLineItemCount = countLineItemsByCategory(sponsorOfferLineItems, ['screen_fail'])
  const invoiceTermLineItemCount = countLineItemsByCategory(sponsorOfferLineItems, ['invoice_term'])

  const benchmark = chooseFmvBenchmark(input.summary.soaComparison.procedureCount, sponsorOfferLineItems)
  const benchmarkUsd = benchmark.benchmarkUsd
  const projectedDeltaUsd =
    benchmarkUsd !== null && sponsorOfferLineItems.length > 0
      ? Number((benchmarkUsd - sponsorOfferUsd).toFixed(2))
      : null

  const fmvGapLevel: StudyBudgetNegotiationSignalLevel =
    projectedDeltaUsd === null
      ? 'unknown'
      : Math.abs(projectedDeltaUsd) >= 10000
        ? 'high'
        : Math.abs(projectedDeltaUsd) >= 1000
          ? 'moderate'
          : 'low'

  const requiredProcedureCount = input.summary.soaComparison.requiredProcedureCount ?? 0
  const operationalBurdenGapCount = Math.max(0, requiredProcedureCount - procedureLineItemCount)
  const operationalBurdenGapLevel: StudyBudgetNegotiationSignalLevel =
    operationalBurdenGapCount >= 6
      ? 'high'
      : operationalBurdenGapCount >= 2
        ? 'moderate'
        : 'low'

  const paymentTermRiskLevel: StudyBudgetNegotiationSignalLevel = latestSponsorOffer
    ? input.summary.paymentTermsHintCount === 0 || input.summary.invoiceDueHintCount === 0
      ? 'high'
      : 'moderate'
    : 'unknown'

  const passThroughRiskLevel: StudyBudgetNegotiationSignalLevel = latestSponsorOffer
    ? input.summary.passThroughHintCount === 0 || passThroughLineItemCount === 0
      ? 'high'
      : 'low'
    : 'unknown'

  const screenFailureProtectionGapLevel: StudyBudgetNegotiationSignalLevel = latestSponsorOffer
    ? input.summary.screenFailureHintCount === 0 || screenFailLineItemCount === 0
      ? 'high'
      : 'low'
    : 'unknown'

  const recommendedCounterofferLanguage = [
    'Separate visit payment from procedure payment so the SOA burden stays visible.',
    'State payment terms and invoice due timing explicitly in the response.',
    'Preserve pass-through reimbursement at actual cost with supporting documentation.',
    'Keep screen-fail economics separate from billable procedure revenue.',
    `Use the ${benchmark.family} FMV reference family as the negotiation anchor while keeping the protocol SOA as the execution baseline.`,
  ]

  const paymentTermSummary =
    paymentTermRiskLevel === 'high'
      ? 'Payment term risk is high because sponsor terms are not fully explicit against the indexed evidence.'
      : paymentTermRiskLevel === 'moderate'
        ? 'Payment term risk is present, but the sponsor terms and indexed evidence provide partial support.'
        : 'Payment term risk is low relative to the indexed evidence.'

  const passThroughSummary =
    passThroughRiskLevel === 'high'
      ? 'Pass-through risk is high because reimbursable costs are not clearly separated in the sponsor offer.'
      : 'Pass-through risk is low because sponsor terms preserve reimbursable cost handling.'

  const screenFailureSummary =
    screenFailureProtectionGapLevel === 'high'
      ? 'Screen failure protection gap is high because the $0 visit logic is not clearly protected in the sponsor offer.'
      : 'Screen failure protection gap is low because screen-fail terms remain separated from procedure revenue.'

  const operationSummary =
    operationalBurdenGapLevel === 'high'
      ? `Operational burden gap is high: ${operationalBurdenGapCount} required procedure mapping(s) are not clearly represented in the sponsor line items.`
      : operationalBurdenGapLevel === 'moderate'
        ? `Operational burden gap is moderate: ${operationalBurdenGapCount} required procedure mapping(s) remain to be explicitly reflected.`
        : 'Operational burden gap is low because most required procedure mappings are represented in the sponsor line items.'

  const fmvSummary =
    projectedDeltaUsd === null
      ? 'FMV gap is unavailable until a sponsor offer with structured line items is captured.'
      : `FMV gap relative to the ${benchmark.family} reference family is ${projectedDeltaUsd >= 0 ? '+' : ''}$${Math.abs(projectedDeltaUsd).toFixed(2)}.`

  const projectedRevenueImpactSummary =
    projectedDeltaUsd === null
      ? 'Projected revenue impact is unavailable until sponsor line items are captured.'
      : projectedDeltaUsd >= 0
        ? `Projected negotiation upside is approximately $${projectedDeltaUsd.toFixed(2)} against the current sponsor offer.`
        : `Projected concession pressure is approximately $${Math.abs(projectedDeltaUsd).toFixed(2)} below the current sponsor offer.`

  return {
    fmvGap: {
      level: fmvGapLevel,
      summary: fmvSummary,
      details: [
        `Benchmark family: ${benchmark.family}`,
        `Sponsor offer total: ${sponsorOfferLineItems.length > 0 ? `$${sponsorOfferUsd.toFixed(2)}` : 'n/a'}`,
        `Reference families: Pharma ${FMV_REFERENCE_TOTALS.pharma.toFixed(2)}, Biospecimen ${FMV_REFERENCE_TOTALS.biospecimen.toFixed(2)}, IVD ${FMV_REFERENCE_TOTALS.ivd.toFixed(2)}`,
      ],
      benchmarkFamily: benchmark.family,
      benchmarkUsd,
      sponsorOfferUsd: sponsorOfferLineItems.length > 0 ? sponsorOfferUsd : null,
      gapUsd: projectedDeltaUsd,
    },
    operationalBurdenGap: {
      level: operationalBurdenGapLevel,
      summary: operationSummary,
      details: [
        `Required procedure mappings: ${requiredProcedureCount}`,
        `Structured procedure line items: ${procedureLineItemCount}`,
        `Structured visit line items: ${visitLineItemCount}`,
      ],
      missingRequiredProcedureLineItems: operationalBurdenGapCount,
      procedureLineItemCount,
    },
    paymentTermRisk: {
      level: paymentTermRiskLevel,
      summary: paymentTermSummary,
      details: [
        `Payment terms hints: ${input.summary.paymentTermsHintCount ?? 'n/a'}`,
        `Invoice due hints: ${input.summary.invoiceDueHintCount ?? 'n/a'}`,
        `Invoice term line items: ${invoiceTermLineItemCount}`,
      ],
    },
    passThroughRisk: {
      level: passThroughRiskLevel,
      summary: passThroughSummary,
      details: [
        `Pass-through hints: ${input.summary.passThroughHintCount ?? 'n/a'}`,
        `Pass-through line items: ${passThroughLineItemCount}`,
      ],
    },
    screenFailureProtectionGap: {
      level: screenFailureProtectionGapLevel,
      summary: screenFailureSummary,
      details: [
        `Screen failure hints: ${input.summary.screenFailureHintCount ?? 'n/a'}`,
        `Screen fail line items: ${screenFailLineItemCount}`,
      ],
    },
    recommendedCounterofferLanguage,
    projectedRevenueImpact: {
      benchmarkUsd,
      sponsorOfferUsd: sponsorOfferLineItems.length > 0 ? sponsorOfferUsd : null,
      projectedDeltaUsd,
      summary: projectedRevenueImpactSummary,
    },
  }
}

function buildNegotiationLinkedObjects(row: {
  study_id: string
  study_subject_id: string | null
  visit_id: string | null
  procedure_id: string | null
  source_document_id: string | null
  source_chunk_id: string | null
  protocol_version_id: string | null
}) {
  return [
    { kind: 'study' as const, id: row.study_id },
    row.study_subject_id ? { kind: 'subject' as const, id: row.study_subject_id } : null,
    row.visit_id ? { kind: 'visit' as const, id: row.visit_id } : null,
    row.procedure_id ? { kind: 'procedure' as const, id: row.procedure_id } : null,
    row.source_document_id ? { kind: 'source_document' as const, id: row.source_document_id } : null,
    row.source_chunk_id ? { kind: 'source_chunk' as const, id: row.source_chunk_id } : null,
    row.protocol_version_id ? { kind: 'protocol_version' as const, id: row.protocol_version_id } : null,
  ].filter((item): item is { kind: 'study' | 'subject' | 'visit' | 'procedure' | 'source_document' | 'source_chunk' | 'protocol_version'; id: string } => item !== null)
}

function parseNegotiationLineItems(eventPayload: Record<string, unknown> | null | undefined) {
  const rawLineItems = eventPayload?.line_items
  if (!Array.isArray(rawLineItems)) return []
  return rawLineItems
    .map((item): StudyBudgetNegotiationLineItem | null => {
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
        currency: typeof record.currency === 'string' ? record.currency.trim().toUpperCase() || null : null,
        note: typeof record.note === 'string' ? record.note.trim() || null : null,
      }
    })
    .filter((item): item is StudyBudgetNegotiationLineItem => item !== null)
}

type StudyBudgetNegotiationLedgerRow = {
  id: string
  study_id: string
  study_subject_id: string | null
  visit_id: string | null
  procedure_id: string | null
  source_document_id: string | null
  source_chunk_id: string | null
  protocol_version_id: string | null
  event_type: string
  title: string
  summary: string
  reason: string | null
  recommended_next_step: string | null
  owner_role: string
  negotiation_round: number | string | null
  actor_user_id: string | null
  created_at: string
  event_payload: Record<string, unknown> | null
}

export async function loadRecentBudgetNegotiationLedger(input: {
  supabase: SupabaseClient
  organizationId: string
  studyId: string
  unavailable: string[]
  limit?: number
}): Promise<StudyBudgetNegotiationLedgerEntry[]> {
  try {
    const { data, error } = await input.supabase
      .from('study_budget_negotiation_events')
      .select(
        [
          'id',
          'study_id',
          'study_subject_id',
          'visit_id',
          'procedure_id',
          'source_document_id',
          'source_chunk_id',
          'protocol_version_id',
          'event_type',
          'title',
          'summary',
          'reason',
          'recommended_next_step',
          'owner_role',
          'negotiation_round',
          'actor_user_id',
          'created_at',
          'event_payload',
        ].join(', '),
      )
      .eq('organization_id', input.organizationId)
      .eq('study_id', input.studyId)
      .order('created_at', { ascending: false })
      .limit(input.limit ?? 5)

    if (error) {
      input.unavailable.push(`Budget negotiation ledger: ${error.message}`)
      return []
    }

    return ((data ?? []) as unknown as StudyBudgetNegotiationLedgerRow[]).map((row) => ({
      id: String(row.id),
      eventType: String(row.event_type) as StudyBudgetNegotiationEventType,
      title: String(row.title),
      summary: String(row.summary),
      reason: row.reason ? String(row.reason) : null,
      recommendedNextStep: row.recommended_next_step ? String(row.recommended_next_step) : null,
      ownerRole: String(row.owner_role),
      negotiationRound: Number(row.negotiation_round ?? 1),
      protocolVersionId: row.protocol_version_id ? String(row.protocol_version_id) : null,
      studySubjectId: row.study_subject_id ? String(row.study_subject_id) : null,
      visitId: row.visit_id ? String(row.visit_id) : null,
      procedureId: row.procedure_id ? String(row.procedure_id) : null,
      sourceDocumentId: row.source_document_id ? String(row.source_document_id) : null,
      sourceChunkId: row.source_chunk_id ? String(row.source_chunk_id) : null,
      actorUserId: row.actor_user_id ? String(row.actor_user_id) : null,
      createdAt: String(row.created_at),
      linkedObjects: buildNegotiationLinkedObjects({
        study_id: String(row.study_id),
        study_subject_id: row.study_subject_id ? String(row.study_subject_id) : null,
        visit_id: row.visit_id ? String(row.visit_id) : null,
        procedure_id: row.procedure_id ? String(row.procedure_id) : null,
        source_document_id: row.source_document_id ? String(row.source_document_id) : null,
        source_chunk_id: row.source_chunk_id ? String(row.source_chunk_id) : null,
        protocol_version_id: row.protocol_version_id ? String(row.protocol_version_id) : null,
      }),
      lineItems: parseNegotiationLineItems(row.event_payload),
      eventPayload: row.event_payload ?? {},
    }))
  } catch (err) {
    input.unavailable.push(
      `Budget negotiation ledger: ${err instanceof Error ? err.message : 'unavailable'}`,
    )
    return []
  }
}

export async function appendStudyBudgetNegotiationEvent(input: {
  supabase: SupabaseClient
  organizationId: string
  studyId: string
  eventType: StudyBudgetNegotiationEventType
  title: string
  summary: string
  reason?: string | null
  recommendedNextStep?: string | null
  ownerRole?: string
  negotiationRound?: number
  protocolVersionId?: string | null
  studySubjectId?: string | null
  visitId?: string | null
  procedureId?: string | null
  sourceDocumentId?: string | null
  sourceChunkId?: string | null
  actorUserId?: string | null
  eventPayload?: Record<string, unknown>
}) {
  const createdAt = new Date().toISOString()
  const payload = input.eventPayload ?? {}
  const stateHash = computeBudgetNegotiationStateHash({
    organization_id: input.organizationId,
    study_id: input.studyId,
    event_type: input.eventType,
    title: input.title,
    summary: input.summary,
    reason: input.reason ?? null,
    recommended_next_step: input.recommendedNextStep ?? null,
    owner_role: input.ownerRole ?? 'coordinator',
    negotiation_round: input.negotiationRound ?? 1,
    protocol_version_id: input.protocolVersionId ?? null,
    study_subject_id: input.studySubjectId ?? null,
    visit_id: input.visitId ?? null,
    procedure_id: input.procedureId ?? null,
    source_document_id: input.sourceDocumentId ?? null,
    source_chunk_id: input.sourceChunkId ?? null,
    actor_user_id: input.actorUserId ?? null,
    created_at: createdAt,
    event_payload: payload,
  })

  const { data, error } = await input.supabase
    .from('study_budget_negotiation_events')
    .insert({
      organization_id: input.organizationId,
      study_id: input.studyId,
      event_type: input.eventType,
      title: input.title,
      summary: input.summary,
      reason: input.reason ?? null,
      recommended_next_step: input.recommendedNextStep ?? null,
      owner_role: input.ownerRole ?? 'coordinator',
      negotiation_round: input.negotiationRound ?? 1,
      protocol_version_id: input.protocolVersionId ?? null,
      study_subject_id: input.studySubjectId ?? null,
      visit_id: input.visitId ?? null,
      procedure_id: input.procedureId ?? null,
      source_document_id: input.sourceDocumentId ?? null,
      source_chunk_id: input.sourceChunkId ?? null,
      actor_user_id: input.actorUserId ?? null,
      event_payload: payload,
      state_hash: stateHash,
      created_at: createdAt,
    })
    .select(
      [
        'id',
        'study_id',
        'study_subject_id',
        'visit_id',
        'procedure_id',
        'source_document_id',
        'source_chunk_id',
        'protocol_version_id',
        'event_type',
        'title',
        'summary',
        'reason',
        'recommended_next_step',
        'owner_role',
        'negotiation_round',
        'actor_user_id',
        'created_at',
        'event_payload',
      ].join(', '),
    )
    .single()

  if (error || !data) {
    throw new Error(`Failed to append budget negotiation event: ${error?.message ?? 'Unknown error'}`)
  }

  const row = data as unknown as StudyBudgetNegotiationLedgerRow

  return {
    id: String(row.id),
    eventType: String(row.event_type) as StudyBudgetNegotiationEventType,
    title: String(row.title),
    summary: String(row.summary),
    reason: row.reason ? String(row.reason) : null,
    recommendedNextStep: row.recommended_next_step ? String(row.recommended_next_step) : null,
    ownerRole: String(row.owner_role),
    negotiationRound: Number(row.negotiation_round ?? 1),
    protocolVersionId: row.protocol_version_id ? String(row.protocol_version_id) : null,
    studySubjectId: row.study_subject_id ? String(row.study_subject_id) : null,
    visitId: row.visit_id ? String(row.visit_id) : null,
    procedureId: row.procedure_id ? String(row.procedure_id) : null,
    sourceDocumentId: row.source_document_id ? String(row.source_document_id) : null,
    sourceChunkId: row.source_chunk_id ? String(row.source_chunk_id) : null,
    actorUserId: row.actor_user_id ? String(row.actor_user_id) : null,
    createdAt: String(row.created_at),
    linkedObjects: buildNegotiationLinkedObjects({
      study_id: input.studyId,
      study_subject_id: row.study_subject_id ? String(row.study_subject_id) : null,
      visit_id: row.visit_id ? String(row.visit_id) : null,
      procedure_id: row.procedure_id ? String(row.procedure_id) : null,
      source_document_id: row.source_document_id ? String(row.source_document_id) : null,
      source_chunk_id: row.source_chunk_id ? String(row.source_chunk_id) : null,
      protocol_version_id: row.protocol_version_id ? String(row.protocol_version_id) : null,
    }),
    lineItems: parseNegotiationLineItems(payload),
    eventPayload: payload,
    stateHash,
  }
}

async function safeExactCount(
  label: string,
  unavailable: string[],
  run: () => Promise<{ count: number | null; error: { message: string } | null }>,
): Promise<number | null> {
  try {
    const { count, error } = await run()
    if (error) {
      unavailable.push(`${label}: ${error.message}`)
      return null
    }
    return count ?? 0
  } catch (err) {
    unavailable.push(`${label}: ${err instanceof Error ? err.message : 'unavailable'}`)
    return null
  }
}

async function loadDomainDocumentIds(input: {
  supabase: SupabaseClient
  organizationId: string
  studyId: string
  domain: BudgetEvidenceDomain
  unavailable: string[]
}): Promise<string[]> {
  try {
    const { data, error } = await input.supabase
      .from('document_intelligence_domains')
      .select('intelligence_document_id')
      .eq('organization_id', input.organizationId)
      .eq('study_id', input.studyId)
      .eq('domain', input.domain)
      .eq('status', 'active')
      .limit(200)

    if (error) {
      input.unavailable.push(`${input.domain} documents: ${error.message}`)
      return []
    }

    return [...new Set((data ?? []).map((row) => String(row.intelligence_document_id)))]
  } catch (err) {
    input.unavailable.push(
      `${input.domain} documents: ${err instanceof Error ? err.message : 'unavailable'}`,
    )
    return []
  }
}

async function countChunksForDocuments(input: {
  supabase: SupabaseClient
  organizationId: string
  studyId: string
  documentIds: string[]
  label: string
  unavailable: string[]
}): Promise<number | null> {
  if (input.documentIds.length === 0) return 0

  return safeExactCount(input.label, input.unavailable, async () =>
    input.supabase
      .from('document_intelligence_chunks')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', input.organizationId)
      .eq('study_id', input.studyId)
      .in('intelligence_document_id', input.documentIds),
  )
}

function buildChunkTextOr(patterns: readonly string[]) {
  return patterns
    .map((pattern) => `clean_chunk_text.ilike.%${pattern.replaceAll(',', ' ')}%`)
    .join(',')
}

async function countTermHints(input: {
  supabase: SupabaseClient
  organizationId: string
  studyId: string
  documentIds: string[]
  label: string
  patterns: readonly string[]
  unavailable: string[]
}): Promise<number | null> {
  if (input.documentIds.length === 0) return 0

  return safeExactCount(input.label, input.unavailable, async () =>
    input.supabase
      .from('document_intelligence_chunks')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', input.organizationId)
      .eq('study_id', input.studyId)
      .in('intelligence_document_id', input.documentIds)
      .or(buildChunkTextOr(input.patterns)),
  )
}

export async function loadStudyBudgetEvidenceSummary(
  studyId: string,
  organizationId: string,
  protocolSetup?: ProtocolSetupModel | null,
  supabaseClient?: SupabaseClient,
): Promise<StudyBudgetEvidenceSummary> {
  const supabase = supabaseClient ?? (await createServerClient())
  const unavailable: string[] = []

  const [budgetDocumentCount, contractDocumentCount] = await Promise.all([
    safeExactCount('Budget evidence documents', unavailable, async () =>
      supabase
        .from('document_intelligence_domains')
        .select('id', { count: 'exact', head: true })
        .eq('organization_id', organizationId)
        .eq('study_id', studyId)
        .eq('domain', 'budget_analysis')
        .eq('status', 'active'),
    ),
    safeExactCount('Contract evidence documents', unavailable, async () =>
      supabase
        .from('document_intelligence_domains')
        .select('id', { count: 'exact', head: true })
        .eq('organization_id', organizationId)
        .eq('study_id', studyId)
        .eq('domain', 'contract_analysis')
        .eq('status', 'active'),
    ),
  ])

  const [budgetDocumentIds, contractDocumentIds] = await Promise.all([
    loadDomainDocumentIds({
      supabase,
      organizationId,
      studyId,
      domain: 'budget_analysis',
      unavailable,
    }),
    loadDomainDocumentIds({
      supabase,
      organizationId,
      studyId,
      domain: 'contract_analysis',
      unavailable,
    }),
  ])

  const [
    budgetChunkCount,
    contractChunkCount,
    activeBudgetReferenceCount,
    activeContractReferenceCount,
    paymentTermsHintCount,
    invoiceDueHintCount,
    passThroughHintCount,
    screenFailureHintCount,
    invoiceableProcedureHintCount,
  ] = await Promise.all([
    countChunksForDocuments({
      supabase,
      organizationId,
      studyId,
      documentIds: budgetDocumentIds,
      label: 'Budget evidence chunks',
      unavailable,
    }),
    countChunksForDocuments({
      supabase,
      organizationId,
      studyId,
      documentIds: contractDocumentIds,
      label: 'Contract evidence chunks',
      unavailable,
    }),
    safeExactCount('Active budget references', unavailable, async () =>
      supabase
        .from('document_intelligence_active_references')
        .select('id', { count: 'exact', head: true })
        .eq('organization_id', organizationId)
        .eq('study_id', studyId)
        .eq('active_reference_domain', 'budget_analysis')
        .eq('is_active_reference', true),
    ),
    safeExactCount('Active contract references', unavailable, async () =>
      supabase
        .from('document_intelligence_active_references')
        .select('id', { count: 'exact', head: true })
        .eq('organization_id', organizationId)
        .eq('study_id', studyId)
        .eq('active_reference_domain', 'contract_analysis')
        .eq('is_active_reference', true),
    ),
    countTermHints({
      supabase,
      organizationId,
      studyId,
      documentIds: [...new Set([...budgetDocumentIds, ...contractDocumentIds])],
      label: 'Payment terms hints',
      patterns: TERM_HINT_PATTERNS.paymentTerms,
      unavailable,
    }),
    countTermHints({
      supabase,
      organizationId,
      studyId,
      documentIds: [...new Set([...budgetDocumentIds, ...contractDocumentIds])],
      label: 'Invoice due hints',
      patterns: TERM_HINT_PATTERNS.invoiceDue,
      unavailable,
    }),
    countTermHints({
      supabase,
      organizationId,
      studyId,
      documentIds: [...new Set([...budgetDocumentIds, ...contractDocumentIds])],
      label: 'Pass-through hints',
      patterns: TERM_HINT_PATTERNS.passThrough,
      unavailable,
    }),
    countTermHints({
      supabase,
      organizationId,
      studyId,
      documentIds: [...new Set([...budgetDocumentIds, ...contractDocumentIds])],
      label: 'Screen failure payment hints',
      patterns: TERM_HINT_PATTERNS.screenFailure,
      unavailable,
    }),
    countTermHints({
      supabase,
      organizationId,
      studyId,
      documentIds: [...new Set([...budgetDocumentIds, ...contractDocumentIds])],
      label: 'Invoiceable procedure hints',
      patterns: TERM_HINT_PATTERNS.invoiceableProcedure,
      unavailable,
    }),
  ])

  const hasBudgetEvidence = (budgetDocumentCount ?? 0) > 0 || (contractDocumentCount ?? 0) > 0
  const hasActiveReference =
    (activeBudgetReferenceCount ?? 0) > 0 || (activeContractReferenceCount ?? 0) > 0
  const hasTermHints =
    (paymentTermsHintCount ?? 0) > 0 ||
    (invoiceDueHintCount ?? 0) > 0 ||
    (passThroughHintCount ?? 0) > 0 ||
    (screenFailureHintCount ?? 0) > 0 ||
    (invoiceableProcedureHintCount ?? 0) > 0

  let negotiationReadiness: StudyBudgetEvidenceSummary['negotiationReadiness'] = 'ready'
  let negotiationReason = 'Budget and CTA evidence is indexed and ready for negotiation review.'
  let negotiationNextStep = 'Review candidate source chunks before negotiating terms.'

  if (!hasBudgetEvidence) {
    negotiationReadiness = 'blocked'
    negotiationReason = 'Budget / CTA evidence is missing.'
    negotiationNextStep = 'Open Document Intelligence and ingest Budget / CTA documents.'
  } else if (!hasActiveReference) {
    negotiationReadiness = 'review_needed'
    negotiationReason = 'Evidence exists, but there is no active reference set.'
    negotiationNextStep = 'Activate the relevant budget and CTA references before negotiation.'
  } else if (!hasTermHints) {
    negotiationReadiness = 'review_needed'
    negotiationReason = 'Evidence is indexed, but term hints are still sparse.'
    negotiationNextStep = 'Review indexed chunks for payment, invoice, screen failure, and pass-through terms.'
  }

  const negotiationFocusAreas = [
    {
      label: 'Payment terms',
      count: paymentTermsHintCount,
      nextStep: 'Confirm invoice timing and payment cadence.',
    },
    {
      label: 'Invoice due',
      count: invoiceDueHintCount,
      nextStep: 'Verify due date language and invoice submission rules.',
    },
    {
      label: 'Pass-through',
      count: passThroughHintCount,
      nextStep: 'Check reimbursable cost language and actual-cost policy.',
    },
    {
      label: 'Screen failure',
      count: screenFailureHintCount,
      nextStep: 'Confirm screen-fail payment handling and zero-visit policy.',
    },
    {
      label: 'Invoiceable procedures',
      count: invoiceableProcedureHintCount,
      nextStep: 'Review procedure-level billable language for the budget.',
    },
  ]

  const protocolVisitCount = protocolSetup?.visits.length ?? null
  const protocolProcedureCount = protocolSetup?.procedureMaps.length ?? null
  const conditionalProcedureCount =
    protocolSetup?.procedureMaps.filter((row) => row.isConditional).length ?? null
  const requiredProcedureCount =
    protocolSetup?.procedureMaps.filter((row) => !row.isConditional).length ?? null

  const counterofferDraft: StudyBudgetCounterofferDraft = {
    title: 'Draft counteroffer response',
    summary:
      protocolSetup && protocolProcedureCount !== null
        ? `SOA review covers ${protocolVisitCount ?? 0} visits and ${protocolProcedureCount} procedure mappings (${conditionalProcedureCount ?? 0} conditional). Build the sponsor response around the required runtime work, not a flat visit fee.`
        : 'Use protocol SOA, budget evidence, and financial runtime to frame a documented sponsor response.',
    items: [
      {
        label: 'Separate visit and procedure payment',
        ask: 'Keep visit payment independent from procedure payment.',
        rationale:
          protocolProcedureCount !== null
            ? `The SOA includes ${protocolProcedureCount} mapped procedure rows; bundling them into a flat visit fee hides real execution burden.`
            : 'Protocol execution work should stay visible as distinct billable components.',
      },
      {
        label: 'Protect screen-fail economics',
        ask: 'Accept a $0 screen-fail visit payment only if billable procedures remain invoiceable.',
        rationale:
          'Screen failure should not erase lab, imaging, or procedure revenue that still occurs under the protocol.',
      },
      {
        label: 'State payment terms explicitly',
        ask: 'Require net terms and invoice due timing in the sponsor response.',
        rationale:
          (paymentTermsHintCount ?? 0) > 0 || (invoiceDueHintCount ?? 0) > 0
            ? 'Indexed evidence already suggests payment and invoice timing language is present; the response should make it explicit.'
            : 'Negotiation needs explicit payment cadence before acceptance.',
      },
      {
        label: 'Preserve pass-through reimbursement',
        ask: 'Reimburse actual-cost pass-through items with supporting documentation.',
        rationale:
          (passThroughHintCount ?? 0) > 0
            ? 'Indexed evidence already references pass-through terms and reimbursement language.'
            : 'Actual-cost reimbursements should remain separate from fee-for-service items.',
      },
      {
        label: 'Keep invoiceable procedures separate',
        ask: 'List all invoiceable procedures as explicit budget line items.',
        rationale:
          requiredProcedureCount !== null
            ? `The SOA includes ${requiredProcedureCount} non-conditional procedure mappings that should stay visible in the budget response.`
            : 'Protocol-required procedures should remain visible as named invoiceable items.',
      },
    ],
  }

  const soaComparison: StudyBudgetSoaComparison = {
    visitCount: protocolVisitCount,
    procedureCount: protocolProcedureCount,
    conditionalProcedureCount,
    requiredProcedureCount,
    summary:
      protocolSetup && protocolProcedureCount !== null
        ? `SOA loaded with ${protocolVisitCount ?? 0} visits and ${protocolProcedureCount} procedure mappings (${conditionalProcedureCount ?? 0} conditional / ${requiredProcedureCount ?? 0} required).`
        : 'Protocol SOA is available only as a partial comparison.',
  }

  const negotiationLedger = await loadRecentBudgetNegotiationLedger({
    supabase,
    organizationId,
    studyId,
    unavailable,
    limit: 5,
  })
  const negotiationState = deriveBudgetNegotiationState({
    hasBudgetEvidence,
    negotiationLedger,
  })
  const budgetIntelligence = deriveBudgetNegotiationIntelligence({
    summary: {
      negotiationLedger,
      negotiationReadiness,
      negotiationState,
      negotiationFocusAreas,
      paymentTermsHintCount,
      invoiceDueHintCount,
      passThroughHintCount,
      screenFailureHintCount,
      invoiceableProcedureHintCount,
      soaComparison,
    },
  })

  return {
    ...EMPTY_SUMMARY,
    budgetDocumentCount,
    contractDocumentCount,
    budgetChunkCount,
    contractChunkCount,
    activeBudgetReferenceCount,
    activeContractReferenceCount,
    paymentTermsHintCount,
    invoiceDueHintCount,
    passThroughHintCount,
    screenFailureHintCount,
    invoiceableProcedureHintCount,
    negotiationFocusAreas,
    soaComparison,
    counterofferDraft,
    negotiationLedger,
    negotiationReadiness,
    negotiationReason,
    negotiationNextStep,
    negotiationState,
    budgetIntelligence,
    unavailable,
  }
}

export function buildBudgetNegotiationExportMarkdown(input: {
  studyName: string
  studyId: string
  organizationId: string
  generatedAt: string
  summary: StudyBudgetEvidenceSummary
  protocolSetup?: ProtocolSetupModel | null
}) {
  const lines: string[] = []
  const add = (line = '') => lines.push(line)
  const addSection = (title: string) => {
    add('')
    add(`## ${title}`)
  }

  add(`# Budget Negotiation Counteroffer Export`)
  add('')
  add(`- Study: ${input.studyName}`)
  add(`- Study ID: ${input.studyId}`)
  add(`- Organization ID: ${input.organizationId}`)
  add(`- Generated at: ${input.generatedAt}`)
  add(`- Readiness: ${input.summary.negotiationReadiness.replace('_', ' ')}`)
  add(`- Current state: ${input.summary.negotiationState.label}`)
  add(`- Next step: ${input.summary.negotiationState.nextStep}`)

  addSection('Operational sequence')
  for (const step of input.summary.negotiationState.sequence) {
    add(`- [${step.status}] ${step.label}`)
  }

  addSection('SOA comparison')
  add(`- Summary: ${input.summary.soaComparison.summary}`)
  add(`- Visits: ${input.summary.soaComparison.visitCount ?? '—'}`)
  add(`- Procedures: ${input.summary.soaComparison.procedureCount ?? '—'}`)
  add(
    `- Conditional procedures: ${input.summary.soaComparison.conditionalProcedureCount ?? '—'}`,
  )
  add(`- Required procedures: ${input.summary.soaComparison.requiredProcedureCount ?? '—'}`)

  if (input.summary.negotiationFocusAreas.length > 0) {
    addSection('Negotiation focus areas')
    for (const area of input.summary.negotiationFocusAreas) {
      add(`- ${area.label}: ${area.count ?? '—'} · Next: ${area.nextStep}`)
    }
  }

  addSection('Counteroffer draft')
  add(`- Title: ${input.summary.counterofferDraft.title}`)
  add(`- Summary: ${input.summary.counterofferDraft.summary}`)
  for (const item of input.summary.counterofferDraft.items) {
    add(`- ${item.label}`)
    add(`  - Ask: ${item.ask}`)
      add(`  - Rationale: ${item.rationale}`)
  }

  addSection('Budget negotiation intelligence v1')
  add(`- FMV gap: ${input.summary.budgetIntelligence.fmvGap.summary}`)
  for (const detail of input.summary.budgetIntelligence.fmvGap.details) {
    add(`  - ${detail}`)
  }
  add(`- Operational burden gap: ${input.summary.budgetIntelligence.operationalBurdenGap.summary}`)
  for (const detail of input.summary.budgetIntelligence.operationalBurdenGap.details) {
    add(`  - ${detail}`)
  }
  add(`- Payment term risk: ${input.summary.budgetIntelligence.paymentTermRisk.summary}`)
  add(`- Pass-through risk: ${input.summary.budgetIntelligence.passThroughRisk.summary}`)
  add(`- Screen failure protection gap: ${input.summary.budgetIntelligence.screenFailureProtectionGap.summary}`)
  add(`- Projected revenue impact: ${input.summary.budgetIntelligence.projectedRevenueImpact.summary}`)
  add('- Recommended counteroffer language:')
  for (const line of input.summary.budgetIntelligence.recommendedCounterofferLanguage) {
    add(`  - ${line}`)
  }

  const sponsorOffer = input.summary.negotiationLedger.find(
    (event) => event.eventType === 'sponsor_offer_received',
  )
  if (sponsorOffer) {
    addSection('Latest sponsor offer snapshot')
    add(`- Event: ${sponsorOffer.title}`)
    add(`- Summary: ${sponsorOffer.summary}`)
    add(`- Owner role: ${sponsorOffer.ownerRole}`)
    add(`- Round: ${sponsorOffer.negotiationRound}`)
    const sponsorLineItems = sponsorOffer.lineItems ?? []
    if (sponsorLineItems.length > 0) {
      add(`- Structured line items: ${sponsorLineItems.length}`)
      add('')
      add('| Label | Category | Amount | Currency | Note | Response guidance |')
      add('| --- | --- | --- | --- | --- | --- |')
      for (const lineItem of sponsorLineItems) {
        add(
          `| ${escapeMarkdownCell(lineItem.label)} | ${escapeMarkdownCell(lineItem.category)} | ${escapeMarkdownCell(formatNegotiationValue(lineItem.amount))} | ${escapeMarkdownCell(lineItem.currency ?? '—')} | ${escapeMarkdownCell(lineItem.note ?? '—')} | ${escapeMarkdownCell(describeLineItemGuidance(lineItem, input.summary.soaComparison))} |`,
        )
      }
    }
    const sponsorOfferPayload = sponsorOffer.eventPayload as Record<string, unknown>
    if (Object.keys(sponsorOfferPayload).length > 0) {
      for (const [key, value] of Object.entries(sponsorOfferPayload)) {
        add(`- ${key}: ${formatNegotiationValue(value)}`)
      }
    }
  }

  if (input.summary.negotiationLedger.length > 0) {
    addSection('Negotiation ledger')
    for (const event of input.summary.negotiationLedger) {
      add(`- ${event.eventType} · round ${event.negotiationRound} · ${event.title}`)
      add(`  - Summary: ${event.summary}`)
      const eventLineItems = event.lineItems ?? []
      if (eventLineItems.length > 0) {
        add(`  - Line items: ${eventLineItems.length}`)
      }
      if (event.recommendedNextStep) add(`  - Next step: ${event.recommendedNextStep}`)
    }
  }

  addSection('Runtime guardrail')
  add(
    '- Financial Runtime remains the source of truth for expected, executed, earned, invoiced, and paid revenue; this document only records negotiation history and the current sponsor response draft.',
  )

  if (input.protocolSetup) {
    addSection('Protocol context')
    add(
      `- Visits loaded: ${input.protocolSetup.visits.length} · procedure mappings: ${input.protocolSetup.procedureMaps.length}`,
    )
    const conditionalCount = input.protocolSetup.procedureMaps.filter((row) => row.isConditional).length
    add(`- Conditional procedure mappings: ${conditionalCount}`)
  }

  return `${lines.join('\n').trim()}\n`
}

function formatNegotiationValue(value: unknown): string {
  if (value === null || value === undefined) return '—'
  if (Array.isArray(value)) {
    return value.map((item) => formatNegotiationValue(item)).join('; ')
  }
  if (typeof value === 'object') {
    return JSON.stringify(value)
  }
  return String(value)
}

function escapeMarkdownCell(value: string): string {
  return value.replaceAll('|', '\\|').replaceAll('\n', ' ').trim() || '—'
}

function describeLineItemGuidance(
  lineItem: StudyBudgetNegotiationLineItem,
  soa: StudyBudgetSoaComparison,
) {
  if (lineItem.category === 'visit') {
    return soa.visitCount !== null
      ? `Compare against ${soa.visitCount} SOA visit(s); keep visit fee separate from procedures.`
      : 'Compare against the protocol SOA; keep visit fee separate from procedures.'
  }
  if (lineItem.category === 'procedure') {
    return soa.procedureCount !== null
      ? `Compare against ${soa.procedureCount} SOA procedure mapping(s).`
      : 'Compare against mapped protocol procedures.'
  }
  if (lineItem.category === 'pass_through') {
    return 'Treat as reimbursable actual-cost pass-through and preserve documentation.'
  }
  if (lineItem.category === 'screen_fail') {
    return 'Keep screen-fail economics separate from billable procedures.'
  }
  if (lineItem.category === 'invoice_term') {
    return 'Validate against payment terms and invoice due language.'
  }
  return 'Review against protocol evidence and indexed Budget / CTA terms.'
}
