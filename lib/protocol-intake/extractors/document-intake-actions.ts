'use server'

import { revalidatePath } from 'next/cache'
import {
  getOrganizationMemberships,
  getPrimaryOrganizationId,
  getSessionUser,
} from '@/lib/auth/session'
import { canManageSourceBuilder } from '@/lib/rbac/permissions'
import { createServerClient } from '@/lib/supabase/server'
import { extractScheduleMatrix } from './schedule-matrix-normalizer'
import { extractTablesFromDocument } from './document-extraction-adapter'

export async function processDocumentIntakeUploadAction(formData: FormData) {
  const user = await getSessionUser()
  if (!user) return { ok: false, error: 'Unauthorized' }

  const organizationId = await getPrimaryOrganizationId(user.id)
  if (!organizationId) return { ok: false, error: 'No primary organization found' }

  const memberships = await getOrganizationMemberships(user.id)
  if (!canManageSourceBuilder(memberships, organizationId)) {
    return { ok: false, error: 'Forbidden' }
  }

  const file = formData.get('file') as File
  const studyId = formData.get('studyId') as string
  if (!file || !studyId) return { ok: false, error: 'File and studyId required' }

  const buffer = Buffer.from(await file.arrayBuffer())
  const supabase = await createServerClient()
  
  // Basic document vault insertion could go here. For MVP we skip robust vault integration
  // and focus on draft creation.
  const protocolDocumentId = crypto.randomUUID() 

  const rawResult = await extractTablesFromDocument(buffer, file.name)
  if (rawResult.error || !rawResult.tables || rawResult.tables.length === 0) {
    return { ok: false, error: rawResult.error || 'No tables found in document.' }
  }

  const result = await extractScheduleMatrix(rawResult, studyId, protocolDocumentId)
  
  if (!result.ok || !result.data) {
    return { ok: false, error: result.error || 'Failed to extract schedule' }
  }

  // Save the result as a draft in source_builder_drafts
  const { data: draftData, error: insertError } = await supabase
    .from('source_builder_drafts')
    .insert({
      organization_id: organizationId,
      draft_name: `Document Intake Extraction - ${file.name}`,
      status: 'draft',
      created_by: user.id,
      updated_by: user.id,
      draft_payload: {
        type: 'document_extraction_run',
        run_id: crypto.randomUUID(),
        study_id: studyId,
        document_name: file.name,
        raw_extraction_output: rawResult,
        schedule_matrix: result.data,
        coordinator_selected_procedures: [],
      }
    })
    .select('draft_id')
    .single()

  if (insertError) {
    return { ok: false, error: 'Failed to save draft: ' + insertError.message }
  }

  revalidatePath('/source-builder/intake')
  return { ok: true, draftId: draftData.draft_id }
}
