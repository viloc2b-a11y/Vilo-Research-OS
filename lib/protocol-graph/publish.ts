import { compileProtocolGraphFromStudy } from '@/lib/protocol-graph/compile/from-study-definitions'
import { loadPublicationById } from '@/lib/protocol-graph/load'
import { ClinicalMutationGateway } from '@/lib/operations/clinical-mutation-gateway'
import { OPERATIONAL_EVENT_TYPES } from '@/lib/operations/event-types'
import type { ProtocolGraphDocument } from '@/lib/protocol-graph/types'
import { sanitizeProtocolRuntimeObject } from '@/lib/sanitization/protocol-sanitizer'
import type { SupabaseClient } from '@supabase/supabase-js'

export type PublishProtocolGraphResult =
  | {
      ok: true
      publicationId: string
      graphRevision: number
      graphDocument: ProtocolGraphDocument
      supersededPublicationId: string | null
    }
  | { ok: false; error: string }

export async function publishProtocolGraph(input: {
  supabase: SupabaseClient
  organizationId: string
  studyId: string
  studyVersionId?: string | null
  actorUserId: string
  supersedesPublicationId?: string | null
}): Promise<PublishProtocolGraphResult> {
  const compiledGraphDocument = await compileProtocolGraphFromStudy({
    supabase: input.supabase,
    organizationId: input.organizationId,
    studyId: input.studyId,
    studyVersionId: input.studyVersionId,
  })
  const graphDocument = sanitizeProtocolRuntimeObject(compiledGraphDocument)

  let supersedesPublicationId = input.supersedesPublicationId ?? null
  let priorRevision = 0
  let amendmentSummary: Record<string, unknown> = {}

  if (supersedesPublicationId) {
    const prior = await loadPublicationById(
      input.supabase,
      supersedesPublicationId,
      input.organizationId,
    )
    if (prior) {
      priorRevision = prior.graph_revision
      graphDocument.amendment = {
        supersedesPublicationId,
        supersedesGraphRevision: priorRevision,
        deltaSummary: `Revision ${priorRevision + 1} compiled from study definitions.`,
      }
      amendmentSummary = {
        prior_revision: priorRevision,
        node_count_delta: graphDocument.nodes.length - prior.graph_document.nodes.length,
        edge_count_delta: graphDocument.edges.length - prior.graph_document.edges.length,
      }
      await input.supabase
        .from('protocol_graph_publications')
        .update({ status: 'superseded' })
        .eq('id', supersedesPublicationId)
        .eq('study_id', input.studyId)
    }
  } else {
    const { data: latest } = await input.supabase
      .from('protocol_graph_publications')
      .select('id, graph_revision, status')
      .eq('study_id', input.studyId)
      .order('graph_revision', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (latest?.status === 'published') {
      supersedesPublicationId = latest.id as string
      priorRevision = latest.graph_revision as number
      graphDocument.amendment = {
        supersedesPublicationId,
        supersedesGraphRevision: priorRevision,
        deltaSummary: `Amendment revision ${priorRevision + 1}.`,
      }
      await input.supabase
        .from('protocol_graph_publications')
        .update({ status: 'superseded' })
        .eq('id', supersedesPublicationId)
    } else if (latest) {
      priorRevision = latest.graph_revision as number
    }
  }

  const graphRevision = priorRevision + 1
  const publishedAt = new Date().toISOString()

  const { data: inserted, error: insertError } = await input.supabase
    .from('protocol_graph_publications')
    .insert({
      organization_id: input.organizationId,
      study_id: input.studyId,
      study_version_id: graphDocument.studyVersionId,
      graph_revision: graphRevision,
      status: 'published',
      graph_schema_version: graphDocument.schemaVersion,
      graph_document: graphDocument,
      source_checksum: graphDocument.sourceChecksum,
      supersedes_publication_id: supersedesPublicationId,
      amendment_summary: amendmentSummary,
      published_at: publishedAt,
      published_by: input.actorUserId,
    })
    .select('id')
    .single()

  if (insertError || !inserted) {
    return { ok: false, error: insertError?.message ?? 'Failed to insert protocol graph publication.' }
  }

  const publicationId = inserted.id as string

  const nodeRows = graphDocument.nodes.map((n) => ({
    publication_id: publicationId,
    organization_id: input.organizationId,
    study_id: input.studyId,
    node_key: n.nodeKey,
    node_type: n.nodeType,
    entity_ref_type: n.entityRefType ?? null,
    entity_ref_id: n.entityRefId ?? null,
    properties: n.properties,
  }))

  const edgeRows = graphDocument.edges.map((e) => ({
    publication_id: publicationId,
    organization_id: input.organizationId,
    study_id: input.studyId,
    edge_key: e.edgeKey,
    edge_type: e.edgeType,
    from_node_key: e.fromNodeKey,
    to_node_key: e.toNodeKey,
    condition: e.condition,
    properties: e.properties,
    sort_order: e.sortOrder ?? 0,
  }))

  if (nodeRows.length > 0) {
    const { error: nodeError } = await input.supabase.from('protocol_graph_nodes').insert(nodeRows)
    if (nodeError) return { ok: false, error: nodeError.message }
  }

  if (edgeRows.length > 0) {
    const { error: edgeError } = await input.supabase.from('protocol_graph_edges').insert(edgeRows)
    if (edgeError) return { ok: false, error: edgeError.message }
  }

  await input.supabase
    .from('studies')
    .update({ active_protocol_graph_publication_id: publicationId })
    .eq('id', input.studyId)
    .eq('organization_id', input.organizationId)

  await ClinicalMutationGateway.emitStudy({
    supabase: input.supabase,
    organizationId: input.organizationId,
    studyId: input.studyId,
    actorUserId: input.actorUserId,
    eventType: OPERATIONAL_EVENT_TYPES.PROTOCOL_GRAPH_PUBLISHED,
    payloadSource: 'protocol-graph',
    mutation: 'protocol_graph.publish',
    details: {
      publication_id: publicationId,
      graph_revision: graphRevision,
      study_version_id: graphDocument.studyVersionId,
      source_checksum: graphDocument.sourceChecksum,
      node_count: graphDocument.nodes.length,
      edge_count: graphDocument.edges.length,
      rule_count: graphDocument.runtimeRules.length,
      supersedes_publication_id: supersedesPublicationId,
    },
  })

  return {
    ok: true,
    publicationId,
    graphRevision,
    graphDocument,
    supersededPublicationId: supersedesPublicationId,
  }
}
