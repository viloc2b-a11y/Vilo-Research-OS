import type { SupabaseClient } from '@supabase/supabase-js'
import {
  mapProcedureRuntimeInstanceRow,
  mapVisitRuntimeEventRow,
  mapVisitRuntimeInstanceRow,
  type LoadedVisitWorkspace,
} from './visit-runtime-types'

export async function loadVisitWorkspace(
  supabase: SupabaseClient,
  organizationId: string,
  visitInstanceId: string,
): Promise<LoadedVisitWorkspace | null> {
  const { data: visitRow, error: visitError } = await supabase
    .from('visit_runtime_instances')
    .select('*')
    .eq('id', visitInstanceId)
    .eq('organization_id', organizationId)
    .maybeSingle()

  if (visitError) throw new Error(visitError.message)
  if (!visitRow) return null

  const { data: procedureRows, error: procedureError } = await supabase
    .from('procedure_runtime_instances')
    .select('*')
    .eq('visit_instance_id', visitInstanceId)
    .order('procedure_order', { ascending: true })

  if (procedureError) throw new Error(procedureError.message)

  const { data: eventRows, error: eventError } = await supabase
    .from('visit_runtime_events')
    .select('*')
    .eq('visit_instance_id', visitInstanceId)
    .order('event_timestamp', { ascending: true })

  if (eventError) throw new Error(eventError.message)

  return {
    visitInstance: mapVisitRuntimeInstanceRow(visitRow as Record<string, unknown>),
    procedureInstances: (procedureRows ?? []).map((row) =>
      mapProcedureRuntimeInstanceRow(row as Record<string, unknown>),
    ),
    events: (eventRows ?? []).map((row) => mapVisitRuntimeEventRow(row as Record<string, unknown>)),
  }
}

export async function loadProcedureInstance(
  supabase: SupabaseClient,
  organizationId: string,
  procedureInstanceId: string,
) {
  const { data, error } = await supabase
    .from('procedure_runtime_instances')
    .select('*')
    .eq('id', procedureInstanceId)
    .eq('organization_id', organizationId)
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (!data) return null
  return mapProcedureRuntimeInstanceRow(data as Record<string, unknown>)
}

export async function loadVisitInstanceProcedures(
  supabase: SupabaseClient,
  visitInstanceId: string,
) {
  const { data, error } = await supabase
    .from('procedure_runtime_instances')
    .select('*')
    .eq('visit_instance_id', visitInstanceId)
    .order('procedure_order', { ascending: true })

  if (error) throw new Error(error.message)
  return (data ?? []).map((row) => mapProcedureRuntimeInstanceRow(row as Record<string, unknown>))
}
