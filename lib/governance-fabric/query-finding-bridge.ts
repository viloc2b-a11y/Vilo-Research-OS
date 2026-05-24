import type { GovernanceSignal } from '@/lib/governance-fabric/types'
import type { SupabaseClient } from '@supabase/supabase-js'

export async function loadOpenQueriesForVisit(input: {
  supabase: SupabaseClient
  organizationId: string
  studySubjectId: string
  visitId: string
}): Promise<GovernanceSignal[]> {
  const { data, error } = await input.supabase
    .from('subject_workflow_actions')
    .select(
      'id, title, description, status, visit_id, procedure_execution_id, source_response_set_id, created_at, study_id, organization_id',
    )
    .eq('study_subject_id', input.studySubjectId)
    .eq('organization_id', input.organizationId)
    .eq('action_type', 'query')
    .in('status', ['open', 'in_progress'])
    .or(`visit_id.is.null,visit_id.eq.${input.visitId}`)

  if (error) throw new Error(error.message)

  const detectedAt = new Date().toISOString()

  return (data ?? []).map((row) => ({
    signalKey: `query:${row.id as string}`,
    signalType: 'open_query_unresolved' as const,
    severity: 'warning' as const,
    status: 'open' as const,
    label: 'Open data query',
    detail: (row.description as string) || (row.title as string) || 'Unresolved query.',
    organizationId: row.organization_id as string,
    studyId: row.study_id as string,
    studySubjectId: input.studySubjectId,
    visitId: (row.visit_id as string | null) ?? input.visitId,
    procedureExecutionId: (row.procedure_execution_id as string | null) ?? null,
    sourceResponseSetId: (row.source_response_set_id as string | null) ?? null,
    workflowActionId: row.id as string,
    detectedAt,
    derivation: {
      source: 'subject_workflow_actions',
      action_type: 'query',
      workflow_action_id: row.id,
    },
  }))
}

export function findingsSignalsFromProjection(input: {
  organizationId: string
  studyId: string
  studySubjectId: string
  visitId: string
  unresolvedFindingCount: number
}): GovernanceSignal[] {
  if (input.unresolvedFindingCount <= 0) return []

  return [
    {
      signalKey: `finding:visit:${input.visitId}`,
      signalType: 'unresolved_finding_at_closeout',
      severity: 'blocker',
      status: 'open',
      label: 'Unresolved source findings',
      detail: `${input.unresolvedFindingCount} critical finding(s) block closeout.`,
      organizationId: input.organizationId,
      studyId: input.studyId,
      studySubjectId: input.studySubjectId,
      visitId: input.visitId,
      detectedAt: new Date().toISOString(),
      derivation: {
        source: 'source_response_validation_findings',
        unresolved_count: input.unresolvedFindingCount,
      },
    },
  ]
}
