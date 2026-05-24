import type { AmendmentOperationalImpact } from '@/lib/financial-runtime/types'
import type { SupabaseClient } from '@supabase/supabase-js'

export async function computeAmendmentOperationalImpact(input: {
  supabase: SupabaseClient
  studyId: string
}): Promise<AmendmentOperationalImpact> {
  const { data: study } = await input.supabase
    .from('studies')
    .select('active_protocol_graph_publication_id')
    .eq('id', input.studyId)
    .maybeSingle()

  const pubId = study?.active_protocol_graph_publication_id as string | null
  if (!pubId) {
    return {
      activeGraphPublicationId: null,
      graphRevision: null,
      amendmentDeltaSummary: null,
      nodeCountDelta: null,
      edgeCountDelta: null,
      operationalImpactScore: 0,
    }
  }

  const { data: pub } = await input.supabase
    .from('protocol_graph_publications')
    .select('id, graph_revision, amendment_summary, graph_document, supersedes_publication_id')
    .eq('id', pubId)
    .maybeSingle()

  if (!pub) {
    return {
      activeGraphPublicationId: pubId,
      graphRevision: null,
      amendmentDeltaSummary: null,
      nodeCountDelta: null,
      edgeCountDelta: null,
      operationalImpactScore: 0,
    }
  }

  const summary = (pub.amendment_summary as Record<string, unknown>) ?? {}
  const nodeDelta = typeof summary.node_count_delta === 'number' ? summary.node_count_delta : null
  const edgeDelta = typeof summary.edge_count_delta === 'number' ? summary.edge_count_delta : null
  const doc = pub.graph_document as { nodes?: unknown[]; edges?: unknown[] } | null

  const operationalImpactScore = Math.min(
    100,
    Math.abs(nodeDelta ?? 0) * 2 + Math.abs(edgeDelta ?? 0) * 3 + (pub.supersedes_publication_id ? 10 : 0),
  )

  return {
    activeGraphPublicationId: pub.id as string,
    graphRevision: pub.graph_revision as number,
    amendmentDeltaSummary:
      (pub.graph_document as { amendment?: { deltaSummary?: string } })?.amendment?.deltaSummary
      ?? (typeof summary.prior_revision === 'number'
        ? `Amendment from revision ${summary.prior_revision}`
        : null),
    nodeCountDelta: nodeDelta ?? (doc?.nodes ? doc.nodes.length : null),
    edgeCountDelta: edgeDelta ?? (doc?.edges ? doc.edges.length : null),
    operationalImpactScore,
  }
}
