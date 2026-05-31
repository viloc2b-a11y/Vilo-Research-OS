import type { SupabaseClient } from '@supabase/supabase-js'
import type { DispensingCommandCenterItem } from './types'

export async function loadDispensingCommandCenterActions(
  supabase: SupabaseClient,
  studyId: string,
  subjectIds: string[],
): Promise<Map<string, DispensingCommandCenterItem[]>> {
  if (subjectIds.length === 0) return new Map()

  const { data, error } = await supabase
    .from('ip_dispensation_command_center_actions')
    .select(
      'subject_id,visit_instance_id,procedure_instance_id,dispensation_id,review_confirmation_id,action_required,execution_mode,due_at',
    )
    .eq('study_id', studyId)
    .in('subject_id', subjectIds)
    .not('action_required', 'is', null)

  if (error) throw new Error(error.message)

  const bySubject = new Map<string, DispensingCommandCenterItem[]>()
  for (const row of data ?? []) {
    const item: DispensingCommandCenterItem = {
      subjectId: String(row.subject_id),
      visitInstanceId: String(row.visit_instance_id),
      procedureInstanceId: String(row.procedure_instance_id),
      dispensationId: String(row.dispensation_id),
      reviewConfirmationId: String(row.review_confirmation_id),
      actionRequired: row.action_required as DispensingCommandCenterItem['actionRequired'],
      executionMode: row.execution_mode as DispensingCommandCenterItem['executionMode'],
      dueAt: row.due_at ? String(row.due_at) : null,
    }
    const list = bySubject.get(item.subjectId) ?? []
    list.push(item)
    bySubject.set(item.subjectId, list)
  }

  return bySubject
}

export function highestPriorityDispensingAction(items: DispensingCommandCenterItem[]) {
  const priority = new Map<string, number>([
    ['Waiver Requires Approval', 0],
    ['Review Overdue', 1],
    ['Review Due Today', 2],
    ['Review Dispensation', 3],
  ])
  return [...items].sort((a, b) => (priority.get(a.actionRequired) ?? 99) - (priority.get(b.actionRequired) ?? 99))[0] ?? null
}
