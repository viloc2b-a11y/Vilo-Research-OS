import { ClinicalMutationGateway } from '@/lib/operations/clinical-mutation-gateway'
import { OPERATIONAL_EVENT_TYPES } from '@/lib/operations/event-types'
import { validateProcedure } from '@/lib/visit-runtime/validateProcedure'
import type { createServerClient } from '@/lib/supabase/server'

type Supabase = Awaited<ReturnType<typeof createServerClient>>

export async function validateVisitProcedures(params: {
  supabase: Supabase
  visitId: string
  organizationId: string
}) {
  const { data: procedures, error } = await params.supabase
    .from('procedure_executions')
    .select('id, organization_id, section_disabled_at')
    .eq('visit_id', params.visitId)
    .eq('organization_id', params.organizationId)

  if (error) return { ok: false as const, error: error.message }

  const { data: visit } = await params.supabase
    .from('visits')
    .select('study_id')
    .eq('id', params.visitId)
    .eq('organization_id', params.organizationId)
    .maybeSingle()

  const blockingMessages: string[] = []
  const validationResults: Array<{ procedureExecutionId: string; status: string }> = []
  for (const procedure of procedures ?? []) {
    if (procedure.section_disabled_at) {
      blockingMessages.push(`Procedure ${procedure.id} section is disabled.`)
      continue
    }

    const validation = await validateProcedure({
      supabase: params.supabase,
      procedureExecutionId: procedure.id as string,
      organizationId: params.organizationId,
    })

    await params.supabase
      .from('procedure_executions')
      .update({ validation_status: validation.status })
      .eq('id', procedure.id as string)
      .eq('organization_id', params.organizationId)

    validationResults.push({
      procedureExecutionId: procedure.id as string,
      status: validation.status,
    })

    if (validation.status === 'blocked' || validation.status === 'incomplete') {
      blockingMessages.push(
        `Procedure ${procedure.id}: ${validation.alerts.map((alert) => alert.message).join('; ')}`,
      )
    }
  }

  if (visit?.study_id && validationResults.length > 0) {
    await ClinicalMutationGateway.emitVisit({
      supabase: params.supabase,
      organizationId: params.organizationId,
      studyId: visit.study_id as string,
      visitId: params.visitId,
      actorUserId: null,
      eventType: OPERATIONAL_EVENT_TYPES.VALIDATION_EXECUTED,
      payloadSource: 'validate-visit-procedures',
      mutation: 'procedure_executions.validation_status',
      details: {
        procedure_count: validationResults.length,
        results: validationResults,
      },
    })
  }

  if (blockingMessages.length > 0) {
    return { ok: false as const, error: blockingMessages.join(' ') }
  }
  return { ok: true as const }
}
