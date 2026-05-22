import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { EvidenceRef } from '@/lib/protocol-intake/types'
import type {
  IntakePackageManifest,
  IntakeReviewPackage,
  ReviewableItem,
  ReviewFieldRow,
} from '@/lib/protocol-intake-review/types'
import { buildInitialSummary, defaultItemStatus } from '@/lib/protocol-intake-review/load-package'

type PyField = {
  value?: unknown
  confidence?: string
  requires_human_review?: boolean
  extraction_method?: string
  evidence_refs?: Array<{
    file_name: string
    page_or_sheet: string
    section_reference?: string
    source_snippet: string
  }>
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function stringOrUndefined(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value : undefined
}

function evidenceRefsFrom(value: unknown): EvidenceRef[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((raw) => {
    if (!isRecord(raw)) return []
    const fileName = stringOrUndefined(raw.file_name)
    const pageOrSheet = stringOrUndefined(raw.page_or_sheet)
    const sourceSnippet = stringOrUndefined(raw.source_snippet)
    if (!fileName || !pageOrSheet || !sourceSnippet) return []
    return [{
      file_name: fileName,
      page_or_sheet: pageOrSheet,
      section_reference: stringOrUndefined(raw.section_reference),
      source_snippet: sourceSnippet,
    }]
  })
}

function pyFieldRows(
  fields: Array<{ key: string; label: string; field: PyField }>,
): ReviewFieldRow[] {
  return fields.map(({ key, label, field }) => ({
    field_key: key,
    label,
    value: field.value ?? null,
    original_extracted_value: field.value ?? null,
    confidence: field.confidence as ReviewFieldRow['confidence'],
    requires_human_review: Boolean(field.requires_human_review),
    extraction_method: field.extraction_method,
    evidence_refs: evidenceRefsFrom(field.evidence_refs),
  }))
}

function itemFromFields(
  item_id: string,
  section: ReviewableItem['section'],
  title: string,
  rows: ReviewFieldRow[],
): ReviewableItem {
  const worst = rows.reduce(
    (acc, r) => {
      if (r.confidence === 'low') return 'low'
      if (r.confidence === 'medium' && acc !== 'low') return 'medium'
      return acc
    },
    'high' as string,
  )
  const needs = rows.some((r) => r.requires_human_review)
  return {
    item_id,
    section,
    title,
    fields: rows,
    summary_labels: [
      defaultItemStatus(worst, needs),
      worst,
      needs ? 'Needs review' : 'Found',
    ],
  }
}

export function pyPackageToReviewPackage(
  draftKey: string,
  label: string,
  base: string,
  manifest: IntakePackageManifest,
): IntakeReviewPackage {
  const read = (name: string) => JSON.parse(readFileSync(join(base, name), 'utf8')) as Record<string, unknown>
  const metaWrap = read('study_metadata_draft.json')
  const meta = (metaWrap.study_metadata ?? metaWrap) as Record<string, PyField>
  const elig = read('eligibility_draft.json') as {
    inclusion_criteria?: Array<Record<string, unknown>>
    exclusion_criteria?: Array<Record<string, unknown>>
  }
  const schedule = read('schedule_draft.json') as { visits?: Array<Record<string, unknown>> }
  const procs = read('procedure_draft.json') as { procedures?: Array<Record<string, unknown>> }
  const comp = read('source_composition_draft.json') as {
    recommendations?: Array<Record<string, unknown>>
  }

  const items: ReviewableItem[] = []

  const metaKeys: Array<{ key: string; label: string }> = [
    { key: 'protocol_number', label: 'Protocol number' },
    { key: 'protocol_title', label: 'Protocol title' },
    { key: 'sponsor', label: 'Sponsor' },
    { key: 'cro', label: 'CRO' },
    { key: 'phase', label: 'Phase' },
    { key: 'indication', label: 'Indication' },
    { key: 'investigational_product', label: 'Investigational product' },
    { key: 'study_design', label: 'Study design' },
  ]
  for (const { key, label: fieldLabel } of metaKeys) {
    const field = meta[key] as PyField | undefined
    if (!field) continue
    items.push(
      itemFromFields(`meta:${key}`, 'study_metadata', fieldLabel, pyFieldRows([{ key, label: fieldLabel, field }])),
    )
  }

  for (const c of [...(elig.inclusion_criteria ?? []), ...(elig.exclusion_criteria ?? [])]) {
    const text = String(c.criterion_text ?? '')
    const cat = String(c.category ?? 'other')
    items.push({
      item_id: `elig:${cat}:${text.slice(0, 24)}`,
      section: 'eligibility',
      title: `${cat}: ${text.slice(0, 60)}`,
      fields: [
        {
          field_key: 'criterion_text',
          label: 'Criterion',
          value: text,
          original_extracted_value: text,
          confidence: c.confidence as ReviewFieldRow['confidence'],
          requires_human_review: Boolean(c.requires_human_review),
          extraction_method: String(c.extraction_method ?? 'deterministic'),
          evidence_refs: (c.evidence_refs as ReviewFieldRow['evidence_refs']) ?? [],
        },
        {
          field_key: 'category',
          label: 'Category',
          value: cat,
          original_extracted_value: cat,
          confidence: 'high',
          requires_human_review: false,
          evidence_refs: [],
        },
      ],
      summary_labels: [defaultItemStatus(String(c.confidence), Boolean(c.requires_human_review))],
    })
  }

  for (const v of schedule.visits ?? []) {
    const code = (v.visit_code as PyField)?.value ?? v.visit_code
    const name = (v.visit_name as PyField)?.value ?? ''
    const rows: ReviewFieldRow[] = [
      'visit_code',
      'visit_name',
      'study_day',
      'window',
      'modality',
      'eligible_arms',
      'eligible_subject_roles',
    ].map((key) => {
      const field = (v[key] as PyField) ?? { value: null }
      return {
        field_key: key,
        label: key.replace(/_/g, ' '),
        value: field.value ?? null,
        original_extracted_value: field.value ?? null,
        confidence: field.confidence as ReviewFieldRow['confidence'],
        requires_human_review: Boolean(field.requires_human_review),
        extraction_method: field.extraction_method,
        evidence_refs: evidenceRefsFrom(field.evidence_refs ?? v.evidence_refs),
      }
    })
    items.push(
      itemFromFields(`visit:${String(code)}`, 'visits', String(name || code), rows),
    )
  }

  for (const p of procs.procedures ?? []) {
    const code = (p.procedure_code as PyField)?.value ?? p.procedure_code
    const rows = [
      'procedure_code',
      'procedure_name',
      'procedure_category',
      'required',
      'conditional',
      'condition_text',
      'timing_notes',
    ].map((key) => {
      const field = (p[key] as PyField) ?? { value: null }
      const rawEvidence =
        field.evidence_refs
        ?? (p.evidence_refs as EvidenceRef[] | undefined)
        ?? (p.source_evidence as EvidenceRef[] | undefined)
        ?? []
      return {
        field_key: key,
        label: key.replace(/_/g, ' '),
        value: field.value ?? null,
        original_extracted_value: field.value ?? null,
        confidence: field.confidence as ReviewFieldRow['confidence'],
        requires_human_review: Boolean(field.requires_human_review ?? p.requires_human_review),
        extraction_method: String(field.extraction_method ?? p.extraction_method ?? 'deterministic'),
        evidence_refs: evidenceRefsFrom(rawEvidence),
      }
    })
    items.push(
      itemFromFields(`proc:${String(code)}`, 'procedures', String((p.procedure_name as PyField)?.value ?? code), rows),
    )
  }

  for (const r of comp.recommendations ?? []) {
    const code = String(r.procedure_code ?? '')
    items.push({
      item_id: `comp:${code}`,
      section: 'source_composition',
      title: `Source sections for ${code}`,
      fields: [
        {
          field_key: 'recommended_library_blocks',
          label: 'Library blocks',
          value: r.recommended_library_blocks,
          original_extracted_value: r.recommended_library_blocks,
          confidence: r.confidence as ReviewFieldRow['confidence'],
          requires_human_review: Boolean(r.requires_human_review),
          extraction_method: String(r.extraction_method ?? 'deterministic_category_map'),
          evidence_refs: (r.evidence_refs as ReviewFieldRow['evidence_refs']) ?? [],
        },
        {
          field_key: 'recommended_overlays',
          label: 'Overlays',
          value: r.recommended_overlays,
          original_extracted_value: r.recommended_overlays,
          confidence: r.confidence as ReviewFieldRow['confidence'],
          requires_human_review: Boolean(r.requires_human_review),
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

  const summary = buildInitialSummary(items, manifest)
  for (const line of summary.missing) {
    items.push({
      item_id: `missing:${line}`,
      section: 'missing',
      title: line,
      fields: [],
      summary_labels: ['Missing'],
    })
  }
  for (const line of summary.conflicts) {
    items.push({
      item_id: `conflict:${line}`,
      section: 'conflicts',
      title: line,
      fields: [],
      summary_labels: ['Conflict', 'needs_clarification'],
    })
  }

  return {
    draft_key: draftKey,
    package_label: label,
    package_path: base,
    manifest,
    items: items.sort((a, b) => a.item_id.localeCompare(b.item_id)),
    summary,
    source_documents: (manifest.input_files ?? []).map((f) => ({ file_name: f })),
  }
}
