import { randomUUID } from 'node:crypto'
import type { SupabaseClient } from '@supabase/supabase-js'

export type ResolvedDocumentFamily = {
  documentFamilyId: string
  versionNumber: number
  priorLatestDocumentId: string | null
}

/**
 * Resolves version family for a new intelligence document ingest.
 * Same compliance document + study shares one document_family_id.
 */
export async function resolveDocumentFamilyForIngest(
  supabase: SupabaseClient,
  organizationId: string,
  studyId: string,
  complianceDocumentId: string,
): Promise<ResolvedDocumentFamily> {
  const { data: siblings, error } = await supabase
    .from('document_intelligence_documents')
    .select('id, document_family_id, version_number')
    .eq('organization_id', organizationId)
    .eq('study_id', studyId)
    .eq('compliance_document_id', complianceDocumentId)
    .order('version_number', { ascending: false })
    .limit(1)

  if (error) throw new Error(error.message)

  if (siblings?.length) {
    const prior = siblings[0] as Record<string, unknown>
    return {
      documentFamilyId: String(prior.document_family_id),
      versionNumber: Number(prior.version_number) + 1,
      priorLatestDocumentId: String(prior.id),
    }
  }

  return {
    documentFamilyId: randomUUID(),
    versionNumber: 1,
    priorLatestDocumentId: null,
  }
}
