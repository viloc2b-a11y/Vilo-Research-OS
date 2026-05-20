import { createServerClient } from '@/lib/supabase/server'
import type { ValidationIssueItem } from '@/lib/subject/operations/types'

function one<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null
  return value ?? null
}

export async function loadSubjectValidationIssues(
  subjectId: string,
  organizationId: string,
): Promise<ValidationIssueItem[]> {
  const supabase = await createServerClient()

  const { data: visits } = await supabase
    .from('visits')
    .select('id, visit_definitions(label, code)')
    .eq('study_subject_id', subjectId)
    .eq('organization_id', organizationId)

  const visitIds = (visits ?? []).map((v) => v.id as string)
  if (visitIds.length === 0) return []

  const visitLabelById = new Map<string, string>()
  for (const v of visits ?? []) {
    const def = one(v.visit_definitions) as { label?: string; code?: string } | null
    visitLabelById.set(v.id as string, def?.label ?? def?.code ?? 'Visit')
  }

  const { data: procedures } = await supabase
    .from('procedure_executions')
    .select('id, visit_id, validation_status, procedure_definitions(label, code)')
    .eq('organization_id', organizationId)
    .in('visit_id', visitIds)

  const issues: ValidationIssueItem[] = []
  const procedureIds: string[] = []

  for (const proc of procedures ?? []) {
    const status = proc.validation_status as string | null
    if (status !== 'blocked' && status !== 'incomplete') continue

    const visitId = proc.visit_id as string
    const pd = one(proc.procedure_definitions) as { label?: string; code?: string } | null
    const procLabel = pd?.label ?? pd?.code ?? 'Procedure'
    const visitName = visitLabelById.get(visitId) ?? null

    issues.push({
      id: `proc-${proc.id as string}`,
      kind: status === 'blocked' ? 'blocked' : 'incomplete',
      label: `${procLabel} — ${status === 'blocked' ? 'blocking validation' : 'incomplete'}`,
      visitId,
      visitName,
      href: `/source/capture/${proc.id as string}?organization_id=${organizationId}`,
    })
    procedureIds.push(proc.id as string)
  }

  if (procedureIds.length === 0) return issues

  const { data: sets } = await supabase
    .from('source_response_sets')
    .select('id, procedure_execution_id')
    .in('procedure_execution_id', procedureIds)

  const setIds = (sets ?? []).map((s) => s.id as string)
  if (setIds.length === 0) return issues

  const { data: findings } = await supabase
    .from('source_response_validation_findings')
    .select('id, response_set_id, message, severity')
    .in('response_set_id', setIds)
    .eq('severity', 'error')
    .in('status', ['open', 'acknowledged'])
    .limit(20)

  const setToProc = new Map<string, string>()
  for (const s of sets ?? []) {
    setToProc.set(s.id as string, s.procedure_execution_id as string)
  }

  const procToVisit = new Map<string, string>()
  for (const p of procedures ?? []) {
    procToVisit.set(p.id as string, p.visit_id as string)
  }

  for (const f of findings ?? []) {
    const procId = setToProc.get(f.response_set_id as string)
    const visitId = procId ? procToVisit.get(procId) : undefined
    issues.push({
      id: `finding-${f.id as string}`,
      kind: 'finding',
      label: (f.message as string | null)?.slice(0, 120) || 'Unresolved critical finding',
      visitId: visitId ?? null,
      visitName: visitId ? visitLabelById.get(visitId) ?? null : null,
      href: procId
        ? `/source/capture/${procId}?organization_id=${organizationId}`
        : `/studies`,
    })
  }

  return issues
}

/** Pure filter for dashboard reuse when issues are preloaded. */
export function getValidationIssues(issues: ValidationIssueItem[], limit = 12) {
  return issues.slice(0, limit)
}
