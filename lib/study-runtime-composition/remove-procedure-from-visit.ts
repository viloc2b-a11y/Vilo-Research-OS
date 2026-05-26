import type { SupabaseClient } from '@supabase/supabase-js'

export type RemoveProcedureFromVisitArgs = {
  supabase: SupabaseClient
  organizationId: string
  studyId: string
  visitId: string
  visitProcedureId: string
}

export async function removeProcedureFromVisit(args: RemoveProcedureFromVisitArgs): Promise<void> {
  const { error } = await args.supabase
    .from('study_runtime_visit_procedures')
    .delete()
    .eq('id', args.visitProcedureId)
    .eq('visit_id', args.visitId)
    .eq('study_id', args.studyId)
    .eq('organization_id', args.organizationId)

  if (error) {
    throw new Error(`Failed to remove procedure from visit: ${error.message}`)
  }
}
