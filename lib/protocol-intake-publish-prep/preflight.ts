import type { LoadedApprovedHandoff } from '@/lib/protocol-intake-publish-prep/load-approved'
import { loadApprovedIntakeDraft } from '@/lib/protocol-intake-publish-prep/load-approved'
import {
  OPERATIONAL_SECTIONS,
  type PreflightCheck,
  type PreflightResult,
} from '@/lib/protocol-intake-publish-prep/types'

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

function str(record: Record<string, unknown>, key: string): string {
  const v = record[key]
  return typeof v === 'string' && v.trim() ? v.trim() : ''
}

function check(
  id: string,
  label: string,
  ok: boolean,
  blocker: boolean,
  detail?: string,
): PreflightCheck {
  return {
    id,
    label,
    status: ok ? 'pass' : blocker ? 'fail' : 'warn',
    blocker: !ok && blocker,
    detail,
  }
}

export function runPublishPreflight(handoff: LoadedApprovedHandoff): PreflightResult {
  const { approved, audit_exists, audit_entry_count } = handoff
  const checks: PreflightCheck[] = []

  checks.push(
    check('approved_draft_exists', 'Approved draft on file', true, true),
    check(
      'audit_reference',
      'Review audit reference exists',
      audit_exists,
      true,
      audit_exists ? `${audit_entry_count} audit entries` : 'review_audit.json missing',
    ),
  )

  const sections = new Set(approved.approval_summary?.sections_approved ?? [])
  const missingSections = OPERATIONAL_SECTIONS.filter((s) => !sections.has(s))
  checks.push(
    check(
      'sections_approved',
      'All required sections approved',
      missingSections.length === 0,
      true,
      missingSections.length ? `Missing: ${missingSections.join(', ')}` : undefined,
    ),
  )

  const meta = approved.study_metadata ?? {}
  const protocolId = str(meta, 'protocol_number') || str(meta, 'protocol_id')
  const title = str(meta, 'protocol_title') || str(meta, 'title')
  checks.push(
    check(
      'metadata_complete',
      'Study metadata complete',
      Boolean(protocolId && title),
      true,
      !protocolId ? 'protocol number/id required' : !title ? 'protocol title required' : undefined,
    ),
  )

  const visits = (approved.visits ?? []).map(asRecord)
  const visitCodes = visits
    .map((v) => str(v, 'visit_code'))
    .filter(Boolean)
  checks.push(
    check(
      'visits_complete',
      'Visits complete',
      visitCodes.length > 0,
      true,
      visitCodes.length ? `${visitCodes.length} visit(s)` : 'No approved visits',
    ),
  )

  const procedures = (approved.procedures ?? []).map(asRecord)
  const procedureCodes = procedures
    .map((p) => str(p, 'procedure_code'))
    .filter(Boolean)
  checks.push(
    check(
      'procedures_present',
      'Procedures present',
      procedureCodes.length > 0,
      true,
      procedureCodes.length ? `${procedureCodes.length} procedure(s)` : 'No approved procedures',
    ),
  )

  const compositions = (approved.source_composition ?? []).map(asRecord)
  const compProcedureCodes = compositions
    .map((c) => {
      const fromField = str(c, 'procedure_code')
      if (fromField) return fromField
      const itemId = str(c, 'item_id')
      if (itemId.startsWith('comp:')) return itemId.slice(5)
      return ''
    })
    .filter(Boolean)
  const procSet = new Set(procedureCodes)
  const unmapped = compProcedureCodes.filter((code) => !procSet.has(code))
  checks.push(
    check(
      'composition_resolved',
      'Source composition recommendations resolved',
      compositions.length > 0 && unmapped.length === 0,
      true,
      compositions.length === 0
        ? 'No source composition rows'
        : unmapped.length
          ? `Unmapped procedure codes: ${unmapped.join(', ')}`
          : `${compositions.length} composition row(s) linked`,
    ),
  )

  const mappedProcedures =
    procedureCodes.length > 0
    && compositions.length > 0
    && compProcedureCodes.every((code) => procSet.has(code))
  checks.push(
    check(
      'procedures_mapped',
      'Procedures mapped to visits (schedule + composition linkage)',
      visitCodes.length > 0 && mappedProcedures,
      true,
      !visitCodes.length
        ? 'Visits required for schedule linkage'
        : !mappedProcedures
          ? 'Each composition row must reference an approved procedure'
          : 'Visits and procedures linked via composition',
    ),
  )

  checks.push(
    check(
      'rejected_retained',
      'Rejected items retained for audit',
      Array.isArray(approved.rejected_items),
      false,
      `${approved.rejected_items?.length ?? 0} rejected item(s) retained`,
    ),
  )

  const safety = approved.safety
  checks.push(
    check(
      'safety_auto_publish',
      'Safety: auto_publish is false',
      safety?.auto_publish === false,
      true,
    ),
    check(
      'safety_auto_bind',
      'Safety: auto_bind is false',
      safety?.auto_bind === false,
      true,
    ),
    check(
      'safety_runtime_mutation',
      'Safety: runtime_mutation is false',
      safety?.runtime_mutation === false,
      true,
    ),
  )

  if (approved.draft_version !== '12D.1.0') {
    checks.push(
      check(
        'draft_version',
        'Approved draft version',
        false,
        true,
        `Expected 12D.1.0, got ${String(approved.draft_version)}`,
      ),
    )
  }

  const blockers = checks.filter((c) => c.blocker).map((c) => c.detail ? `${c.label}: ${c.detail}` : c.label)
  const warnings = checks
    .filter((c) => c.status === 'warn' && !c.blocker)
    .map((c) => c.detail ? `${c.label}: ${c.detail}` : c.label)

  return {
    passed: blockers.length === 0,
    blockers,
    warnings,
    checks,
  }
}

export function runPreflightForDraftKey(
  draftKey: string,
  cwd = process.cwd(),
): PreflightResult | null {
  const handoff = loadApprovedIntakeDraft(draftKey, cwd)
  if (!handoff) return null
  return runPublishPreflight(handoff)
}
