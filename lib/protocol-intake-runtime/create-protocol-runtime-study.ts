import type { SupabaseClient } from '@supabase/supabase-js'
import {
  mapProtocolRuntimeStudyRow,
  type CreateProtocolRuntimeStudyInput,
  type ProtocolRuntimeStudyRow,
} from './protocol-intake-types'

export type CreateProtocolRuntimeStudyArgs = {
  supabase: SupabaseClient
  input: CreateProtocolRuntimeStudyInput
  createdBy: string
}

export async function createProtocolRuntimeStudy(
  args: CreateProtocolRuntimeStudyArgs,
): Promise<ProtocolRuntimeStudyRow> {
  const protocolNumber = args.input.protocol_number.trim()
  const protocolTitle = args.input.protocol_title.trim()
  if (!protocolNumber) throw new Error('protocol_number is required.')
  if (!protocolTitle) throw new Error('protocol_title is required.')

  const now = new Date().toISOString()
  const { data, error } = await args.supabase
    .from('protocol_runtime_studies')
    .insert({
      organization_id: args.input.organization_id,
      study_id: args.input.study_id ?? null,
      protocol_number: protocolNumber,
      protocol_title: protocolTitle,
      sponsor_name: args.input.sponsor_name ?? null,
      therapeutic_area: args.input.therapeutic_area ?? null,
      phase: args.input.phase ?? null,
      indication: args.input.indication ?? null,
      protocol_status: 'draft',
      current_protocol_version_id: null,
      source_document_id: args.input.source_document_id ?? null,
      metadata: {},
      created_by: args.createdBy,
      created_at: now,
      updated_at: now,
    })
    .select('*')
    .single()

  if (error || !data) {
    throw new Error(`Failed to create protocol runtime study: ${error?.message ?? 'Unknown error'}`)
  }

  return mapProtocolRuntimeStudyRow(data as Record<string, unknown>)
}

