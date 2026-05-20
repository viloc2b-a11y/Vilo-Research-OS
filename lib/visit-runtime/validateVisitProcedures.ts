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

  const blockingMessages: string[] = []
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

    if (validation.status === 'blocked' || validation.status === 'incomplete') {
      blockingMessages.push(
        `Procedure ${procedure.id}: ${validation.alerts.map((alert) => alert.message).join('; ')}`,
      )
    }
  }

  if (blockingMessages.length > 0) {
    return { ok: false as const, error: blockingMessages.join(' ') }
  }
  return { ok: true as const }
}
