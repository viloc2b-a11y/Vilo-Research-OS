import type { SupabaseClient } from '@supabase/supabase-js'
import type { SafetyTask } from './generate-safety-tasks'
import { NO_DEADLINE_SENTINEL } from './generate-safety-tasks'

/**
 * Persists generated tasks to `safety_event_tasks`.
 *
 * Idempotent: skips task types that already exist for the event so that
 * re-running after a partial failure or re-classification is safe.
 *
 * Note: `resolution_documentation` tasks have no hard deadline; the sentinel
 * date (9999-12-31) is stored and the UI renders it as "No deadline".
 */
export async function persistSafetyTasks(args: {
  supabase: SupabaseClient
  tasks: SafetyTask[]
}): Promise<void> {
  const { supabase, tasks } = args
  if (tasks.length === 0) return

  // All tasks belong to the same event (guaranteed by generateSafetyTasks).
  const safetyEventId = tasks[0].safety_event_id

  // Fetch already-persisted task types to avoid duplicates.
  const { data: existing, error: fetchError } = await supabase
    .from('safety_event_tasks')
    .select('task_type')
    .eq('safety_event_id', safetyEventId)

  if (fetchError) {
    throw new Error(`Failed to load existing safety tasks: ${fetchError.message}`)
  }

  const existingTypes = new Set((existing ?? []).map((r) => r.task_type as string))

  const rows = tasks
    .filter((t) => !existingTypes.has(t.task_type))
    .map((t) => ({
      organization_id: t.organization_id,
      safety_event_id: t.safety_event_id,
      task_type: t.task_type,
      due_date: (t.due_date ?? NO_DEADLINE_SENTINEL).toISOString().slice(0, 10),
      status: 'open',
    }))

  if (rows.length === 0) return

  const { error: insertError } = await supabase
    .from('safety_event_tasks')
    .insert(rows)

  if (insertError) {
    throw new Error(`Failed to persist safety tasks: ${insertError.message}`)
  }
}
