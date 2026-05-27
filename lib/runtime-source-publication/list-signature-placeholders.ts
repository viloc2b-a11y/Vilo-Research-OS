import type { SupabaseClient } from '@supabase/supabase-js'
import { mapSignaturePlaceholderRow, type RuntimeSourceSignaturePlaceholderRow } from './runtime-source-publication-types'

export async function listSignaturePlaceholders(args: {
  supabase: SupabaseClient
  organizationId: string
  sourcePackageId: string
}): Promise<RuntimeSourceSignaturePlaceholderRow[]> {
  const { data, error } = await args.supabase
    .from('runtime_source_signature_placeholders')
    .select('*')
    .eq('organization_id', args.organizationId)
    .eq('source_package_id', args.sourcePackageId)
    .order('placeholder_scope', { ascending: true })
    .order('sequence_order', { ascending: true })
    .order('created_at', { ascending: true })

  if (error) throw new Error(error.message)
  return (data ?? []).map((row) => mapSignaturePlaceholderRow(row as Record<string, unknown>))
}

