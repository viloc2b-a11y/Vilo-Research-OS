import {
  countOpenAdverseEvents,
  countOpenAdverseEventsForVisit,
  loadProcedureExecutionsForVisit,
  loadVisitSourceMetrics,
} from '@/lib/projections/compute/shared'
import type { ProtocolGraphDocument } from '@/lib/protocol-graph/types'
import type { SupabaseClient } from '@supabase/supabase-js'

export type RuntimeGraphContext = {
  organizationId: string
  studyId: string
  studySubjectId: string
  visitId: string | null
  visitDefinitionId: string | null
  visitCode: string | null
  visitModality: string | null
  windowStatus: string | null
  randomizationArm: string | null
  subjectRole: string | null
  openAeVisitCount: number
  openAeSubjectCount: number
  unresolvedFindingCount: number
  procedureCodesByExecutionId: Map<string, string>
  incompleteProcedureCodes: Set<string>
  unsignedProcedureCodes: Set<string>
  completedProcedureCodes: Set<string>
  criticalLabProcedureCodes: Set<string>
  activeBranches: Set<string>
  graph: ProtocolGraphDocument
}

export async function buildVisitRuntimeGraphContext(input: {
  supabase: SupabaseClient
  graph: ProtocolGraphDocument
  visitId: string
  organizationId: string
}): Promise<RuntimeGraphContext | null> {
  const { supabase, graph, visitId, organizationId } = input

  const { data: visit, error } = await supabase
    .from('visits')
    .select(
      `
      id,
      study_id,
      study_subject_id,
      visit_definition_id,
      modality,
      window_status,
      visit_definitions(code),
      study_subjects(randomization_arm, subject_role)
    `,
    )
    .eq('id', visitId)
    .eq('organization_id', organizationId)
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (!visit) return null

  const visitDef = Array.isArray(visit.visit_definitions)
    ? visit.visit_definitions[0]
    : visit.visit_definitions
  const subject = Array.isArray(visit.study_subjects)
    ? visit.study_subjects[0]
    : visit.study_subjects

  const procedures = await loadProcedureExecutionsForVisit(supabase, visitId, organizationId)
  const sourceMetrics = await loadVisitSourceMetrics(supabase, procedures)

  const { data: procDefs } = await supabase
    .from('procedure_executions')
    .select('id, procedure_definition_id, execution_status, is_signed, procedure_definitions(code)')
    .eq('visit_id', visitId)
    .eq('organization_id', organizationId)

  const procedureCodesByExecutionId = new Map<string, string>()
  const incompleteProcedureCodes = new Set<string>()
  const unsignedProcedureCodes = new Set<string>()
  const completedProcedureCodes = new Set<string>()

  for (const row of procDefs ?? []) {
    const proc = Array.isArray(row.procedure_definitions)
      ? row.procedure_definitions[0]
      : row.procedure_definitions
    const code = (proc as { code?: string } | null)?.code
    if (!code) continue
    procedureCodesByExecutionId.set(row.id as string, code)
    if (row.execution_status !== 'completed') incompleteProcedureCodes.add(code)
    if (!row.is_signed) unsignedProcedureCodes.add(code)
    if (row.execution_status === 'completed') completedProcedureCodes.add(code)
  }

  const criticalLabProcedureCodes = await loadCriticalLabProcedureCodes(
    supabase,
    procedures.map((p) => p.id),
  )

  const studySubjectId = visit.study_subject_id as string
  const randomizationArm = (subject as { randomization_arm?: string } | null)?.randomization_arm ?? null
  const activeBranches = resolveActiveBranches(graph, randomizationArm)

  return {
    organizationId,
    studyId: visit.study_id as string,
    studySubjectId,
    visitId,
    visitDefinitionId: (visit.visit_definition_id as string) ?? null,
    visitCode: (visitDef as { code?: string } | null)?.code ?? null,
    visitModality: (visit.modality as string | null) ?? null,
    windowStatus: (visit.window_status as string | null) ?? null,
    randomizationArm,
    subjectRole: (subject as { subject_role?: string } | null)?.subject_role ?? null,
    openAeVisitCount: await countOpenAdverseEventsForVisit(supabase, visitId, organizationId),
    openAeSubjectCount: await countOpenAdverseEvents(supabase, studySubjectId, organizationId),
    unresolvedFindingCount: sourceMetrics.unresolvedFindingCount,
    procedureCodesByExecutionId,
    incompleteProcedureCodes,
    unsignedProcedureCodes,
    completedProcedureCodes,
    criticalLabProcedureCodes,
    activeBranches,
    graph,
  }
}

async function loadCriticalLabProcedureCodes(
  supabase: SupabaseClient,
  procedureExecutionIds: string[],
): Promise<Set<string>> {
  const codes = new Set<string>()
  if (procedureExecutionIds.length === 0) return codes

  const { data: sets } = await supabase
    .from('source_response_sets')
    .select('id, procedure_execution_id')
    .in('procedure_execution_id', procedureExecutionIds)
    .neq('status', 'archived')

  const setIds = (sets ?? []).map((s) => s.id as string)
  if (setIds.length === 0) return codes

  const { data: findings } = await supabase
    .from('source_response_validation_findings')
    .select('response_set_id, severity, status')
    .in('response_set_id', setIds)
    .eq('severity', 'error')
    .in('status', ['open', 'acknowledged'])

  const criticalSetIds = new Set((findings ?? []).map((f) => f.response_set_id as string))
  const criticalPeIds = (sets ?? [])
    .filter((s) => criticalSetIds.has(s.id as string))
    .map((s) => s.procedure_execution_id as string)

  if (criticalPeIds.length === 0) return codes

  const { data: peRows } = await supabase
    .from('procedure_executions')
    .select('id, procedure_definitions(code)')
    .in('id', criticalPeIds)

  for (const pe of peRows ?? []) {
    const proc = Array.isArray(pe.procedure_definitions)
      ? pe.procedure_definitions[0]
      : pe.procedure_definitions
    const code = (proc as { code?: string } | null)?.code
    if (code) codes.add(code)
  }
  return codes
}

function resolveActiveBranches(
  graph: ProtocolGraphDocument,
  randomizationArm: string | null,
): Set<string> {
  const active = new Set<string>()
  for (const edge of graph.edges) {
    if (edge.edgeType !== 'branch_activates_visit') continue
    const branchKey = edge.fromNodeKey.replace(/^branch:/, '')
    const arm = edge.condition?.arm as string | null | undefined
    if (arm && randomizationArm && arm !== randomizationArm) continue
    active.add(branchKey)
  }
  return active
}

export async function buildSubjectRuntimeGraphContext(input: {
  supabase: SupabaseClient
  graph: ProtocolGraphDocument
  studySubjectId: string
  organizationId: string
}): Promise<Omit<RuntimeGraphContext, 'visitId' | 'visitDefinitionId' | 'visitCode' | 'visitModality' | 'windowStatus' | 'openAeVisitCount'> | null> {
  const { supabase, graph, studySubjectId, organizationId } = input

  const { data: subject, error } = await supabase
    .from('study_subjects')
    .select('id, study_id, randomization_arm, subject_role')
    .eq('id', studySubjectId)
    .eq('organization_id', organizationId)
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (!subject) return null

  const openAeSubjectCount = await countOpenAdverseEvents(supabase, studySubjectId, organizationId)

  return {
    organizationId,
    studyId: subject.study_id as string,
    studySubjectId,
    randomizationArm: (subject.randomization_arm as string | null) ?? null,
    subjectRole: (subject.subject_role as string | null) ?? null,
    openAeSubjectCount,
    unresolvedFindingCount: 0,
    procedureCodesByExecutionId: new Map(),
    incompleteProcedureCodes: new Set(),
    unsignedProcedureCodes: new Set(),
    completedProcedureCodes: new Set(),
    criticalLabProcedureCodes: new Set(),
    activeBranches: resolveActiveBranches(graph, (subject.randomization_arm as string | null) ?? null),
    graph,
  }
}
