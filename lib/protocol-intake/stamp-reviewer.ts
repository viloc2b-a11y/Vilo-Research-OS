import type {
  ExtractedEligibilityCriterion,
  ExtractedProcedure,
  ExtractedVisit,
  ProtocolIntakeDraft,
  SourceCompositionRecommendation,
} from '@/lib/protocol-intake/types'

/** Ensures coordinator-facing reviewer_required mirrors requires_human_review. */
export function stampReviewerRequired(draft: ProtocolIntakeDraft): ProtocolIntakeDraft {
  return {
    ...draft,
    eligibility: {
      inclusion_criteria: draft.eligibility.inclusion_criteria.map(stampCriterion),
      exclusion_criteria: draft.eligibility.exclusion_criteria.map(stampCriterion),
    },
    schedule: {
      visits: draft.schedule.visits.map(stampVisit),
    },
    procedures: draft.procedures.map(stampProcedure),
    source_composition: draft.source_composition.map(stampComposition),
  }
}

function stampCriterion(c: ExtractedEligibilityCriterion): ExtractedEligibilityCriterion {
  return { ...c, reviewer_required: c.requires_human_review }
}

function stampVisit(v: ExtractedVisit): ExtractedVisit {
  return { ...v, reviewer_required: v.requires_human_review }
}

function stampProcedure(p: ExtractedProcedure): ExtractedProcedure {
  return { ...p, reviewer_required: p.requires_human_review }
}

function stampComposition(
  r: SourceCompositionRecommendation,
): SourceCompositionRecommendation {
  return { ...r, reviewer_required: r.requires_human_review }
}
