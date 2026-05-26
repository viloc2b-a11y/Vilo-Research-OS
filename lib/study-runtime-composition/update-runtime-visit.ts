import type { SupabaseClient } from '@supabase/supabase-js'
import {
  mapRuntimeVisitRow,
  type StudyRuntimeVisitRow,
  type UpdateRuntimeVisitInput,
} from './runtime-composition-types'

export type UpdateRuntimeVisitArgs = {
  supabase: SupabaseClient
  organizationId: string
  studyId: string
  visitId: string
  input: UpdateRuntimeVisitInput
}

export async function updateRuntimeVisit(args: UpdateRuntimeVisitArgs): Promise<StudyRuntimeVisitRow> {
  const patch: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  }

  if (args.input.visit_code !== undefined) patch.visit_code = args.input.visit_code.trim().toUpperCase()
  if (args.input.visit_name !== undefined) patch.visit_name = args.input.visit_name.trim()
  if (args.input.visit_type !== undefined) patch.visit_type = args.input.visit_type
  if (args.input.study_day !== undefined) patch.study_day = args.input.study_day
  if (args.input.window_before_days !== undefined) patch.window_before_days = args.input.window_before_days
  if (args.input.window_after_days !== undefined) patch.window_after_days = args.input.window_after_days
  if (args.input.sequence_order !== undefined) patch.sequence_order = args.input.sequence_order
  if (args.input.allowed_modes !== undefined) patch.allowed_modes = args.input.allowed_modes
  if (args.input.required !== undefined) patch.required = args.input.required
  if (args.input.status !== undefined) patch.status = args.input.status
  if (args.input.operational_notes !== undefined) {
    patch.operational_notes = args.input.operational_notes?.trim() || null
  }
  if (args.input.metadata !== undefined) patch.metadata = args.input.metadata

  const { data, error } = await args.supabase
    .from('study_runtime_visits')
    .update(patch)
    .eq('id', args.visitId)
    .eq('study_id', args.studyId)
    .eq('organization_id', args.organizationId)
    .select('*')
    .single()

  if (error || !data) {
    throw new Error(`Failed to update runtime visit: ${error?.message ?? 'Unknown error'}`)
  }

  return mapRuntimeVisitRow(data as Record<string, unknown>)
}
