import type { SupabaseClient } from '@supabase/supabase-js'
import { mapRuntimeSourcePackageRow, type RuntimeSourcePackageRow } from './source-package-types'

export type ApproveRuntimeSourcePackageArgs = {
  supabase: SupabaseClient
  organizationId: string
  packageId: string
  approvedBy: string
}

export async function approveRuntimeSourcePackage(
  args: ApproveRuntimeSourcePackageArgs,
): Promise<RuntimeSourcePackageRow> {
  const approvedAt = new Date().toISOString()

  const { data: existing, error: loadError } = await args.supabase
    .from('runtime_source_packages')
    .select('package_status')
    .eq('id', args.packageId)
    .eq('organization_id', args.organizationId)
    .maybeSingle()

  if (loadError) throw new Error(loadError.message)
  if (!existing) throw new Error('Source package not found.')
  if (existing.package_status !== 'reviewed') {
    throw new Error(`Package cannot be approved from status "${existing.package_status}".`)
  }

  const { count: draftVisitShells, error: visitError } = await args.supabase
    .from('runtime_source_visit_shells')
    .select('id', { count: 'exact', head: true })
    .eq('source_package_id', args.packageId)
    .neq('status', 'reviewed')

  if (visitError) throw new Error(visitError.message)
  if ((draftVisitShells ?? 0) > 0) {
    throw new Error('All visit shells must be reviewed before approval.')
  }

  const { count: draftProcedureShells, error: procedureError } = await args.supabase
    .from('runtime_source_procedure_shells')
    .select('id', { count: 'exact', head: true })
    .eq('source_package_id', args.packageId)
    .neq('status', 'reviewed')

  if (procedureError) throw new Error(procedureError.message)
  if ((draftProcedureShells ?? 0) > 0) {
    throw new Error('All procedure shells must be reviewed before approval.')
  }

  const { data, error } = await args.supabase
    .from('runtime_source_packages')
    .update({
      package_status: 'approved',
      approved_by: args.approvedBy,
      approved_at: approvedAt,
      updated_at: approvedAt,
    })
    .eq('id', args.packageId)
    .eq('organization_id', args.organizationId)
    .select('*')
    .single()

  if (error || !data) {
    throw new Error(`Failed to approve source package: ${error?.message ?? 'Unknown error'}`)
  }

  await args.supabase
    .from('runtime_source_visit_shells')
    .update({ status: 'approved', updated_at: approvedAt })
    .eq('source_package_id', args.packageId)

  await args.supabase
    .from('runtime_source_procedure_shells')
    .update({ status: 'approved', updated_at: approvedAt })
    .eq('source_package_id', args.packageId)

  return mapRuntimeSourcePackageRow(data as Record<string, unknown>)
}
