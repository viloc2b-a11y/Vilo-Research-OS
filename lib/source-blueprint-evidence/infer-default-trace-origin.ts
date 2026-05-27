import type { DocumentIntelligenceDomain } from '@/lib/document-intelligence/document-domain-mapper'
import type { EvidenceKind } from './source-blueprint-evidence-types'
import { EVIDENCE_KIND } from './source-blueprint-evidence-types'
import { TRACE_ORIGIN, type TraceOrigin } from './source-lineage-types'

/**
 * Suggests a trace origin for coordinator lineage mapping (not authoritative).
 */
export function inferDefaultTraceOrigin(
  usageDomain: DocumentIntelligenceDomain,
  evidenceKind: EvidenceKind,
): TraceOrigin {
  if (evidenceKind === EVIDENCE_KIND.BILLING_HINT) {
    return TRACE_ORIGIN.MANUAL_RECONCILIATION_DECISION
  }
  if (
    evidenceKind === EVIDENCE_KIND.SOURCE_DRAFTING ||
    usageDomain === 'source_creation'
  ) {
    return TRACE_ORIGIN.CRF_GUIDANCE
  }
  if (usageDomain === 'regulatory_binder' || usageDomain === 'training') {
    return TRACE_ORIGIN.SOP_MANUAL_EVIDENCE
  }
  if (usageDomain === 'budget_analysis' || usageDomain === 'contract_analysis') {
    return TRACE_ORIGIN.MANUAL_RECONCILIATION_DECISION
  }
  if (
    evidenceKind === EVIDENCE_KIND.VISIT_WINDOW ||
    evidenceKind === EVIDENCE_KIND.TIMING_RULE ||
    evidenceKind === EVIDENCE_KIND.PROCEDURE_GENERATION
  ) {
    return TRACE_ORIGIN.PROTOCOL_EVIDENCE
  }
  return TRACE_ORIGIN.SOP_MANUAL_EVIDENCE
}
