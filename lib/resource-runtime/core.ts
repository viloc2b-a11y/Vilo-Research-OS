// TODO: Integrate with real Resource Runtime.
// Currently unimplemented. This acts as a thin explicit adapter interface
// to ensure the operational calendar does not fake runtime ownership.

import type { SupabaseClient } from '@supabase/supabase-js'

export type CreateResourceBlockArgs = {
  supabase: SupabaseClient
  organizationId: string
  studyId: string | null
  resourceCode: string
  startDatetime: string
  endDatetime: string
  allDay: boolean
}

export type UpdateResourceBlockArgs = {
  supabase: SupabaseClient
  resourceBlockId: string
  organizationId: string
  studyId: string | null
  startDatetime: string
  endDatetime: string
  allDay: boolean
}

export async function createResourceBlock(args: CreateResourceBlockArgs): Promise<{ id: string }> {
  const resource = await ResourceCatalogStore.findByCode(args.supabase, args.resourceCode, args.organizationId)
  if (!resource) {
    throw new Error('Resource not found in catalog.')
  }

  const { data, error } = await args.supabase
    .from('runtime_resource_blocks')
    .insert({
      organization_id: args.organizationId,
      study_id: args.studyId,
      resource_id: resource.id,
      start_datetime: args.startDatetime,
      end_datetime: args.endDatetime,
      all_day: args.allDay,
      status: 'ACTIVE'
    })
    .select('id')
    .single()

  if (error) {
    if (error.message.includes('no_overlapping_active_blocks')) {
      throw new Error('Resource is already blocked during this time.')
    }
    throw new Error(error.message)
  }

  return { id: data.id }
}

export async function updateResourceBlock(args: UpdateResourceBlockArgs): Promise<void> {
  const { error } = await args.supabase
    .from('runtime_resource_blocks')
    .update({
      study_id: args.studyId,
      start_datetime: args.startDatetime,
      end_datetime: args.endDatetime,
      all_day: args.allDay,
      updated_at: new Date().toISOString()
    })
    .eq('id', args.resourceBlockId)
    .eq('organization_id', args.organizationId)
    .eq('status', 'ACTIVE')

  if (error) {
    if (error.message.includes('no_overlapping_active_blocks')) {
      throw new Error('Resource is already blocked during this time.')
    }
    throw new Error(error.message)
  }
}

export async function cancelResourceBlock(supabase: SupabaseClient, id: string): Promise<void> {
  const { error } = await supabase
    .from('runtime_resource_blocks')
    .update({
      status: 'CANCELLED',
      cancelled_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq('id', id)
    
  if (error) {
    throw new Error(error.message)
  }
}

export const ResourceCatalogStore = {
  findByCode: async (supabase: SupabaseClient, code: string, organizationId: string): Promise<{ id: string, code: string } | null> => {
    const { data } = await supabase
      .from('runtime_resources')
      .select('id, code')
      .eq('code', code)
      .eq('organization_id', organizationId)
      .eq('status', 'ACTIVE')
      .maybeSingle()
    return data
  }
}

