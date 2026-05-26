import type { SupabaseClient } from '@supabase/supabase-js'
import {
  mapRuntimeVisitRow,
  type CreateRuntimeVisitInput,
  type StudyRuntimeVisitRow,
} from './runtime-composition-types'

export type CreateRuntimeVisitArgs = {
  supabase: SupabaseClient
  input: CreateRuntimeVisitInput
  createdBy: string
}

export async function createRuntimeVisit(args: CreateRuntimeVisitArgs): Promise<StudyRuntimeVisitRow> {
  const visitCode = args.input.visit_code.trim().toUpperCase()
  const visitName = args.input.visit_name.trim()

  if (!visitCode || !visitName) {
    throw new Error('visit_code and visit_name are required.')
  }

  const { data: study, error: studyError } = await args.supabase
    .from('studies')
    .select('id')
    .eq('id', args.input.study_id)
    .eq('organization_id', args.input.organization_id)
    .maybeSingle()

  if (studyError) throw new Error(studyError.message)
  if (!study) throw new Error('Study not found in this organization.')

  const { data, error } = await args.supabase
    .from('study_runtime_visits')
    .insert({
      organization_id: args.input.organization_id,
      study_id: args.input.study_id,
      visit_code: visitCode,
      visit_name: visitName,
      visit_type: args.input.visit_type,
      study_day: args.input.study_day ?? null,
      window_before_days: args.input.window_before_days ?? null,
      window_after_days: args.input.window_after_days ?? null,
      sequence_order: args.input.sequence_order,
      allowed_modes: args.input.allowed_modes ?? ['onsite'],
      required: args.input.required ?? true,
      status: 'draft',
      operational_notes: args.input.operational_notes?.trim() || null,
      metadata: args.input.metadata ?? {},
      created_by: args.createdBy,
    })
    .select('*')
    .single()

  if (error || !data) {
    throw new Error(`Failed to create runtime visit: ${error?.message ?? 'Unknown error'}`)
  }

  return mapRuntimeVisitRow(data as Record<string, unknown>)
}
