import type { SupabaseClient } from '@supabase/supabase-js'
import { assertK1SingleStudyScope } from './document-intelligence-scope'
import { mapIntelligenceDocumentRow } from './document-intelligence-types'
import { mapActiveReferenceRow, type DocumentVersionSummary } from './document-version-types'
import type { DocumentIntelligenceDomain } from './document-domain-mapper'

export async function listDocumentFamilyVersions(
  supabase: SupabaseClient,
  organizationId: string,
  studyId: string,
  intelligenceDocumentId: string,
): Promise<{
  documentFamilyId: string
  versions: DocumentVersionSummary[]
  activeReferences: Array<{
    domain: DocumentIntelligenceDomain
    intelligenceDocumentId: string
  }>
}> {
  assertK1SingleStudyScope(studyId)

  const { data: doc, error: docError } = await supabase
    .from('document_intelligence_documents')
    .select('*')
    .eq('id', intelligenceDocumentId)
    .eq('organization_id', organizationId)
    .eq('study_id', studyId)
    .maybeSingle()

  if (docError) throw new Error(docError.message)
  if (!doc) throw new Error('Intelligence document not found.')

  const documentFamilyId = String(doc.document_family_id)

  const { data: versions, error: versionsError } = await supabase
    .from('document_intelligence_documents')
    .select('*')
    .eq('organization_id', organizationId)
    .eq('study_id', studyId)
    .eq('document_family_id', documentFamilyId)
    .order('version_number', { ascending: false })

  if (versionsError) throw new Error(versionsError.message)

  const versionIds = (versions ?? []).map((row) => String(row.id))
  const { data: domainRows } =
    versionIds.length > 0
      ? await supabase
          .from('document_intelligence_domains')
          .select('intelligence_document_id, domain')
          .in('intelligence_document_id', versionIds)
          .eq('status', 'active')
      : { data: [] }

  const domainsByDoc = new Map<string, DocumentIntelligenceDomain[]>()
  for (const row of domainRows ?? []) {
    const docId = String(row.intelligence_document_id)
    const list = domainsByDoc.get(docId) ?? []
    list.push(String(row.domain) as DocumentIntelligenceDomain)
    domainsByDoc.set(docId, list)
  }

  const { data: activeRows, error: activeError } = await supabase
    .from('document_intelligence_active_references')
    .select('*')
    .eq('organization_id', organizationId)
    .eq('study_id', studyId)
    .eq('document_family_id', documentFamilyId)

  if (activeError) throw new Error(activeError.message)

  const activeByDoc = new Map<string, DocumentIntelligenceDomain[]>()
  for (const row of activeRows ?? []) {
    const mapped = mapActiveReferenceRow(row as Record<string, unknown>)
    const list = activeByDoc.get(mapped.intelligenceDocumentId) ?? []
    list.push(mapped.domain)
    activeByDoc.set(mapped.intelligenceDocumentId, list)
  }

  const summaries: DocumentVersionSummary[] = (versions ?? []).map((row) => {
    const mapped = mapIntelligenceDocumentRow(row as Record<string, unknown>)
    return {
      intelligenceDocumentId: mapped.id,
      documentFamilyId,
      versionNumber: Number((row as Record<string, unknown>).version_number),
      versionLabel: mapped.versionLabel,
      sourceFilename: mapped.sourceFilename,
      sourceHash: mapped.sourceHash,
      intelligenceStatus: mapped.intelligenceStatus,
      effectiveFrom: (row as Record<string, unknown>).effective_from
        ? String((row as Record<string, unknown>).effective_from)
        : null,
      effectiveTo: (row as Record<string, unknown>).effective_to
        ? String((row as Record<string, unknown>).effective_to)
        : null,
      supersededByDocumentId: (row as Record<string, unknown>).superseded_by_document_id
        ? String((row as Record<string, unknown>).superseded_by_document_id)
        : null,
      supersededReason: (row as Record<string, unknown>).superseded_reason
        ? String((row as Record<string, unknown>).superseded_reason)
        : null,
      createdAt: mapped.createdAt,
      isActiveReferenceForDomains: activeByDoc.get(mapped.id) ?? [],
      availableDomains: domainsByDoc.get(mapped.id) ?? [],
    }
  })

  return {
    documentFamilyId,
    versions: summaries,
    activeReferences: (activeRows ?? []).map((row) => {
      const mapped = mapActiveReferenceRow(row as Record<string, unknown>)
      return {
        domain: mapped.domain,
        intelligenceDocumentId: mapped.intelligenceDocumentId,
      }
    }),
  }
}
