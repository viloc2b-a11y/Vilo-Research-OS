import type { SupabaseClient } from '@supabase/supabase-js'
import {
  mapProtocolRuntimeVersionRow,
  type CreateProtocolVersionInput,
  type ProtocolRuntimeVersionRow,
} from './protocol-intake-types'

export type CreateProtocolVersionArgs = {
  supabase: SupabaseClient
  input: CreateProtocolVersionInput
  createdBy: string
}

export async function createProtocolVersion(
  args: CreateProtocolVersionArgs,
): Promise<ProtocolRuntimeVersionRow> {
  const versionLabel = args.input.version_label.trim()
  if (!versionLabel) throw new Error('version_label is required.')

  const now = new Date().toISOString()
  const { data: row, error } = await args.supabase
    .from('protocol_runtime_versions')
    .insert({
      protocol_runtime_study_id: args.input.protocol_runtime_study_id,
      version_label: versionLabel,
      amendment_number: args.input.amendment_number ?? null,
      version_date: args.input.version_date ?? null,
      source_document_id: args.input.source_document_id,
      raw_text: {},
      extraction_status: 'pending',
      extraction_metadata: {},
      previous_version_id: args.input.previous_version_id ?? null,
      created_by: args.createdBy,
      created_at: now,
    })
    .select('*')
    .single()

  if (error || !row) {
    throw new Error(`Failed to create protocol version: ${error?.message ?? 'Unknown error'}`)
  }

  // If this is the newest version, update pointer (mutable).
  await args.supabase
    .from('protocol_runtime_studies')
    .update({ current_protocol_version_id: row.id, updated_at: now })
    .eq('id', args.input.protocol_runtime_study_id)
    .eq('organization_id', args.input.organization_id)

  return mapProtocolRuntimeVersionRow(row as Record<string, unknown>)
}

