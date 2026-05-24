import type { SupabaseClient } from '@supabase/supabase-js'
import type { ProtocolGraphDocument } from '@/lib/protocol-graph/types'
import type { GraphVisitBlocker } from '@/lib/protocol-graph/types'

const TERMINAL = new Set(['completed', 'locked', 'cancelled', 'no_show', 'missed'])

/**
 * Visit sequencing: prior visit must be terminal before dependent visit proceeds.
 */
export async function evaluateVisitSequencingBlockers(input: {
  supabase: SupabaseClient
  graph: ProtocolGraphDocument
  studySubjectId: string
  organizationId: string
  visitDefinitionId: string
  visitCode: string | null
}): Promise<GraphVisitBlocker[]> {
  const blockers: GraphVisitBlocker[] = []
  const visitKey = `visit:${input.visitDefinitionId}`
  const deps = input.graph.edges.filter(
    (e) => e.edgeType === 'visit_depends_on_visit' && e.toNodeKey === `visit-code:${input.visitCode}`,
  )

  if (deps.length === 0) {
    const seqDeps = input.graph.edges.filter(
      (e) => e.edgeType === 'visit_depends_on_visit' && e.toNodeKey === visitKey,
    )
    for (const edge of seqDeps) {
      const priorVisitDefId = edge.fromNodeKey.replace(/^visit:/, '')
      const priorIncomplete = await isVisitDefinitionIncompleteForSubject(
        input.supabase,
        input.studySubjectId,
        input.organizationId,
        priorVisitDefId,
      )
      if (priorIncomplete) {
        blockers.push({
          id: `graph-seq:${edge.edgeKey}`,
          category: 'protocol_graph',
          severity: 'blocker',
          label: 'Prior visit incomplete',
          detail: 'Complete the prior protocol visit before proceeding.',
        })
      }
    }
    return blockers
  }

  for (const edge of deps) {
    const priorCode = edge.fromNodeKey.replace(/^visit-code:/, '')
    const priorIncomplete = await isVisitCodeIncompleteForSubject(
      input.supabase,
      input.studySubjectId,
      input.organizationId,
      priorCode,
    )
    if (priorIncomplete) {
      blockers.push({
        id: `graph-seq:${edge.edgeKey}`,
        category: 'protocol_graph',
        severity: 'blocker',
        label: `Prior visit ${priorCode} incomplete`,
        detail: `Visit ${input.visitCode} requires ${priorCode} to be complete.`,
      })
    }
  }

  return blockers
}

async function isVisitDefinitionIncompleteForSubject(
  supabase: SupabaseClient,
  studySubjectId: string,
  organizationId: string,
  visitDefinitionId: string,
): Promise<boolean> {
  const { data } = await supabase
    .from('visits')
    .select('visit_status')
    .eq('study_subject_id', studySubjectId)
    .eq('organization_id', organizationId)
    .eq('visit_definition_id', visitDefinitionId)
    .order('scheduled_date', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!data) return false
  return !TERMINAL.has((data.visit_status as string) ?? '')
}

async function isVisitCodeIncompleteForSubject(
  supabase: SupabaseClient,
  studySubjectId: string,
  organizationId: string,
  visitCode: string,
): Promise<boolean> {
  const { data: def } = await supabase
    .from('visit_definitions')
    .select('id')
    .eq('code', visitCode)
    .limit(1)
    .maybeSingle()
  if (!def) return false
  return isVisitDefinitionIncompleteForSubject(
    supabase,
    studySubjectId,
    organizationId,
    def.id as string,
  )
}
