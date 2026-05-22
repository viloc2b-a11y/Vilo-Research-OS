import { existsSync, readFileSync } from 'node:fs'
import type { ApprovedIntakeDraft } from '@/lib/protocol-intake-review/approve'
import { approvedDraftPath, reviewAuditPath } from '@/lib/protocol-intake-publish-prep/paths'

export type LoadedApprovedHandoff = {
  approved: ApprovedIntakeDraft
  approved_path: string
  audit_path: string
  audit_exists: boolean
  audit_entry_count: number
}

export function loadApprovedIntakeDraft(
  draftKey: string,
  cwd = process.cwd(),
): LoadedApprovedHandoff | null {
  const path = approvedDraftPath(draftKey, cwd)
  if (!existsSync(path)) return null
  const approved = JSON.parse(readFileSync(path, 'utf8')) as ApprovedIntakeDraft
  const auditPath = reviewAuditPath(draftKey, cwd)
  const auditExists = existsSync(auditPath)
  let auditEntryCount = 0
  if (auditExists) {
    try {
      const audit = JSON.parse(readFileSync(auditPath, 'utf8')) as unknown[]
      auditEntryCount = Array.isArray(audit) ? audit.length : 0
    } catch {
      auditEntryCount = 0
    }
  }
  return {
    approved,
    approved_path: path,
    audit_path: auditPath,
    audit_exists: auditExists,
    audit_entry_count: auditEntryCount,
  }
}

export function hasApprovedIntakeDraft(draftKey: string, cwd = process.cwd()): boolean {
  return existsSync(approvedDraftPath(draftKey, cwd))
}
