'use server'

import { revalidatePath } from 'next/cache'
import { createServerClient } from '@/lib/supabase/server'
import { getSessionUser, getPrimaryOrganizationId } from '@/lib/auth/session'
import type { RegulatoryDocumentEntry } from './regulatory-master-documents'

// ── Input types ──────────────────────────────────────────────────────────────

export type CreateDocumentInput = {
  ownerType: 'person' | 'organization' | 'facility'
  ownerPersonnelId?: string | null
  documentType: string
  documentTitle: string
  documentReference?: string | null
  documentCenterId?: string | null
  version?: string | null
  effectiveDate?: string | null
  expirationDate?: string | null
  notes?: string | null
}

export type UpdateDocumentInput = {
  id: string
  documentType?: string
  documentTitle?: string
  documentReference?: string | null
  documentCenterId?: string | null
  version?: string | null
  effectiveDate?: string | null
  expirationDate?: string | null
  status?: string
  notes?: string | null
  ownerType?: string
  ownerPersonnelId?: string | null
}

export type DocumentActionResult = {
  ok: boolean
  error?: string
  data?: RegulatoryDocumentEntry
}

// ── Create ────────────────────────────────────────────────────────────────────

export async function createRegulatoryDocument(
  input: CreateDocumentInput,
): Promise<DocumentActionResult> {
  try {
    const user = await getSessionUser()
    if (!user) return { ok: false, error: 'Not authenticated' }

    const orgId = await getPrimaryOrganizationId(user.id)
    if (!orgId) return { ok: false, error: 'No organization found' }

    const supabase = await createServerClient()

    const { data, error } = await supabase
      .from('regulatory_master_documents')
      .insert({
        organization_id: orgId,
        owner_type: input.ownerType,
        owner_personnel_id: input.ownerPersonnelId ?? null,
        document_type: input.documentType,
        document_title: input.documentTitle,
        document_reference: input.documentReference ?? null,
        document_center_id: input.documentCenterId ?? null,
        version: input.version ?? null,
        effective_date: input.effectiveDate ?? null,
        expiration_date: input.expirationDate ?? null,
        notes: input.notes ?? null,
        created_by: user.id,
      })
      .select()
      .single()

    if (error) return { ok: false, error: error.message }

    revalidatePath('/regulatory-center')
    return { ok: true, data: data as RegulatoryDocumentEntry }
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Failed to create document',
    }
  }
}

// ── Update ────────────────────────────────────────────────────────────────────

export async function updateRegulatoryDocument(
  input: UpdateDocumentInput,
): Promise<DocumentActionResult> {
  try {
    const supabase = await createServerClient()

    const updates: Record<string, unknown> = {}
    if (input.documentType !== undefined) updates.document_type = input.documentType
    if (input.documentTitle !== undefined) updates.document_title = input.documentTitle
    if (input.documentReference !== undefined) updates.document_reference = input.documentReference
    if (input.documentCenterId !== undefined) updates.document_center_id = input.documentCenterId
    if (input.version !== undefined) updates.version = input.version
    if (input.effectiveDate !== undefined) updates.effective_date = input.effectiveDate
    if (input.expirationDate !== undefined) updates.expiration_date = input.expirationDate
    if (input.status !== undefined) updates.status = input.status
    if (input.notes !== undefined) updates.notes = input.notes
    if (input.ownerType !== undefined) updates.owner_type = input.ownerType
    if (input.ownerPersonnelId !== undefined) updates.owner_personnel_id = input.ownerPersonnelId

    const { data, error } = await supabase
      .from('regulatory_master_documents')
      .update(updates)
      .eq('id', input.id)
      .select()
      .single()

    if (error) return { ok: false, error: error.message }

    revalidatePath('/regulatory-center')
    return { ok: true, data: data as RegulatoryDocumentEntry }
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Failed to update document',
    }
  }
}

// ── Deactivate / Reactivate ──────────────────────────────────────────────────

export async function deactivateRegulatoryDocument(id: string): Promise<DocumentActionResult> {
  return updateRegulatoryDocument({ id, status: 'inactive' })
}

export async function reactivateRegulatoryDocument(id: string): Promise<DocumentActionResult> {
  return updateRegulatoryDocument({ id, status: 'active' })
}
