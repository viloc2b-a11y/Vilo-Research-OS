'use server'

import {
  getOrganizationMemberships,
  getPrimaryOrganizationId,
  getSessionUser,
} from '@/lib/auth/session'
import { canManageSourceBuilder } from '@/lib/rbac/permissions'

// Quarantine notice:
// `source_builder_drafts` is the manual source-builder workspace (organization_id scoped only,
// no study_id, outside the reconciliation/audit chain). Protocol/runtime extraction must NOT be
// persisted there. The canonical runtime truth chain is:
//   compliance_runtime_documents
//     -> protocol_runtime_versions / protocol_runtime_*_candidates  (organization_id + study_id)
//     -> protocol_*_reconciliations
//     -> protocol_runtime_generation_runs
//     -> study_runtime_* / runtime_source_*
// Until extraction is wired into that canonical pipeline, this action refuses to persist and does
// not write extracted runtime data to source_builder_drafts.
const QUARANTINE_MESSAGE =
  'Document intake extraction is quarantined: it no longer writes to source_builder_drafts. ' +
  'Route protocol extraction through the canonical protocol intake runtime pipeline ' +
  '(protocol_runtime_versions -> candidates -> reconciliation -> runtime generation), ' +
  'scoped by organization_id + study_id.'

export type ProcessDocumentIntakeUploadResult = {
  ok: boolean
  error?: string
  quarantined: true
  draftId?: undefined
}

export async function processDocumentIntakeUploadAction(
  formData: FormData
): Promise<ProcessDocumentIntakeUploadResult> {
  const user = await getSessionUser()
  if (!user) return { ok: false, error: 'Unauthorized', quarantined: true }

  const organizationId = await getPrimaryOrganizationId(user.id)
  if (!organizationId) {
    return { ok: false, error: 'No primary organization found', quarantined: true }
  }

  const memberships = await getOrganizationMemberships(user.id)
  if (!canManageSourceBuilder(memberships, organizationId)) {
    return { ok: false, error: 'Forbidden', quarantined: true }
  }

  const file = formData.get('file') as File
  const studyId = formData.get('studyId') as string
  if (!file || !studyId) {
    return { ok: false, error: 'File and studyId required', quarantined: true }
  }

  // Non-canonical sink quarantined: do not extract-and-persist into source_builder_drafts.
  return { ok: false, error: QUARANTINE_MESSAGE, quarantined: true }
}
