import { createServerClient } from '@/lib/supabase/server'

export type VisitCloseoutGuards = {
  coordinatorSignBlocked: boolean
  coordinatorBlockReasons: string[]
  investigatorSignBlocked: boolean
  investigatorBlockReasons: string[]
  visitCompletionBlocked: boolean
  visitCompletionBlockReasons: string[]
}

type ProcedureRow = {
  id: string
  is_signed: boolean
  validation_status: string
}

async function loadVisitProcedureContext(visitId: string, organizationId: string) {
  const supabase = await createServerClient()

  const { data: procedures } = await supabase
    .from('procedure_executions')
    .select('id, is_signed, validation_status')
    .eq('visit_id', visitId)
    .eq('organization_id', organizationId)

  const rows = (procedures ?? []) as ProcedureRow[]
  const procedureIds = rows.map((p) => p.id)

  let criticalOpenCount = 0
  if (procedureIds.length > 0) {
    const { data: sets } = await supabase
      .from('source_response_sets')
      .select('id')
      .in('procedure_execution_id', procedureIds)

    const setIds = (sets ?? []).map((s) => s.id as string)
    if (setIds.length > 0) {
      const { count } = await supabase
        .from('source_response_validation_findings')
        .select('id', { count: 'exact', head: true })
        .in('response_set_id', setIds)
        .eq('severity', 'error')
        .in('status', ['open', 'acknowledged'])

      criticalOpenCount = count ?? 0
    }
  }

  return { procedures: rows, criticalOpenCount }
}

export function assessProcedureReadiness(
  procedures: ProcedureRow[],
  criticalOpenCount: number,
): Omit<
  VisitCloseoutGuards,
  'coordinatorSignBlocked' | 'coordinatorBlockReasons' | 'investigatorSignBlocked' | 'investigatorBlockReasons'
> {
  const visitCompletionBlockReasons: string[] = []

  if (procedures.length > 0) {
    const unsigned = procedures.filter((p) => !p.is_signed)
    if (unsigned.length > 0) {
      visitCompletionBlockReasons.push(
        `${unsigned.length} procedure(s) not signed.`,
      )
    }
  }

  const blockedProcs = procedures.filter((p) => p.validation_status === 'blocked')
  if (blockedProcs.length > 0) {
    visitCompletionBlockReasons.push(
      `${blockedProcs.length} procedure(s) have blocking validation.`,
    )
  }

  const incompleteProcs = procedures.filter((p) => p.validation_status === 'incomplete')
  if (incompleteProcs.length > 0) {
    visitCompletionBlockReasons.push(
      `${incompleteProcs.length} procedure(s) incomplete.`,
    )
  }

  if (criticalOpenCount > 0) {
    visitCompletionBlockReasons.push(
      `${criticalOpenCount} unresolved critical finding(s) (error severity).`,
    )
  }

  return {
    visitCompletionBlocked: visitCompletionBlockReasons.length > 0,
    visitCompletionBlockReasons,
  }
}

export async function loadVisitCloseoutGuards(
  visitId: string,
  organizationId: string,
  noteText: string | null | undefined,
  coordinatorSigned: boolean,
): Promise<VisitCloseoutGuards> {
  const { procedures, criticalOpenCount } = await loadVisitProcedureContext(
    visitId,
    organizationId,
  )

  const coordinatorBlockReasons: string[] = []
  const blockedProcs = procedures.filter((p) => p.validation_status === 'blocked')
  if (blockedProcs.length > 0) {
    coordinatorBlockReasons.push(
      `Resolve blocking validation on ${blockedProcs.length} procedure(s) before coordinator sign-off.`,
    )
  }
  if (criticalOpenCount > 0) {
    coordinatorBlockReasons.push(
      `${criticalOpenCount} unresolved critical finding(s) must be addressed or waived.`,
    )
  }

  const investigatorBlockReasons: string[] = []
  if (!noteText?.trim()) {
    investigatorBlockReasons.push('Coordinator progress note is empty.')
  }
  if (!coordinatorSigned) {
    investigatorBlockReasons.push('Coordinator must sign the progress note first.')
  }

  const completion = assessProcedureReadiness(procedures, criticalOpenCount)

  return {
    coordinatorSignBlocked: coordinatorBlockReasons.length > 0,
    coordinatorBlockReasons,
    investigatorSignBlocked: investigatorBlockReasons.length > 0,
    investigatorBlockReasons,
    ...completion,
  }
}
