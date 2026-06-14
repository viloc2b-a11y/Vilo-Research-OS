import { isSourceCaptureSubmitted } from '@/lib/source/submitted-source-gate'
import type { SupabaseClient } from '@supabase/supabase-js'

export type ProcedureExecutionRow = {
  id: string
  visit_id: string
  execution_status: string
  validation_status: string | null
  is_signed: boolean | null
  section_disabled_at: string | null
  source_definition_version_id: string | null
}

const TERMINAL_VISIT_STATUSES = new Set([
  'completed',
  'locked',
  'cancelled',
  'no_show',
  'missed',
])

export function isTerminalVisitStatus(status: string | null | undefined): boolean {
  return TERMINAL_VISIT_STATUSES.has(status ?? '')
}

export async function loadProcedureExecutionsForVisit(
  supabase: SupabaseClient,
  visitId: string,
  organizationId: string,
): Promise<ProcedureExecutionRow[]> {
  const { data, error } = await supabase
    .from('procedure_executions')
    .select(
      'id, visit_id, execution_status, validation_status, is_signed, section_disabled_at, source_definition_version_id',
    )
    .eq('visit_id', visitId)
    .eq('organization_id', organizationId)

  if (error) throw new Error(error.message)
  return (data ?? []) as ProcedureExecutionRow[]
}

export async function loadProcedureExecutionsForSubject(
  supabase: SupabaseClient,
  subjectId: string,
  organizationId: string,
): Promise<ProcedureExecutionRow[]> {
  const { data: visits } = await supabase
    .from('visits')
    .select('id')
    .eq('study_subject_id', subjectId)
    .eq('organization_id', organizationId)

  const visitIds = (visits ?? []).map((v) => v.id as string)
  if (visitIds.length === 0) return []

  const { data, error } = await supabase
    .from('procedure_executions')
    .select(
      'id, visit_id, execution_status, validation_status, is_signed, section_disabled_at, source_definition_version_id',
    )
    .in('visit_id', visitIds)
    .eq('organization_id', organizationId)

  if (error) throw new Error(error.message)
  return (data ?? []) as ProcedureExecutionRow[]
}

export type VisitSourceMetrics = {
  unsubmittedSourceCount: number
  unresolvedFindingCount: number
}

export async function loadVisitSourceMetrics(
  supabase: SupabaseClient,
  procedures: ProcedureExecutionRow[],
): Promise<VisitSourceMetrics> {
  const procedureIds = procedures.map((p) => p.id)
  if (procedureIds.length === 0) {
    return { unsubmittedSourceCount: 0, unresolvedFindingCount: 0 }
  }

  const { data: sets } = await supabase
    .from('source_response_sets')
    .select('id, procedure_execution_id, status')
    .in('procedure_execution_id', procedureIds)
    .neq('status', 'archived')
    .order('opened_at', { ascending: false })

  const latestStatusByProcedure = new Map<string, string>()
  for (const set of sets ?? []) {
    const peId = set.procedure_execution_id as string
    if (!latestStatusByProcedure.has(peId)) {
      latestStatusByProcedure.set(peId, set.status as string)
    }
  }

  let unsubmittedSourceCount = 0
  for (const proc of procedures) {
    if (proc.section_disabled_at) continue
    const hasBinding = Boolean(proc.source_definition_version_id)
    const hasSet = latestStatusByProcedure.has(proc.id)
    if (!hasBinding && !hasSet) continue
    if (!isSourceCaptureSubmitted(latestStatusByProcedure.get(proc.id))) {
      unsubmittedSourceCount += 1
    }
  }

  const setIds = (sets ?? []).map((s) => s.id as string)
  let unresolvedFindingCount = 0
  if (setIds.length > 0) {
    const { count } = await supabase
      .from('source_response_validation_findings')
      .select('id', { count: 'exact', head: true })
      .in('response_set_id', setIds)
      .eq('severity', 'error')
      .in('status', ['open', 'acknowledged'])

    unresolvedFindingCount = count ?? 0
  }

  return { unsubmittedSourceCount, unresolvedFindingCount }
}

export async function countIncompleteSourceForSubject(
  supabase: SupabaseClient,
  subjectId: string,
  organizationId: string,
): Promise<number> {
  const { count, error } = await supabase
    .from('source_response_sets')
    .select('id', { count: 'exact', head: true })
    .eq('study_subject_id', subjectId)
    .eq('organization_id', organizationId)
    .in('status', ['draft', 'in_progress'])

  if (error) return 0
  return count ?? 0
}

export async function countOpenAdverseEvents(
  supabase: SupabaseClient,
  subjectId: string,
  organizationId: string,
): Promise<number> {
  const { count, error } = await supabase
    .from('subject_adverse_events')
    .select('ae_id', { count: 'exact', head: true })
    .eq('study_subject_id', subjectId)
    .eq('organization_id', organizationId)
    .in('lifecycle_status', ['open', 'follow_up'])

  if (error) return 0
  return count ?? 0
}

// === Safety Events (new table) ===

export async function countOpenSafetyEvents(
  supabase: SupabaseClient,
  subjectId: string,
  organizationId: string,
): Promise<number> {
  const { count, error } = await supabase
    .from('safety_events')
    .select('id', { count: 'exact', head: true })
    .eq('subject_id', subjectId)
    .eq('organization_id', organizationId)
    .in('event_status', ['open', 'under_review'])
  if (error) return 0
  return count ?? 0
}

export async function countSafetyCandidates(
  supabase: SupabaseClient,
  subjectId: string,
  organizationId: string,
): Promise<number> {
  const { count, error } = await supabase
    .from('safety_events')
    .select('id', { count: 'exact', head: true })
    .eq('subject_id', subjectId)
    .eq('organization_id', organizationId)
    .eq('event_status', 'candidate')
  if (error) return 0
  return count ?? 0
}

// === Protocol Deviations ===

export async function countOpenDeviationsForSubject(
  supabase: SupabaseClient,
  subjectId: string,
  organizationId: string,
): Promise<number> {
  const { count, error } = await supabase
    .from('protocol_deviations')
    .select('id', { count: 'exact', head: true })
    .eq('subject_id', subjectId)
    .eq('organization_id', organizationId)
    .in('status', ['open', 'under_review'])
  if (error) return 0
  return count ?? 0
}

// === CAPA Actions ===

export async function countOpenCapaForSubject(
  supabase: SupabaseClient,
  subjectId: string,
  organizationId: string,
): Promise<number> {
  const { data: deviations, error: devError } = await supabase
    .from('protocol_deviations')
    .select('id')
    .eq('subject_id', subjectId)
    .eq('organization_id', organizationId)
  if (devError) return 0
  const deviationIds = ((deviations ?? []) as { id: string }[]).map(d => d.id)
  if (deviationIds.length === 0) return 0
  const { count, error } = await supabase
    .from('capa_actions')
    .select('id', { count: 'exact', head: true })
    .eq('organization_id', organizationId)
    .in('deviation_id', deviationIds)
    .not('capa_status', 'eq', 'closed')
  if (error) return 0
  return count ?? 0
}

export async function countOpenAdverseEventsForVisit(
  supabase: SupabaseClient,
  visitId: string,
  organizationId: string,
): Promise<number> {
  const { count, error } = await supabase
    .from('subject_adverse_events')
    .select('ae_id', { count: 'exact', head: true })
    .eq('visit_id', visitId)
    .eq('organization_id', organizationId)
    .in('lifecycle_status', ['open', 'follow_up'])

  if (error) return 0
  return count ?? 0
}
