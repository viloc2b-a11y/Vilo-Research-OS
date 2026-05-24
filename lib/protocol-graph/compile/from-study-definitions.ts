import {
  branchNodeKey,
  EDGE_TYPES,
  NODE_TYPES,
  procedureNodeKey,
  visitNodeKey,
} from '@/lib/protocol-graph/constants'
import { computeGraphSourceChecksum } from '@/lib/protocol-graph/compile/checksum'
import { resolveBuiltinRules } from '@/lib/protocol-graph/rules/builtin-catalog'
import type {
  ProtocolGraphDocument,
  ProtocolGraphEdge,
  ProtocolGraphNode,
  ProtocolRuntimeRule,
  StudyGraphRuleExtensions,
} from '@/lib/protocol-graph/types'
import { PROTOCOL_GRAPH_SCHEMA_VERSION } from '@/lib/protocol-graph/types'
import type { SupabaseClient } from '@supabase/supabase-js'

type VisitDefRow = {
  id: string
  code: string
  label: string
  sort_order: number
  target_day: number | null
  window_min_offset: number | null
  window_max_offset: number | null
  eligible_arms: string[] | null
  eligible_subject_roles: string[] | null
  modality: string | null
  study_version_id: string | null
}

type ProcedureDefRow = {
  id: string
  code: string
  label: string
  is_required_default: boolean
  billable_default: boolean
}

type MapRow = {
  id: string
  visit_definition_id: string
  procedure_definition_id: string
  sort_order: number
  is_required: boolean
  is_conditional: boolean
  condition_label: string | null
}

function parseGraphExtensions(metadata: unknown): StudyGraphRuleExtensions {
  if (!metadata || typeof metadata !== 'object') return {}
  const root = metadata as Record<string, unknown>
  const pg = root.protocol_graph
  if (!pg || typeof pg !== 'object') return {}
  return pg as StudyGraphRuleExtensions
}

function compileMetadataRules(
  extensions: StudyGraphRuleExtensions,
  codeByProcedureId: Map<string, string>,
  codeByVisitId: Map<string, string>,
): { rules: ProtocolRuntimeRule[]; edges: ProtocolGraphEdge[] } {
  const rules: ProtocolRuntimeRule[] = []
  const edges: ProtocolGraphEdge[] = []

  for (const dep of extensions.procedureDependencies ?? []) {
    const ruleId = `dep:${dep.visitCode}:${dep.procedureCode}:${dep.dependsOnProcedureCode}`
    rules.push({
      id: ruleId,
      kind: 'procedure_dependency',
      scope: 'visit',
      source: 'study_metadata',
      when: {
        op: 'procedure_incomplete',
        procedureCode: dep.dependsOnProcedureCode,
        visitCode: dep.visitCode,
      },
      then: [
        {
          type: 'add_visit_blocker',
          label: `Depends on ${dep.dependsOnProcedureCode}`,
          detail: `${dep.procedureCode} requires ${dep.dependsOnProcedureCode} complete.`,
          severity: dep.required === false ? 'warning' : 'blocker',
          procedureCode: dep.procedureCode,
        },
      ],
    })
    edges.push({
      edgeKey: ruleId,
      edgeType: EDGE_TYPES.PROCEDURE_DEPENDS,
      fromNodeKey: `proc-code:${dep.dependsOnProcedureCode}`,
      toNodeKey: `proc-code:${dep.procedureCode}`,
      condition: { visitCode: dep.visitCode },
      properties: { required: dep.required !== false },
    })
  }

  for (const vd of extensions.visitDependencies ?? []) {
    const edgeKey = `visit-dep:${vd.visitCode}:${vd.dependsOnVisitCode}`
    edges.push({
      edgeKey,
      edgeType: EDGE_TYPES.VISIT_DEPENDS,
      fromNodeKey: `visit-code:${vd.dependsOnVisitCode}`,
      toNodeKey: `visit-code:${vd.visitCode}`,
      condition: {},
      properties: {},
    })
    rules.push({
      id: edgeKey,
      kind: 'visit_blocker',
      scope: 'visit',
      source: 'study_metadata',
      when: {
        op: 'prior_visit_incomplete',
        visitCode: vd.dependsOnVisitCode,
        params: { targetVisitCode: vd.visitCode },
      },
      then: [
        {
          type: 'add_visit_blocker',
          label: `Prior visit ${vd.dependsOnVisitCode} incomplete`,
          detail: `Visit ${vd.visitCode} depends on completion of ${vd.dependsOnVisitCode}.`,
          severity: 'blocker',
          visitCode: vd.visitCode,
        },
      ],
    })
  }

  for (const branch of extensions.branches ?? []) {
    const bKey = branchNodeKey(branch.branchKey)
    edges.push({
      edgeKey: `branch:${branch.branchKey}`,
      edgeType: EDGE_TYPES.BRANCH_VISIT,
      fromNodeKey: bKey,
      toNodeKey: `branch-target:${branch.branchKey}`,
      condition: { arm: branch.arm ?? null },
      properties: {
        activatesVisitCodes: branch.activatesVisitCodes ?? [],
        activatesProcedureCodes: branch.activatesProcedureCodes ?? [],
      },
    })
    for (const visitCode of branch.activatesVisitCodes ?? []) {
      const visitId = [...codeByVisitId.entries()].find(([, c]) => c === visitCode)?.[0]
      if (visitId) {
        edges.push({
          edgeKey: `branch-visit:${branch.branchKey}:${visitCode}`,
          edgeType: EDGE_TYPES.BRANCH_VISIT,
          fromNodeKey: bKey,
          toNodeKey: visitNodeKey(visitId),
          condition: { arm: branch.arm ?? null },
          properties: {},
        })
      }
    }
  }

  void codeByProcedureId
  return { rules, edges }
}

export async function compileProtocolGraphFromStudy(input: {
  supabase: SupabaseClient
  organizationId: string
  studyId: string
  studyVersionId?: string | null
}): Promise<ProtocolGraphDocument> {
  const { supabase, organizationId, studyId } = input

  let studyVersionId = input.studyVersionId ?? null
  let studyVersionLabel: string | null = null
  let versionMetadata: Record<string, unknown> = {}

  if (studyVersionId) {
    const { data: sv } = await supabase
      .from('study_versions')
      .select('id, version_label, metadata')
      .eq('id', studyVersionId)
      .eq('study_id', studyId)
      .maybeSingle()
    if (sv) {
      studyVersionLabel = (sv.version_label as string) ?? null
      versionMetadata = (sv.metadata as Record<string, unknown>) ?? {}
    }
  } else {
    const { data: latest } = await supabase
      .from('study_versions')
      .select('id, version_label, metadata')
      .eq('study_id', studyId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (latest) {
      studyVersionId = latest.id as string
      studyVersionLabel = (latest.version_label as string) ?? null
      versionMetadata = (latest.metadata as Record<string, unknown>) ?? {}
    }
  }

  const extensions = parseGraphExtensions(versionMetadata)
  const ruleKeys = extensions.ruleKeys ?? []

  const [visitsResult, proceduresResult, mapsResult] = await Promise.all([
    supabase
      .from('visit_definitions')
      .select(
        'id, code, label, sort_order, target_day, window_min_offset, window_max_offset, eligible_arms, eligible_subject_roles, modality, study_version_id',
      )
      .eq('study_id', studyId)
      .eq('organization_id', organizationId)
      .order('sort_order', { ascending: true }),
    supabase
      .from('procedure_definitions')
      .select('id, code, label, is_required_default, billable_default')
      .eq('study_id', studyId)
      .eq('organization_id', organizationId)
      .order('code', { ascending: true }),
    supabase
      .from('visit_def_procedure_map')
      .select(
        'id, visit_definition_id, procedure_definition_id, sort_order, is_required, is_conditional, condition_label',
      )
      .eq('study_id', studyId)
      .eq('organization_id', organizationId)
      .order('sort_order', { ascending: true }),
  ])

  if (visitsResult.error) throw new Error(visitsResult.error.message)
  if (proceduresResult.error) throw new Error(proceduresResult.error.message)
  if (mapsResult.error) throw new Error(mapsResult.error.message)

  const visits = (visitsResult.data ?? []) as VisitDefRow[]
  const procedures = (proceduresResult.data ?? []) as ProcedureDefRow[]
  const maps = (mapsResult.data ?? []) as MapRow[]

  const codeByVisitId = new Map(visits.map((v) => [v.id, v.code]))
  const codeByProcedureId = new Map(procedures.map((p) => [p.id, p.code]))

  const nodes: ProtocolGraphNode[] = [
    {
      nodeKey: `${NODE_TYPES.STUDY}:${studyId}`,
      nodeType: 'study',
      entityRefType: 'study',
      entityRefId: studyId,
      properties: {},
    },
  ]

  if (studyVersionId) {
    nodes.push({
      nodeKey: `${NODE_TYPES.VERSION}:${studyVersionId}`,
      nodeType: 'protocol_version',
      entityRefType: 'study_version',
      entityRefId: studyVersionId,
      properties: { versionLabel: studyVersionLabel },
    })
  }

  for (const v of visits) {
    nodes.push({
      nodeKey: visitNodeKey(v.id),
      nodeType: 'visit_definition',
      entityRefType: 'visit_definition',
      entityRefId: v.id,
      properties: {
        code: v.code,
        label: v.label,
        targetDay: v.target_day,
        windowMinOffset: v.window_min_offset,
        windowMaxOffset: v.window_max_offset,
        eligibleArms: v.eligible_arms,
        eligibleSubjectRoles: v.eligible_subject_roles,
        modality: v.modality,
      },
    })
  }

  for (const p of procedures) {
    nodes.push({
      nodeKey: procedureNodeKey(p.id),
      nodeType: 'procedure_definition',
      entityRefType: 'procedure_definition',
      entityRefId: p.id,
      properties: {
        code: p.code,
        label: p.label,
        isRequiredDefault: p.is_required_default,
        billableDefault: p.billable_default,
      },
    })
  }

  const edges: ProtocolGraphEdge[] = []

  if (studyVersionId) {
    for (const v of visits) {
      edges.push({
        edgeKey: `protocol-visit:${v.id}`,
        edgeType: EDGE_TYPES.PROTOCOL_VISIT,
        fromNodeKey: `${NODE_TYPES.VERSION}:${studyVersionId}`,
        toNodeKey: visitNodeKey(v.id),
        condition: {},
        properties: { code: v.code },
        sortOrder: v.sort_order,
      })
    }
  }

  for (const m of maps) {
    edges.push({
      edgeKey: `visit-proc:${m.id}`,
      edgeType: EDGE_TYPES.VISIT_PROCEDURE,
      fromNodeKey: visitNodeKey(m.visit_definition_id),
      toNodeKey: procedureNodeKey(m.procedure_definition_id),
      condition: { isConditional: m.is_conditional },
      properties: {
        mapId: m.id,
        isRequired: m.is_required,
        isConditional: m.is_conditional,
        conditionLabel: m.condition_label,
      },
      sortOrder: m.sort_order,
    })

    if (m.is_conditional) {
      nodes.push({
        nodeKey: `rule:conditional:${m.id}`,
        nodeType: 'eligibility_rule',
        entityRefType: 'visit_def_procedure_map',
        entityRefId: m.id,
        properties: {
          conditionLabel: m.condition_label,
          visitCode: codeByVisitId.get(m.visit_definition_id),
          procedureCode: codeByProcedureId.get(m.procedure_definition_id),
        },
      })
    }
  }

  for (let i = 1; i < visits.length; i++) {
    const prev = visits[i - 1]
    const curr = visits[i]
    if (prev.target_day != null && curr.target_day != null && curr.target_day > prev.target_day) {
      edges.push({
        edgeKey: `window-seq:${prev.id}:${curr.id}`,
        edgeType: EDGE_TYPES.WINDOW_DEPENDS,
        fromNodeKey: visitNodeKey(prev.id),
        toNodeKey: visitNodeKey(curr.id),
        condition: {},
        properties: {
          priorTargetDay: prev.target_day,
          targetDay: curr.target_day,
        },
      })
    }
  }

  const { rules: metadataRules, edges: metadataEdges } = compileMetadataRules(
    extensions,
    codeByProcedureId,
    codeByVisitId,
  )
  edges.push(...metadataEdges)

  const builtinRules = resolveBuiltinRules(ruleKeys)
  const runtimeRules: ProtocolRuntimeRule[] = [...builtinRules, ...metadataRules]

  const checksumPayload = {
    studyId,
    studyVersionId,
    visits: visits.map((v) => v.id),
    procedures: procedures.map((p) => p.id),
    maps: maps.map((m) => m.id),
    ruleKeys,
    extensions,
  }

  return {
    schemaVersion: PROTOCOL_GRAPH_SCHEMA_VERSION,
    studyId,
    organizationId,
    studyVersionId,
    studyVersionLabel,
    compiledAt: new Date().toISOString(),
    sourceChecksum: computeGraphSourceChecksum(checksumPayload),
    amendment: {},
    nodes,
    edges,
    runtimeRules,
  }
}
