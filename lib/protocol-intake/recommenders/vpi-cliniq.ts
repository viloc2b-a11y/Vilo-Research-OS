import { extracted, mergeEvidence } from '@/lib/protocol-intake/evidence'
import type {
  CliniqDraftInputs,
  ExtractedProcedure,
  ExtractedVisit,
  VpiDraftInputs,
} from '@/lib/protocol-intake/types'
import type { EvidenceRef } from '@/lib/protocol-intake/types'

export function buildVpiDraftInputs(
  visits: ExtractedVisit[],
  procedures: ExtractedProcedure[],
  evidence: EvidenceRef[],
): VpiDraftInputs {
  const conditionalCount = procedures.filter((p) => p.conditional.value).length
  const remoteVisits = visits.filter((v) =>
    ['phone', 'remote', 'home', 'off_site'].includes(v.modality.value ?? ''),
  ).length

  return {
    visit_burden_score_inputs: extracted(
      {
        visit_count: visits.length,
        remote_or_home_visit_count: remoteVisits,
      },
      'medium',
      evidence,
    ),
    safety_complexity_inputs: extracted(
      {
        conditional_procedure_count: conditionalCount,
        ae_procedure_present: procedures.some((p) => p.procedure_category.value === 'adverse_events'),
      },
      'medium',
      evidence,
    ),
    conditional_workflow_inputs: extracted(
      {
        conditional_procedures: procedures
          .filter((p) => p.conditional.value)
          .map((p) => ({
            code: p.procedure_code.value,
            condition: p.condition_text.value,
          })),
      },
      conditionalCount > 0 ? 'medium' : 'low',
      evidence,
      { requires_human_review: conditionalCount > 0 },
    ),
    recruitment_complexity_inputs: extracted(
      {
        role_based_visits: visits.some(
          (v) => (v.eligible_subject_roles.value?.length ?? 0) > 0,
        ),
      },
      'low',
      evidence,
      { requires_human_review: true },
    ),
    staff_burden_inputs: extracted(
      {
        total_procedures: procedures.length,
        visit_count: visits.length,
      },
      'medium',
      evidence,
    ),
    evidence_refs: evidence,
  }
}

export function buildCliniqDraftInputs(
  visits: ExtractedVisit[],
  procedures: ExtractedProcedure[],
  evidence: EvidenceRef[],
): CliniqDraftInputs {
  const billable = procedures
    .filter((p) => !p.conditional.value)
    .map((p) => ({
      procedure_code: p.procedure_code.value,
      procedure_name: p.procedure_name.value,
    }))

  const conditional = procedures
    .filter((p) => p.conditional.value)
    .map((p) => ({
      procedure_code: p.procedure_code.value,
      condition_text: p.condition_text.value,
    }))

  const highCost = procedures
    .filter((p) => /ACTH|ECG|infusion|panel|stimulation/i.test(p.procedure_name.value))
    .map((p) => p.procedure_name.value)

  return {
    billable_procedures: extracted(billable, 'medium', evidence),
    conditional_billables: extracted(conditional, 'medium', evidence, {
      requires_human_review: true,
    }),
    pass_through_candidates: extracted(
      procedures
        .filter((p) => /lab|central|shipping/i.test(p.procedure_name.value))
        .map((p) => p.procedure_code.value),
      'low',
      evidence,
      { requires_human_review: true },
    ),
    high_cost_assessments: extracted(highCost, 'medium', evidence, {
      requires_human_review: highCost.length > 0,
    }),
    visit_frequency_inputs: extracted(
      {
        visits: visits.map((v) => ({
          code: v.visit_code.value,
          day: v.study_day.value,
          window: v.window.value,
        })),
      },
      'medium',
      evidence,
    ),
    evidence_refs: mergeEvidence(evidence),
  }
}
