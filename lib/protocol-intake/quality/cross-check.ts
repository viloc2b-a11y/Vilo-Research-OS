/**
 * Phase 12C addendum — independent consistency checks (no silent fixes).
 */
import type { EnrichedIntakeCorpus } from '@/lib/protocol-intake/normalization/enrich-corpus'
import type { ProtocolIntakeDraft } from '@/lib/protocol-intake/types'

export type CrossCheckFinding = {
  check_id: string
  severity: 'info' | 'warning' | 'error'
  message: string
  reviewer_required: boolean
}

export function runIntakeCrossChecks(
  draft: ProtocolIntakeDraft,
  corpus: EnrichedIntakeCorpus,
): CrossCheckFinding[] {
  const findings: CrossCheckFinding[] = []

  const protocolInTitle =
    draft.study_metadata.protocol_number.value
    && draft.study_metadata.protocol_title.value?.includes(
      draft.study_metadata.protocol_number.value,
    )
  if (
    draft.study_metadata.protocol_number.value
    && draft.study_metadata.protocol_title.value
    && !protocolInTitle
  ) {
    findings.push({
      check_id: 'metadata_consistency',
      severity: 'warning',
      message: 'Protocol number not echoed in extracted title — verify both fields',
      reviewer_required: true,
    })
  }

  const narrativeVisitMentions = (corpus.full_text.match(/\bvisit\s*\d+\s*:/gi) ?? []).length
  const tableVisitRows = corpus.segments
    .filter((s) => s.content_kind === 'table')
    .flatMap((s) => s.text.split('\n').filter((l) => /^\s*V\d+/i.test(l) || /visit/i.test(l)))

  if (narrativeVisitMentions > 0 && draft.schedule.visits.length > 0) {
    const delta = Math.abs(narrativeVisitMentions - draft.schedule.visits.length)
    if (delta > 1) {
      findings.push({
        check_id: 'visit_count_consistency',
        severity: 'warning',
        message: `Narrative mentions ${narrativeVisitMentions} visit(s) but draft has ${draft.schedule.visits.length}`,
        reviewer_required: true,
      })
    }
  }

  if (tableVisitRows.length > 0 && draft.schedule.visits.length > 0) {
    const delta = Math.abs(tableVisitRows.length - draft.schedule.visits.length)
    if (delta > 2) {
      findings.push({
        check_id: 'soa_row_consistency',
        severity: 'warning',
        message: `Schedule table rows (${tableVisitRows.length}) differ from extracted visits (${draft.schedule.visits.length})`,
        reviewer_required: true,
      })
    }
  }

  const unboundProcedures = draft.procedures.filter(
    (p) =>
      !draft.source_composition.some((r) => r.procedure_code === p.procedure_code.value),
  )
  if (unboundProcedures.length) {
    findings.push({
      check_id: 'procedure_binding_readiness',
      severity: 'info',
      message: `${unboundProcedures.length} procedure(s) lack source composition recommendation`,
      reviewer_required: true,
    })
  }

  const inc = draft.eligibility.inclusion_criteria.length
  const exc = draft.eligibility.exclusion_criteria.length
  if (inc === 0 || exc === 0) {
    findings.push({
      check_id: 'eligibility_count_sanity',
      severity: inc === 0 && exc === 0 ? 'error' : 'warning',
      message: `Eligibility counts: ${inc} inclusion, ${exc} exclusion`,
      reviewer_required: true,
    })
  } else if (inc < 2 || exc < 2) {
    findings.push({
      check_id: 'eligibility_count_sanity',
      severity: 'warning',
      message: `Low eligibility counts (${inc} inclusion, ${exc} exclusion) — confirm completeness`,
      reviewer_required: true,
    })
  }

  const footnotes = corpus.segments.filter((s) => s.content_kind === 'footnote')
  const conditionalProcs = draft.procedures.filter((p) => p.conditional.value)
  if (footnotes.length && conditionalProcs.length) {
    const unresolved = conditionalProcs.filter((p) => {
      const code = p.procedure_code.value
      return !footnotes.some((fn) => fn.text.toLowerCase().includes(code.toLowerCase()))
    })
    if (unresolved.length) {
      findings.push({
        check_id: 'footnote_procedure_dependency',
        severity: 'warning',
        message: `${unresolved.length} conditional procedure(s) without matching footnote reference`,
        reviewer_required: true,
      })
    }
  }

  return findings
}
