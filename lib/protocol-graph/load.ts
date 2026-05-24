import type { ProtocolGraphDocument, ProtocolGraphPublicationRow } from '@/lib/protocol-graph/types'
import type { SupabaseClient } from '@supabase/supabase-js'

export async function loadActiveProtocolGraph(
  supabase: SupabaseClient,
  input: { organizationId: string; studyId: string },
): Promise<ProtocolGraphPublicationRow | null> {
  const { data: study } = await supabase
    .from('studies')
    .select('active_protocol_graph_publication_id')
    .eq('id', input.studyId)
    .eq('organization_id', input.organizationId)
    .maybeSingle()

  const activeId = study?.active_protocol_graph_publication_id as string | null
  if (activeId) {
    const pub = await loadPublicationById(supabase, activeId, input.organizationId)
    if (pub?.status === 'published') return pub
  }

  const { data: latest } = await supabase
    .from('protocol_graph_publications')
    .select('*')
    .eq('study_id', input.studyId)
    .eq('organization_id', input.organizationId)
    .eq('status', 'published')
    .order('graph_revision', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!latest) return null
  return rowToPublication(latest)
}

export async function loadPublicationById(
  supabase: SupabaseClient,
  publicationId: string,
  organizationId: string,
): Promise<ProtocolGraphPublicationRow | null> {
  const { data, error } = await supabase
    .from('protocol_graph_publications')
    .select('*')
    .eq('id', publicationId)
    .eq('organization_id', organizationId)
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (!data) return null
  return rowToPublication(data)
}

export async function loadProtocolGraphDocument(
  supabase: SupabaseClient,
  input: { organizationId: string; studyId: string },
): Promise<ProtocolGraphDocument | null> {
  const pub = await loadActiveProtocolGraph(supabase, input)
  return pub?.graph_document ?? null
}

function rowToPublication(row: Record<string, unknown>): ProtocolGraphPublicationRow {
  return {
    id: row.id as string,
    organization_id: row.organization_id as string,
    study_id: row.study_id as string,
    study_version_id: (row.study_version_id as string | null) ?? null,
    graph_revision: row.graph_revision as number,
    status: row.status as string,
    graph_schema_version: row.graph_schema_version as number,
    graph_document: row.graph_document as ProtocolGraphDocument,
    source_checksum: (row.source_checksum as string | null) ?? null,
    supersedes_publication_id: (row.supersedes_publication_id as string | null) ?? null,
    amendment_summary: (row.amendment_summary as Record<string, unknown>) ?? {},
    published_at: (row.published_at as string | null) ?? null,
  }
}
