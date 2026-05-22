/**
 * Phase 12C addendum — retrieve-then-validate evidence layer over deterministic extraction.
 */
import { extracted } from '@/lib/protocol-intake/evidence'
import { applyEvidenceGates } from '@/lib/protocol-intake/rag/evidence-gates'
import { retrieveEvidence } from '@/lib/protocol-intake/rag/retrieval'
import type { EnrichedIntakeCorpus } from '@/lib/protocol-intake/normalization/enrich-corpus'
import type {
  ExtractedField,
  ExtractedStudyMetadata,
  ProtocolIntakeDraft,
} from '@/lib/protocol-intake/types'

function gateField<T extends string | number | null>(
  label: string,
  field: ExtractedField<T>,
  corpus: EnrichedIntakeCorpus,
): ExtractedField<T> {
  const strValue = field.value == null ? null : String(field.value)
  const retrieved = retrieveEvidence(corpus, {
    query: `${label} ${strValue ?? ''}`,
    section_hint: label.includes('protocol') ? 'title' : undefined,
    limit: 3,
  })
  const evidence = field.evidence.length ? field.evidence : retrieved
  const gated = applyEvidenceGates({
    field_label: label,
    extracted_value: strValue,
    evidence,
    corpus,
  })
  return extracted(field.value, gated.confidence, gated.evidence, {
    requires_human_review: gated.reviewer_required,
  })
}

export function applyEvidenceLayerToMetadata(
  metadata: ExtractedStudyMetadata,
  corpus: EnrichedIntakeCorpus,
): ExtractedStudyMetadata {
  return {
    ...metadata,
    protocol_number: gateField('protocol number', metadata.protocol_number, corpus),
    protocol_title: gateField('protocol title', metadata.protocol_title, corpus),
    sponsor: gateField('sponsor', metadata.sponsor, corpus),
    phase: gateField('phase', metadata.phase, corpus),
    investigational_product: gateField(
      'investigational product',
      metadata.investigational_product,
      corpus,
    ),
    source_document_evidence_refs: metadata.source_document_evidence_refs,
  }
}

export function applyEvidenceLayerToDraft(
  draft: ProtocolIntakeDraft,
  corpus: EnrichedIntakeCorpus,
): ProtocolIntakeDraft {
  const study_metadata = applyEvidenceLayerToMetadata(draft.study_metadata, corpus)

  const procedures = draft.procedures.map((proc) => {
    const evidence = proc.source_evidence.length
      ? proc.source_evidence
      : retrieveEvidence(corpus, {
          query: `${proc.procedure_name.value} ${proc.procedure_code.value}`,
          limit: 2,
        })
    const gated = applyEvidenceGates({
      field_label: proc.procedure_code.value,
      extracted_value: proc.procedure_name.value,
      evidence,
      corpus,
      footnote_dependency: proc.conditional.value && !proc.condition_text.value,
    })
    const requires_human_review = gated.reviewer_required || proc.requires_human_review
    return {
      ...proc,
      confidence: gated.confidence,
      requires_human_review,
      reviewer_required: requires_human_review,
      source_evidence: gated.evidence,
    }
  })

  const visits = draft.schedule.visits.map((visit) => {
    const evidence = visit.evidence.length
      ? visit.evidence
      : retrieveEvidence(corpus, {
          query: `${visit.visit_name.value} schedule`,
          prefer_tables: true,
          section_hint: 'schedule',
          limit: 2,
        })
    const gated = applyEvidenceGates({
      field_label: visit.visit_code.value,
      extracted_value: visit.visit_name.value,
      evidence,
      corpus,
    })
    const requires_human_review = gated.reviewer_required || visit.requires_human_review
    return {
      ...visit,
      confidence: gated.confidence,
      requires_human_review,
      reviewer_required: requires_human_review,
      evidence: gated.evidence,
    }
  })

  return {
    ...draft,
    study_metadata,
    procedures,
    schedule: { visits },
  }
}
