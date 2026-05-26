import type { SupabaseClient } from '@supabase/supabase-js'
import {
  mapProcedureShellRow,
  mapRuntimeSourcePackageRow,
  mapVisitShellRow,
  type LoadedRuntimeSourcePackage,
} from './source-package-types'

export async function loadRuntimeSourcePackage(
  supabase: SupabaseClient,
  organizationId: string,
  packageId: string,
): Promise<LoadedRuntimeSourcePackage | null> {
  const { data: packageRow, error: packageError } = await supabase
    .from('runtime_source_packages')
    .select('*')
    .eq('id', packageId)
    .eq('organization_id', organizationId)
    .maybeSingle()

  if (packageError) throw new Error(packageError.message)
  if (!packageRow) return null

  const { data: visitShells, error: visitError } = await supabase
    .from('runtime_source_visit_shells')
    .select('*')
    .eq('source_package_id', packageId)
    .order('sequence_order', { ascending: true })

  if (visitError) throw new Error(visitError.message)

  const { data: procedureShells, error: procedureError } = await supabase
    .from('runtime_source_procedure_shells')
    .select('*')
    .eq('source_package_id', packageId)
    .order('procedure_order', { ascending: true })

  if (procedureError) throw new Error(procedureError.message)

  return {
    package: mapRuntimeSourcePackageRow(packageRow as Record<string, unknown>),
    visitShells: (visitShells ?? []).map((row) => mapVisitShellRow(row as Record<string, unknown>)),
    procedureShells: (procedureShells ?? []).map((row) =>
      mapProcedureShellRow(row as Record<string, unknown>),
    ),
  }
}
