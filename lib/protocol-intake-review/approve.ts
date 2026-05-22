import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type {
  IntakeReviewPackage,
  ReviewAuditEntry,
  ReviewWorkspaceState,
} from '@/lib/protocol-intake-review/types'
import { REVIEW_SAFETY } from '@/lib/protocol-intake-review/types'
import { canIncludeInApproved, resolvedFieldValue } from '@/lib/protocol-intake-review/resolve'
import { workspaceDir } from '@/lib/protocol-intake-review/paths'

export type ApprovedIntakeDraft = {
  draft_version: '12D.1.0'
  draft_key: string
  approved_at: string
  approved_by?: string
  manifest_reference: {
    package_path: string
    study_key?: string
    draft_id?: string
  }
  safety: typeof REVIEW_SAFETY
  approval_summary: {
    sections_approved: string[]
    accepted_count: number
    edited_count: number
    rejected_count: number
  }
  study_metadata: Record<string, unknown>
  eligibility: { inclusion: unknown[]; exclusion: unknown[] }
  visits: unknown[]
  procedures: unknown[]
  source_composition: unknown[]
  rejected_items: unknown[]
  edit_history: ReviewAuditEntry[]
}

export function buildApprovedDraft(
  pkg: IntakeReviewPackage,
  ws: ReviewWorkspaceState,
  reviewerId?: string,
): ApprovedIntakeDraft {
  const study_metadata: Record<string, unknown> = {}
  const rejected_items: unknown[] = []
  const visits: unknown[] = []
  const procedures: unknown[] = []
  const source_composition: unknown[] = []
  const inclusion: unknown[] = []
  const exclusion: unknown[] = []

  for (const item of pkg.items) {
    const state = ws.items[item.item_id]
    if (!state) continue
    const record: Record<string, unknown> = {
      item_id: item.item_id,
      reviewer_status: state.reviewer_status,
      evidence_insufficient: state.evidence_insufficient,
    }
    for (const field of item.fields) {
      record[field.field_key] = resolvedFieldValue(state, field.field_key, field.original_extracted_value)
      record[`_original_${field.field_key}`] = field.original_extracted_value
    }
    const target =
      item.section === 'study_metadata'
        ? study_metadata
        : item.section === 'visits'
          ? visits
          : item.section === 'procedures'
            ? procedures
            : item.section === 'source_composition'
              ? source_composition
              : item.section === 'eligibility'
                ? record.category === 'inclusion'
                  ? inclusion
                  : exclusion
                : null

    if (canIncludeInApproved(state.reviewer_status)) {
      if (item.section === 'study_metadata') {
        for (const field of item.fields) {
          study_metadata[field.field_key] = resolvedFieldValue(
            state,
            field.field_key,
            field.original_extracted_value,
          )
          study_metadata[`_original_${field.field_key}`] = field.original_extracted_value
        }
      } else if (Array.isArray(target)) {
        target.push(record)
      }
    } else if (item.section !== 'missing' && item.section !== 'conflicts' && item.section !== 'approval_summary') {
      rejected_items.push(record)
    }
  }

  const accepted = Object.values(ws.items).filter((i) => i.reviewer_status === 'accepted').length
  const edited = Object.values(ws.items).filter((i) => i.reviewer_status === 'edited').length
  const rejected = Object.values(ws.items).filter((i) => i.reviewer_status === 'rejected').length

  return {
    draft_version: '12D.1.0',
    draft_key: pkg.draft_key,
    approved_at: new Date().toISOString(),
    approved_by: reviewerId,
    manifest_reference: {
      package_path: pkg.package_path,
      study_key: pkg.manifest.study_key ?? pkg.manifest.protocol_id,
      draft_id: pkg.manifest.draft_id,
    },
    safety: REVIEW_SAFETY,
    approval_summary: {
      sections_approved: Object.entries(ws.sections)
        .filter(([, s]) => s.section_status === 'approved')
        .map(([k]) => k),
      accepted_count: accepted,
      edited_count: edited,
      rejected_count: rejected,
    },
    study_metadata,
    eligibility: { inclusion, exclusion },
    visits,
    procedures,
    source_composition,
    rejected_items,
    edit_history: ws.audit,
  }
}

export function writeApprovedArtifacts(
  pkg: IntakeReviewPackage,
  approved: ApprovedIntakeDraft,
  ws: ReviewWorkspaceState,
  cwd = process.cwd(),
): void {
  const dir = workspaceDir(cwd, pkg.draft_key)
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, 'approved_intake_draft.json'), `${JSON.stringify(approved, null, 2)}\n`, 'utf8')
  writeFileSync(join(dir, 'review_audit.json'), `${JSON.stringify(ws.audit, null, 2)}\n`, 'utf8')
}
