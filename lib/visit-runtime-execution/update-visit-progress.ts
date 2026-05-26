import type { SupabaseClient } from '@supabase/supabase-js'
import { recalculateVisitProgress } from './recalculate-visit-progress'
import { loadVisitInstanceProcedures } from './load-visit-workspace'
import { mapVisitRuntimeInstanceRow, type VisitRuntimeInstanceRow } from './visit-runtime-types'

export async function syncVisitProgress(
  supabase: SupabaseClient,
  organizationId: string,
  visitInstanceId: string,
): Promise<VisitRuntimeInstanceRow> {
  const procedures = await loadVisitInstanceProcedures(supabase, visitInstanceId)
  const progressPercent = recalculateVisitProgress(procedures)
  const updatedAt = new Date().toISOString()

  const { data, error } = await supabase
    .from('visit_runtime_instances')
    .update({
      progress_percent: progressPercent,
      updated_at: updatedAt,
    })
    .eq('id', visitInstanceId)
    .eq('organization_id', organizationId)
    .select('*')
    .single()

  if (error || !data) {
    throw new Error(`Failed to update visit progress: ${error?.message ?? 'Unknown error'}`)
  }

  return mapVisitRuntimeInstanceRow(data as Record<string, unknown>)
}
