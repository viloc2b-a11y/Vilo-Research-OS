/**
 * Phase 12C — Protocol Intake → structured draft pipeline (no publish/bind).
 * Addendum: normalize → hybrid retrieval gates → cross-check → conflicts.
 */
import type { NormalizedIntakeCorpus } from '@/lib/protocol-intake/document'
import { applyEvidenceLayerToDraft } from '@/lib/protocol-intake/apply-evidence-layer'
import { extractEligibility } from '@/lib/protocol-intake/extractors/eligibility'
import { extractStudyMetadata } from '@/lib/protocol-intake/extractors/metadata'
import {
  attachProceduresToVisits,
  extractScheduleVisits,
} from '@/lib/protocol-intake/extractors/schedule'
import { extractProcedures } from '@/lib/protocol-intake/extractors/procedures'
import { enrichIntakeCorpus } from '@/lib/protocol-intake/normalization/enrich-corpus'
import { detectIntakeConflicts } from '@/lib/protocol-intake/quality/conflicts'
import { runIntakeCrossChecks } from '@/lib/protocol-intake/quality/cross-check'
import { recommendSourceComposition } from '@/lib/protocol-intake/recommenders/source-composition'
import {
  buildCliniqDraftInputs,
  buildVpiDraftInputs,
} from '@/lib/protocol-intake/recommenders/vpi-cliniq'
import {
  buildReviewSummary,
  formatIntakeDraftMarkdown,
  serializeIntakeDraft,
} from '@/lib/protocol-intake/review-artifact'
import { mergeEvidence } from '@/lib/protocol-intake/evidence'
import { stampReviewerRequired } from '@/lib/protocol-intake/stamp-reviewer'
import type { ProtocolIntakeDraft } from '@/lib/protocol-intake/types'

export type IntakePipelineResult = {
  draft: ProtocolIntakeDraft
  json: string
  markdown: string
}

export type RunProtocolIntakeOptions = {
  protocol_id: string
  protocol_id_hint?: string
  corpus: NormalizedIntakeCorpus
  /** Optional fixed timestamp for deterministic proofs/tests. */
  created_at?: string
}

/** Safety guard — intake must never call publish/bind paths. */
export const PROTOCOL_INTAKE_SAFETY = {
  auto_publish: false,
  auto_bind: false,
  mutates_runtime: false,
} as const

export function runProtocolIntakePipeline(
  options: RunProtocolIntakeOptions,
): IntakePipelineResult {
  const { corpus, protocol_id, protocol_id_hint } = options

  const enriched = enrichIntakeCorpus(corpus)

  const study_metadata = extractStudyMetadata(enriched, protocol_id_hint ?? protocol_id)
  const eligibility = extractEligibility(enriched)
  let visits = extractScheduleVisits(enriched)
  const { procedures, visitLinks } = extractProcedures(enriched)
  visits = attachProceduresToVisits(visits, visitLinks)

  const source_composition = recommendSourceComposition(procedures)
  const evidence = mergeEvidence(
    study_metadata.source_document_evidence_refs,
    ...procedures.map((p) => p.source_evidence),
    ...visits.map((v) => v.evidence),
  )

  const vpi = buildVpiDraftInputs(visits, procedures, evidence)
  const cliniq = buildCliniqDraftInputs(visits, procedures, evidence)

  let draft: ProtocolIntakeDraft = {
    draft_version: '12C.2.0',
    protocol_id,
    intake_status: 'needs_review',
    created_at: options.created_at ?? new Date().toISOString(),
    source_documents: corpus.documents,
    study_metadata,
    eligibility,
    schedule: { visits },
    procedures,
    source_composition,
    vpi,
    cliniq,
    review: {
      found: [],
      needs_review: [],
      missing: [],
      conflicts: [],
      recommended_source_sections: [],
    },
    intake_conflicts: [],
  }

  draft = applyEvidenceLayerToDraft(draft, enriched)

  const crossChecks = runIntakeCrossChecks(draft, enriched)
  const intake_conflicts = detectIntakeConflicts(draft, enriched)
  draft.intake_conflicts = intake_conflicts

  draft.review = buildReviewSummary(draft, { crossChecks, conflicts: intake_conflicts })

  const anyConflict = intake_conflicts.length > 0
  const anyLow =
    anyConflict
    || crossChecks.some((c) => c.reviewer_required)
    || [
      draft.study_metadata.protocol_number,
      ...draft.procedures.flatMap((p) => [p.procedure_code, p.procedure_name]),
    ].some((f) => f.requires_human_review)

  draft.intake_status =
    anyLow || draft.review.missing.length > 0 ? 'needs_review' : 'draft'

  draft = stampReviewerRequired(draft)

  return {
    draft,
    json: serializeIntakeDraft(draft),
    markdown: formatIntakeDraftMarkdown(draft),
  }
}
