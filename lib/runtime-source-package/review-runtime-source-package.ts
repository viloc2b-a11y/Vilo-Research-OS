import type { SupabaseClient } from '@supabase/supabase-js'
import { mapRuntimeSourcePackageRow, type RuntimeSourcePackageRow } from './source-package-types'

export type ReviewRuntimeSourcePackageArgs = {
  supabase: SupabaseClient
  organizationId: string
  packageId: string
  reviewedBy: string
}

export async function reviewRuntimeSourcePackage(
  args: ReviewRuntimeSourcePackageArgs,
): Promise<RuntimeSourcePackageRow> {
  const reviewedAt = new Date().toISOString()

  const { data: existing, error: loadError } = await args.supabase
    .from('runtime_source_packages')
    .select('package_status')
    .eq('id', args.packageId)
    .eq('organization_id', args.organizationId)
    .maybeSingle()

  if (loadError) throw new Error(loadError.message)
  if (!existing) throw new Error('Source package not found.')
  if (existing.package_status !== 'draft') {
    throw new Error(`Package cannot be reviewed from status "${existing.package_status}".`)
  }

  const { data, error } = await args.supabase
    .from('runtime_source_packages')
    .update({
      package_status: 'reviewed',
      reviewed_by: args.reviewedBy,
      reviewed_at: reviewedAt,
      updated_at: reviewedAt,
    })
    .eq('id', args.packageId)
    .eq('organization_id', args.organizationId)
    .select('*')
    .single()

  if (error || !data) {
    throw new Error(`Failed to review source package: ${error?.message ?? 'Unknown error'}`)
  }

  await args.supabase
    .from('runtime_source_visit_shells')
    .update({ status: 'reviewed', updated_at: reviewedAt })
    .eq('source_package_id', args.packageId)

  await args.supabase
    .from('runtime_source_procedure_shells')
    .update({ status: 'reviewed', updated_at: reviewedAt })
    .eq('source_package_id', args.packageId)

  return mapRuntimeSourcePackageRow(data as Record<string, unknown>)
}
