import type { SupabaseClient } from '@supabase/supabase-js'
import {
  mapProtocolRuntimeAmendmentLinkRow,
  type CreateAmendmentLinkInput,
  type ProtocolRuntimeAmendmentLinkRow,
} from './protocol-intake-types'

export type CreateAmendmentLinkArgs = {
  supabase: SupabaseClient
  input: CreateAmendmentLinkInput
  createdBy: string
}

export async function createAmendmentLink(
  args: CreateAmendmentLinkArgs,
): Promise<ProtocolRuntimeAmendmentLinkRow> {
  const now = new Date().toISOString()
  const { data, error } = await args.supabase
    .from('protocol_runtime_amendment_links')
    .insert({
      protocol_runtime_study_id: args.input.protocol_runtime_study_id,
      previous_protocol_version_id: args.input.previous_protocol_version_id,
      new_protocol_version_id: args.input.new_protocol_version_id,
      amendment_type: args.input.amendment_type ?? 'protocol_amendment',
      amendment_summary: args.input.amendment_summary ?? null,
      created_by: args.createdBy,
      created_at: now,
    })
    .select('*')
    .single()

  if (error || !data) {
    throw new Error(`Failed to create amendment link: ${error?.message ?? 'Unknown error'}`)
  }

  return mapProtocolRuntimeAmendmentLinkRow(data as Record<string, unknown>)
}

