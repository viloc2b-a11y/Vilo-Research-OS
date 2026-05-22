import type { CrossCheckFinding } from '@/lib/protocol-intake/quality/cross-check'
import type {
  IntakeConflict,
  ProtocolIntakeDraft,
  ProtocolIntakeReviewSummary,
} from '@/lib/protocol-intake/types'

export function buildReviewSummary(
  draft: ProtocolIntakeDraft,
  context?: { crossChecks?: CrossCheckFinding[]; conflicts?: IntakeConflict[] },
): ProtocolIntakeReviewSummary {
  const found: string[] = []
  const needs_review: string[] = []
  const missing: string[] = []
  const recommended_source_sections: string[] = []

  const meta = draft.study_metadata
  if (meta.protocol_number.value) found.push(`Protocol number: ${meta.protocol_number.value}`)
  else missing.push('Protocol number')

  if (meta.protocol_title.value) found.push(`Title: ${meta.protocol_title.value}`)
  else missing.push('Protocol title')

  if (meta.sponsor.value) found.push(`Sponsor: ${meta.sponsor.value}`)
  else missing.push('Sponsor')

  if (meta.phase.value) found.push(`Phase: ${meta.phase.value}`)
  else missing.push('Phase')

  if (meta.investigational_product.value) {
    found.push(`IP: ${meta.investigational_product.value}`)
  } else missing.push('Investigational product')

  for (const field of Object.values(meta)) {
    if (field && typeof field === 'object' && 'requires_human_review' in field && field.requires_human_review) {
      needs_review.push('Study metadata field flagged for review')
      break
    }
  }

  if (draft.eligibility.inclusion_criteria.length) {
    found.push(`${draft.eligibility.inclusion_criteria.length} inclusion criteria`)
  } else missing.push('Inclusion criteria')

  if (draft.eligibility.exclusion_criteria.length) {
    found.push(`${draft.eligibility.exclusion_criteria.length} exclusion criteria`)
  } else missing.push('Exclusion criteria')

  if (draft.schedule.visits.length) {
    found.push(`${draft.schedule.visits.length} visit candidate(s)`)
  } else missing.push('Schedule visits')

  if (draft.procedures.length) {
    found.push(`${draft.procedures.length} procedure candidate(s)`)
  } else missing.push('Procedures')

  for (const proc of draft.procedures.filter((p) => p.requires_human_review)) {
    needs_review.push(`Procedure ${proc.procedure_code.value} needs review`)
  }
  for (const visit of draft.schedule.visits.filter((v) => v.requires_human_review)) {
    needs_review.push(`Visit ${visit.visit_code.value} needs review`)
  }

  for (const rec of draft.source_composition) {
    const blocks = [...rec.recommended_library_blocks, ...rec.recommended_overlays]
    if (blocks.length) {
      recommended_source_sections.push(
        `${rec.procedure_code}: ${blocks.join(' + ')}`,
      )
    }
    if (rec.requires_human_review) {
      needs_review.push(`Source composition for ${rec.procedure_code}`)
    }
  }

  const conflicts: string[] = []
  for (const c of context?.conflicts ?? draft.intake_conflicts ?? []) {
    conflicts.push(c.message)
    needs_review.push(`Conflict: ${c.message}`)
  }
  for (const check of context?.crossChecks ?? []) {
    if (check.reviewer_required) {
      needs_review.push(check.message)
    }
  }

  return {
    found: [...new Set(found)],
    needs_review: [...new Set(needs_review)],
    missing: [...new Set(missing)],
    conflicts: [...new Set(conflicts)],
    recommended_source_sections: [...new Set(recommended_source_sections)],
  }
}

export function formatIntakeDraftMarkdown(draft: ProtocolIntakeDraft): string {
  const r = draft.review
  const lines = [
    `# Protocol Intake Draft — ${draft.protocol_id}`,
    '',
    `**Status:** ${draft.intake_status} · **Created:** ${draft.created_at}`,
    '',
    '## Coordinator summary',
    '',
    '### Found',
    ...r.found.map((f) => `- ${f}`),
    '',
    '### Needs review',
    ...(r.needs_review.length ? r.needs_review.map((n) => `- ${n}`) : ['- None']),
    '',
    '### Missing / unclear',
    ...(r.missing.length ? r.missing.map((m) => `- ${m}`) : ['- None']),
    '',
    '### Conflicts',
    ...(r.conflicts.length ? r.conflicts.map((c) => `- ${c}`) : ['- None']),
    '',
    '### Recommended source sections',
    ...(r.recommended_source_sections.length
      ? r.recommended_source_sections.map((s) => `- ${s}`)
      : ['- None yet']),
    '',
    '## Study metadata (draft)',
    `- Protocol: ${draft.study_metadata.protocol_number.value ?? '—'}`,
    `- Title: ${draft.study_metadata.protocol_title.value ?? '—'}`,
    `- Sponsor: ${draft.study_metadata.sponsor.value ?? '—'}`,
    `- Phase: ${draft.study_metadata.phase.value ?? '—'}`,
    `- IP: ${draft.study_metadata.investigational_product.value ?? '—'}`,
    '',
    '## Visits (candidates)',
    ...draft.schedule.visits.map(
      (v) =>
        `- **${v.visit_name.value}** (${v.visit_code.value}) day ${v.study_day.value ?? '?'} · ${v.modality.value ?? 'modality TBD'}`,
    ),
    '',
    '## Procedures (candidates)',
    ...draft.procedures.map(
      (p) =>
        `- **${p.procedure_name.value}** (${p.procedure_code.value})${p.conditional.value ? ' — *conditional*' : ''}`,
    ),
    '',
    '_Draft only — not published to runtime._',
  ]
  return lines.join('\n')
}

export function serializeIntakeDraft(draft: ProtocolIntakeDraft): string {
  return JSON.stringify(draft, null, 2)
}
