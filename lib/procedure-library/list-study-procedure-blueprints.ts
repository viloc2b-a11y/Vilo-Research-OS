import type { SupabaseClient } from '@supabase/supabase-js'
import { mapStudyBlueprintRow, type StudyProcedureBlueprintRow } from './procedure-types'

export type StudyProcedureBlueprintView = StudyProcedureBlueprintRow & {
  procedureCode: string
  procedureName: string
}

export async function listStudyProcedureBlueprints(
  supabase: SupabaseClient,
  organizationId: string,
  studyId: string,
): Promise<StudyProcedureBlueprintView[]> {
  const { data, error } = await supabase
    .from('study_procedure_blueprints')
    .select(
      `
      *,
      procedure_library!inner (
        procedure_code,
        procedure_name
      )
    `,
    )
    .eq('organization_id', organizationId)
    .eq('study_id', studyId)
    .order('created_at', { ascending: true })

  if (error) throw new Error(error.message)

  return (data ?? []).map((row) => {
    const library = row.procedure_library as { procedure_code: string; procedure_name: string }
    const mapped = mapStudyBlueprintRow(row as Record<string, unknown>)
    return {
      ...mapped,
      procedureCode: String(library.procedure_code),
      procedureName: String(library.procedure_name),
    }
  })
}
