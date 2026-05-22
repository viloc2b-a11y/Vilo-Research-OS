import { createServerClient } from '@/lib/supabase/server'
import { isSourceCaptureSubmitted } from '@/lib/source/submitted-source-gate'
import { loadIpCaptureStatusByVisit } from '@/lib/subject/visits/ip-capture'

export type VisitCloseoutGuards = {
  coordinatorSignBlocked: boolean
  coordinatorBlockReasons: string[]
  investigatorSignBlocked: boolean
  investigatorBlockReasons: string[]
  visitCompletionBlocked: boolean
  visitCompletionBlockReasons: string[]
  ipCaptureWarning: string | null
}

type ProcedureReadinessRow = {
  id: string
  is_signed: boolean
  validation_status: string
}

type ProcedureRow = ProcedureReadinessRow & {
  source_definition_version_id: string | null
}

async function loadVisitProcedureContext(visitId: string, organizationId: string) {
  const supabase = await createServerClient()

  const { data: procedures } = await supabase
    .from('procedure_executions')
    .select('id, is_signed, validation_status, source_definition_version_id')
    .eq('visit_id', visitId)
    .eq('organization_id', organizationId)

  const rows = (procedures ?? []) as ProcedureRow[]
  const procedureIds = rows.map((p) => p.id)

  let unsubmittedSourceCount = 0
  let criticalOpenCount = 0
  if (procedureIds.length > 0) {
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

    for (const proc of rows) {
      const hasBinding = Boolean(proc.source_definition_version_id)
      const hasSet = latestStatusByProcedure.has(proc.id)
      if (!hasBinding && !hasSet) continue
      if (!isSourceCaptureSubmitted(latestStatusByProcedure.get(proc.id))) {
        unsubmittedSourceCount += 1
      }
    }

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

  return { procedures: rows, criticalOpenCount, unsubmittedSourceCount }
}

export function assessProcedureReadiness(
  procedures: ProcedureReadinessRow[],
  criticalOpenCount: number,
): Omit<
  VisitCloseoutGuards,
  'coordinatorSignBlocked' | 'coordinatorBlockReasons' | 'investigatorSignBlocked' | 'investigatorBlockReasons' | 'ipCaptureWarning'
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
  const { procedures, criticalOpenCount, unsubmittedSourceCount } =
    await loadVisitProcedureContext(visitId, organizationId)
  const supabase = await createServerClient()
  const ipCapture = (await loadIpCaptureStatusByVisit(
    supabase,
    [visitId],
    organizationId,
  )).get(visitId)
  const ipCaptureWarning =
    ipCapture && (ipCapture.status === 'required' || ipCapture.status === 'incomplete')
      ? `IP documentation is ${ipCapture.status === 'required' ? 'required' : 'incomplete'} for this visit based on bound source fields.`
      : null

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
  if (unsubmittedSourceCount > 0) {
    coordinatorBlockReasons.push(
      `${unsubmittedSourceCount} procedure(s) require submitted source capture before coordinator sign-off.`,
    )
  }
  // F-12 fix: IP documentation required-but-incomplete blocks coordinator signature
  if (ipCaptureWarning) {
    coordinatorBlockReasons.push(ipCaptureWarning)
  }

  const investigatorBlockReasons: string[] = []
  if (!noteText?.trim()) {
    investigatorBlockReasons.push('Coordinator progress note is empty.')
  }
  if (!coordinatorSigned) {
    investigatorBlockReasons.push('Coordinator must sign the progress note first.')
  }
  if (unsubmittedSourceCount > 0) {
    investigatorBlockReasons.push(
      `${unsubmittedSourceCount} procedure(s) require submitted source capture before investigator sign-off.`,
    )
  }

  const completion = assessProcedureReadiness(procedures, criticalOpenCount)

  return {
    coordinatorSignBlocked: coordinatorBlockReasons.length > 0,
    coordinatorBlockReasons,
    investigatorSignBlocked: investigatorBlockReasons.length > 0,
    investigatorBlockReasons,
    ipCaptureWarning,
    ...completion,
  }
}
