import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  AmendmentDiff,
  AmendmentProcedureChange,
  AmendmentVisitChange,
  AmendmentVisitModification,
} from '@/lib/financial-runtime/types'
import type { ProtocolGraphDocument, ProtocolGraphNode } from '@/lib/protocol-graph/types'

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function visitNodes(doc: ProtocolGraphDocument): ProtocolGraphNode[] {
  return doc.nodes.filter((n) => n.nodeType === 'visit_definition')
}

function procedureNodes(doc: ProtocolGraphDocument): ProtocolGraphNode[] {
  return doc.nodes.filter((n) => n.nodeType === 'procedure_definition')
}

function visitCodeFromNode(node: ProtocolGraphNode): string {
  return (
    (node.properties?.visitCode as string | undefined) ??
    (node.properties?.code as string | undefined) ??
    node.nodeKey
  )
}

function visitNameFromNode(node: ProtocolGraphNode): string {
  return (
    (node.properties?.visitName as string | undefined) ??
    (node.properties?.label as string | undefined) ??
    visitCodeFromNode(node)
  )
}

function procedureCodeFromNode(node: ProtocolGraphNode): string {
  return (
    (node.properties?.procedureCode as string | undefined) ??
    (node.properties?.code as string | undefined) ??
    node.nodeKey
  )
}

function procedureNameFromNode(node: ProtocolGraphNode): string {
  return (
    (node.properties?.procedureName as string | undefined) ??
    (node.properties?.label as string | undefined) ??
    procedureCodeFromNode(node)
  )
}

/**
 * Find which visit a procedure belongs to by looking for a
 * `visit_requires_procedure` edge pointing to this node.
 */
function visitCodeForProcedure(
  procedureNodeKey: string,
  doc: ProtocolGraphDocument,
): string {
  const edge = doc.edges.find(
    (e) =>
      e.edgeType === 'visit_requires_procedure' && e.toNodeKey === procedureNodeKey,
  )
  if (!edge) return 'unknown'
  const visitNode = doc.nodes.find((n) => n.nodeKey === edge.fromNodeKey)
  return visitNode ? visitCodeFromNode(visitNode) : edge.fromNodeKey
}

// ---------------------------------------------------------------------------
// Diff logic
// ---------------------------------------------------------------------------

function diffDocuments(
  previousDoc: ProtocolGraphDocument,
  newDoc: ProtocolGraphDocument,
): {
  addedVisits: AmendmentVisitChange[]
  removedVisits: AmendmentVisitChange[]
  modifiedVisits: AmendmentVisitModification[]
  addedProcedures: AmendmentProcedureChange[]
  removedProcedures: AmendmentProcedureChange[]
} {
  // --- Visits ---
  const prevVisitsByKey = new Map(previousDoc.nodes.filter(n => n.nodeType === 'visit_definition').map((n) => [n.nodeKey, n]))
  const newVisitsByKey = new Map(newDoc.nodes.filter(n => n.nodeType === 'visit_definition').map((n) => [n.nodeKey, n]))

  const addedVisits: AmendmentVisitChange[] = []
  const removedVisits: AmendmentVisitChange[] = []
  const modifiedVisits: AmendmentVisitModification[] = []

  for (const [key, node] of newVisitsByKey) {
    if (!prevVisitsByKey.has(key)) {
      addedVisits.push({ visitCode: visitCodeFromNode(node), visitName: visitNameFromNode(node) })
    } else {
      // Check for property changes (shallow compare on relevant fields)
      const prev = prevVisitsByKey.get(key)!
      const changes: string[] = []
      const checkFields = ['visitName', 'label', 'studyDay', 'windowBeforeDays', 'windowAfterDays', 'visitType']
      for (const field of checkFields) {
        if (JSON.stringify(prev.properties?.[field]) !== JSON.stringify(node.properties?.[field])) {
          changes.push(`${field} changed`)
        }
      }
      if (changes.length > 0) {
        modifiedVisits.push({ visitCode: visitCodeFromNode(node), changes })
      }
    }
  }
  for (const [key, node] of prevVisitsByKey) {
    if (!newVisitsByKey.has(key)) {
      removedVisits.push({ visitCode: visitCodeFromNode(node), visitName: visitNameFromNode(node) })
    }
  }

  // --- Procedures ---
  const prevProcsByKey = new Map(previousDoc.nodes.filter(n => n.nodeType === 'procedure_definition').map((n) => [n.nodeKey, n]))
  const newProcsByKey = new Map(newDoc.nodes.filter(n => n.nodeType === 'procedure_definition').map((n) => [n.nodeKey, n]))

  const addedProcedures: AmendmentProcedureChange[] = []
  const removedProcedures: AmendmentProcedureChange[] = []

  for (const [key, node] of newProcsByKey) {
    if (!prevProcsByKey.has(key)) {
      addedProcedures.push({
        procedureCode: procedureCodeFromNode(node),
        procedureName: procedureNameFromNode(node),
        visitCode: visitCodeForProcedure(key, newDoc),
      })
    }
  }
  for (const [key, node] of prevProcsByKey) {
    if (!newProcsByKey.has(key)) {
      removedProcedures.push({
        procedureCode: procedureCodeFromNode(node),
        procedureName: procedureNameFromNode(node),
        visitCode: visitCodeForProcedure(key, previousDoc),
      })
    }
  }

  return { addedVisits, removedVisits, modifiedVisits, addedProcedures, removedProcedures }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Compute visit/procedure diffs for all amendment links on a study.
 *
 * Strategy:
 * 1. Load all `protocol_graph_publications` for the study (any status).
 * 2. For publications that supersede another (`supersedes_publication_id` set),
 *    produce a diff between the two graph_document payloads.
 * 3. Return one AmendmentDiff per superseding publication, sorted newest first.
 *
 * Falls back to delta counts from `amendment_summary` when a previous
 * publication is missing (e.g. superseded pub was deleted).
 */
export async function computeAmendmentDiff(input: {
  supabase: SupabaseClient
  studyId: string
}): Promise<AmendmentDiff[]> {
  const { data: pubs } = await input.supabase
    .from('protocol_graph_publications')
    .select(
      'id, graph_revision, status, graph_document, amendment_summary, supersedes_publication_id, published_at',
    )
    .eq('study_id', input.studyId)
    .order('graph_revision', { ascending: false })

  if (!pubs || pubs.length === 0) return []

  // Build lookup by id
  const pubById = new Map(
    pubs.map((p) => [p.id as string, p]),
  )

  const results: AmendmentDiff[] = []

  for (const pub of pubs) {
    const prevId = pub.supersedes_publication_id as string | null
    if (!prevId) continue // no predecessor → not an amendment publication

    const prevPub = pubById.get(prevId)
    const currentDoc = pub.graph_document as ProtocolGraphDocument | null
    const prevDoc = prevPub ? (prevPub.graph_document as ProtocolGraphDocument | null) : null

    // Compute impact score
    const summary = (pub.amendment_summary as Record<string, unknown>) ?? {}
    const nodeDelta = typeof summary.node_count_delta === 'number' ? summary.node_count_delta : null
    const edgeDelta = typeof summary.edge_count_delta === 'number' ? summary.edge_count_delta : null
    const operationalImpactScore = Math.min(
      100,
      Math.abs(nodeDelta ?? 0) * 2 + Math.abs(edgeDelta ?? 0) * 3 + 10,
    )

    let diffResult: ReturnType<typeof diffDocuments> | null = null

    if (currentDoc?.nodes && prevDoc?.nodes) {
      diffResult = diffDocuments(prevDoc, currentDoc)
    }

    const addedProcedures = diffResult?.addedProcedures ?? []
    const requiresTrainingReview =
      addedProcedures.length > 0 || operationalImpactScore > 50

    results.push({
      versionId: pub.id as string,
      previousVersionId: prevId,
      graphRevision: pub.graph_revision as number | null,
      previousGraphRevision: prevPub ? (prevPub.graph_revision as number | null) : null,
      publishedAt: pub.published_at as string | null,
      amendmentType: typeof summary.amendment_type === 'string' ? summary.amendment_type : null,
      operationalImpactScore,
      addedVisits: diffResult?.addedVisits ?? [],
      removedVisits: diffResult?.removedVisits ?? [],
      modifiedVisits: diffResult?.modifiedVisits ?? [],
      addedProcedures,
      removedProcedures: diffResult?.removedProcedures ?? [],
      requiresTrainingReview,
    })
  }

  return results
}

export type { AmendmentDiff }
