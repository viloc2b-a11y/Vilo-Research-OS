import type { SupabaseClient } from '@supabase/supabase-js'
import { assertK1SingleStudyScope } from '@/lib/document-intelligence/document-intelligence-scope'
import { isDocumentIntelligenceDomain } from '@/lib/document-intelligence/document-domain-mapper'
import type { DocumentIntelligenceDomain } from '@/lib/document-intelligence/document-domain-mapper'
import {
  mapSourceBlueprintEvidenceRow,
  type EvidenceKind,
  type EvidenceStatus,
  type SourceBlueprintEvidenceRow,
} from './source-blueprint-evidence-types'

export type ListSourceBlueprintEvidenceInput = {
  organizationId: string
  studyId: string
  evidenceStatus?: EvidenceStatus | null
  evidenceKind?: EvidenceKind | null
  usageDomain?: DocumentIntelligenceDomain | null
  intelligenceDocumentId?: string | null
  limit?: number
}

export async function listSourceBlueprintEvidence(
  supabase: SupabaseClient,
  input: ListSourceBlueprintEvidenceInput,
): Promise<SourceBlueprintEvidenceRow[]> {
  assertK1SingleStudyScope(input.studyId)

  let query = supabase
    .from('source_blueprint_evidence')
    .select('*')
    .eq('organization_id', input.organizationId)
    .eq('study_id', input.studyId)
    .order('created_at', { ascending: false })
    .limit(Math.min(input.limit ?? 100, 200))

  if (input.evidenceStatus) {
    query = query.eq('evidence_status', input.evidenceStatus)
  }
  if (input.evidenceKind) {
    query = query.eq('evidence_kind', input.evidenceKind)
  }
  if (input.intelligenceDocumentId) {
    query = query.eq('intelligence_document_id', input.intelligenceDocumentId)
  }
  if (input.usageDomain && isDocumentIntelligenceDomain(input.usageDomain)) {
    query = query.eq('usage_domain', input.usageDomain)
  }

  const { data, error } = await query
  if (error) throw new Error(error.message)

  return (data ?? []).map((row) => mapSourceBlueprintEvidenceRow(row as Record<string, unknown>))
}

export async function loadSourceBlueprintEvidenceById(
  supabase: SupabaseClient,
  organizationId: string,
  studyId: string,
  evidenceId: string,
): Promise<SourceBlueprintEvidenceRow | null> {
  assertK1SingleStudyScope(studyId)

  const { data, error } = await supabase
    .from('source_blueprint_evidence')
    .select('*')
    .eq('id', evidenceId)
    .eq('organization_id', organizationId)
    .eq('study_id', studyId)
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (!data) return null
  return mapSourceBlueprintEvidenceRow(data as Record<string, unknown>)
}
