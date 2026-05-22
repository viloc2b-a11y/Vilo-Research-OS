import type { ProtocolIntakeDraft } from '@/lib/protocol-intake/types'
import type { IntakeReviewPackage, ReviewableItem, ReviewFieldRow } from '@/lib/protocol-intake-review/types'
import { buildInitialSummary, defaultItemStatus } from '@/lib/protocol-intake-review/load-package'

function fieldRow(
  key: string,
  label: string,
  field: {
    value: unknown
    confidence: string
    requires_human_review: boolean
    evidence: Array<{ file_name: string; page_or_sheet: string; section_reference?: string; source_snippet: string }>
  },
  extraction_method = 'deterministic_regex',
): ReviewFieldRow {
  return {
    field_key: key,
    label,
    value: field.value,
    original_extracted_value: field.value,
    confidence: field.confidence as ReviewFieldRow['confidence'],
    requires_human_review: field.requires_human_review,
    extraction_method,
    evidence_refs: field.evidence,
  }
}

export function draftToReviewPackage(
  draftKey: string,
  label: string,
  base: string,
  draft: ProtocolIntakeDraft,
): IntakeReviewPackage {
  const items: ReviewableItem[] = []
  const m = draft.study_metadata

  for (const [key, labelText] of [
    ['protocol_number', 'Protocol number'],
    ['protocol_title', 'Protocol title'],
    ['sponsor', 'Sponsor'],
    ['cro', 'CRO'],
    ['phase', 'Phase'],
    ['indication', 'Indication'],
    ['investigational_product', 'Investigational product'],
    ['study_design', 'Study design'],
  ] as const) {
    const field = m[key]
    items.push({
      item_id: `meta:${key}`,
      section: 'study_metadata',
      title: labelText,
      fields: [fieldRow(key, labelText, field)],
      summary_labels: [defaultItemStatus(field.confidence, field.requires_human_review)],
    })
  }

  for (const c of [...draft.eligibility.inclusion_criteria, ...draft.eligibility.exclusion_criteria]) {
    items.push({
      item_id: `elig:${c.category}:${c.criterion_text.slice(0, 24)}`,
      section: 'eligibility',
      title: `${c.category}: ${c.criterion_text.slice(0, 60)}`,
      fields: [
        {
          field_key: 'criterion_text',
          label: 'Criterion',
          value: c.criterion_text,
          original_extracted_value: c.criterion_text,
          confidence: c.confidence,
          requires_human_review: c.requires_human_review,
          extraction_method: 'deterministic_section',
          evidence_refs: c.evidence,
        },
        {
          field_key: 'category',
          label: 'Category',
          value: c.category,
          original_extracted_value: c.category,
          confidence: 'high',
          requires_human_review: false,
          evidence_refs: [],
        },
      ],
      summary_labels: [defaultItemStatus(c.confidence, c.requires_human_review)],
    })
  }

  for (const v of draft.schedule.visits) {
    items.push({
      item_id: `visit:${v.visit_code.value}`,
      section: 'visits',
      title: v.visit_name.value ?? v.visit_code.value,
      fields: [
        fieldRow('visit_code', 'Visit code', v.visit_code),
        fieldRow('visit_name', 'Visit name', v.visit_name),
        fieldRow('study_day', 'Study day', v.study_day),
        fieldRow('window', 'Window', v.window),
        fieldRow('modality', 'Modality', v.modality),
        fieldRow('eligible_arms', 'Eligible arms', v.eligible_arms),
        fieldRow('eligible_subject_roles', 'Eligible roles', v.eligible_subject_roles),
      ],
      summary_labels: [defaultItemStatus(v.confidence, v.requires_human_review)],
    })
  }

  for (const p of draft.procedures) {
    items.push({
      item_id: `proc:${p.procedure_code.value}`,
      section: 'procedures',
      title: p.procedure_name.value,
      fields: [
        fieldRow('procedure_code', 'Procedure code', p.procedure_code),
        fieldRow('procedure_name', 'Procedure name', p.procedure_name),
        fieldRow('procedure_category', 'Category', p.procedure_category),
        fieldRow('required', 'Required', p.required),
        fieldRow('conditional', 'Conditional', p.conditional),
        fieldRow('condition_text', 'Condition text', p.condition_text),
        fieldRow('timing_notes', 'Timing notes', p.timing_notes),
      ],
      summary_labels: [defaultItemStatus(p.confidence, p.requires_human_review)],
    })
  }

  for (const r of draft.source_composition) {
    items.push({
      item_id: `comp:${r.procedure_code}`,
      section: 'source_composition',
      title: `Source sections for ${r.procedure_code}`,
      fields: [
        {
          field_key: 'recommended_library_blocks',
          label: 'Library blocks',
          value: r.recommended_library_blocks,
          original_extracted_value: r.recommended_library_blocks,
          confidence: r.confidence,
          requires_human_review: r.requires_human_review,
          extraction_method: 'deterministic_category_map',
          evidence_refs: r.evidence_refs,
        },
        {
          field_key: 'recommended_overlays',
          label: 'Overlays',
          value: r.recommended_overlays,
          original_extracted_value: r.recommended_overlays,
          confidence: r.confidence,
          requires_human_review: r.requires_human_review,
          evidence_refs: [],
        },
        {
          field_key: 'include_fields',
          label: 'Include fields',
          value: r.include_fields,
          original_extracted_value: r.include_fields,
          confidence: 'medium',
          requires_human_review: false,
          evidence_refs: [],
        },
        {
          field_key: 'optional_fields',
          label: 'Optional fields',
          value: r.optional_fields,
          original_extracted_value: r.optional_fields,
          confidence: 'medium',
          requires_human_review: false,
          evidence_refs: [],
        },
        {
          field_key: 'excluded_fields',
          label: 'Excluded fields',
          value: r.excluded_fields,
          original_extracted_value: r.excluded_fields,
          confidence: 'medium',
          requires_human_review: false,
          evidence_refs: [],
        },
        {
          field_key: 'omission_reasons',
          label: 'Omission reasons',
          value: r.omission_reasons,
          original_extracted_value: r.omission_reasons,
          confidence: 'medium',
          requires_human_review: false,
          evidence_refs: [],
        },
      ],
      summary_labels: ['Recommended source section'],
    })
  }

  const summary = draft.review ?? buildInitialSummary(items, { study_key: draft.protocol_id })
  for (const line of summary.missing) {
    items.push({ item_id: `missing:${line}`, section: 'missing', title: line, fields: [], summary_labels: ['Missing'] })
  }
  for (const line of summary.conflicts) {
    items.push({
      item_id: `conflict:${line}`,
      section: 'conflicts',
      title: line,
      fields: [],
      summary_labels: ['Conflict'],
    })
  }

  return {
    draft_key: draftKey,
    package_label: label,
    package_path: base,
    manifest: {
      draft_version: draft.draft_version,
      study_key: draft.protocol_id,
      protocol_id: draft.protocol_id,
      review: summary,
      safety: {
        auto_publish: false,
        auto_bind: false,
        runtime_mutation: false,
        requires_human_approval: true,
      },
    },
    items: items.sort((a, b) => a.item_id.localeCompare(b.item_id)),
    summary,
    source_documents: draft.source_documents.map((d) => ({
      file_name: d.file_name,
      file_type: d.adapter_kind,
    })),
  }
}
