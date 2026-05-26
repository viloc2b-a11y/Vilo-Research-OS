import type { SupabaseClient } from '@supabase/supabase-js'
import {
  LIBRARY_SCOPE,
  mapProcedureRow,
  type CreateProcedureInput,
  type ProcedureLibraryRow,
} from './procedure-types'

export type CreateProcedureArgs = {
  supabase: SupabaseClient
  input: CreateProcedureInput
  createdBy: string
}

export async function createProcedure(args: CreateProcedureArgs): Promise<ProcedureLibraryRow> {
  const scope = args.input.library_scope ?? LIBRARY_SCOPE.GLOBAL
  const code = args.input.procedure_code.trim().toUpperCase()
  const name = args.input.procedure_name.trim()

  if (!code || !name || !args.input.procedure_category.trim()) {
    throw new Error('procedure_code, procedure_name, and procedure_category are required.')
  }

  if (scope === LIBRARY_SCOPE.ORGANIZATION && !args.input.organization_id) {
    throw new Error('organization_id is required for organization-scoped procedures.')
  }

  if (scope === LIBRARY_SCOPE.GLOBAL && args.input.organization_id) {
    throw new Error('Global procedures cannot have organization_id.')
  }

  const { data, error } = await args.supabase
    .from('procedure_library')
    .insert({
      organization_id: scope === LIBRARY_SCOPE.ORGANIZATION ? args.input.organization_id : null,
      library_scope: scope,
      procedure_code: code,
      procedure_name: name,
      procedure_category: args.input.procedure_category.trim(),
      procedure_subcategory: args.input.procedure_subcategory?.trim() || null,
      description: args.input.description?.trim() || null,
      operational_description: args.input.operational_description?.trim() || null,
      source_template_enabled: args.input.source_template_enabled ?? true,
      requires_signature: args.input.requires_signature ?? false,
      requires_certified_copy: args.input.requires_certified_copy ?? false,
      supports_offsite: args.input.supports_offsite ?? false,
      procedure_complexity: args.input.procedure_complexity ?? 'standard',
      estimated_duration_minutes: args.input.estimated_duration_minutes ?? null,
      status: 'active',
      tags: args.input.tags ?? [],
      metadata: args.input.metadata ?? {},
      created_by: args.createdBy,
    })
    .select('*')
    .single()

  if (error || !data) {
    throw new Error(`Failed to create procedure: ${error?.message ?? 'Unknown error'}`)
  }

  return mapProcedureRow(data as Record<string, unknown>)
}
