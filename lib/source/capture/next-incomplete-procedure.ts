/**
 * Lightweight visit-scoped lookup for the next procedure still needing execution/capture.
 * No source field payloads — ids and labels only.
 */

import { sourceCapturePath } from '@/lib/ops/paths'
import { createServerClient } from '@/lib/supabase/server'

export type NextIncompleteProcedureRef = {
  procedureExecutionId: string
  label: string
  captureHref: string
}

function one<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null
  return value ?? null
}

export async function findNextIncompleteProcedureInVisit(input: {
  visitId: string
  organizationId: string
  excludeProcedureExecutionId: string
}): Promise<NextIncompleteProcedureRef | null> {
  const supabase = await createServerClient()

  const { data: rows, error } = await supabase
    .from('procedure_executions')
    .select('id, procedure_definitions(label, code)')
    .eq('visit_id', input.visitId)
    .eq('organization_id', input.organizationId)
    .neq('id', input.excludeProcedureExecutionId)
    .in('execution_status', ['pending', 'in_progress'])
    .not('source_definition_version_id', 'is', null)
    .order('created_at', { ascending: true })
    .limit(1)

  if (error || !rows?.length) return null

  const row = rows[0]
  const def = one(row.procedure_definitions) as { label?: string; code?: string } | null
  const procedureExecutionId = row.id as string

  return {
    procedureExecutionId,
    label: def?.label ?? def?.code ?? 'Procedure',
    captureHref: sourceCapturePath(procedureExecutionId, input.organizationId),
  }
}
