import type { SupabaseClient } from '@supabase/supabase-js'
import {
  GENERATION_STATUS,
  mapGenerationRunRow,
  type CreateGenerationRunInput,
  type ProtocolRuntimeGenerationRunRow,
} from './protocol-runtime-generation-types'

export async function createGenerationRun(args: {
  supabase: SupabaseClient
  input: CreateGenerationRunInput
  generatedBy: string
  sourceSummary?: Record<string, unknown>
  metadata?: Record<string, unknown>
}): Promise<ProtocolRuntimeGenerationRunRow> {
  const { data, error } = await args.supabase
    .from('protocol_runtime_generation_runs')
    .insert({
      organization_id: args.input.organization_id,
      protocol_version_id: args.input.protocol_version_id,
      protocol_runtime_study_id: args.input.protocol_runtime_study_id,
      study_id: args.input.study_id,
      generation_status: GENERATION_STATUS.DRAFT,
      generated_by: args.generatedBy,
      source_summary: args.sourceSummary ?? {},
      result_summary: {},
      validation_errors: [],
      metadata: args.metadata ?? {},
    })
    .select('*')
    .single()

  if (error || !data) throw new Error(error?.message ?? 'Failed to create generation run')
  return mapGenerationRunRow(data as Record<string, unknown>)
}

