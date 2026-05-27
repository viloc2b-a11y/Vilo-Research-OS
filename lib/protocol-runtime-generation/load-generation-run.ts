import type { SupabaseClient } from '@supabase/supabase-js'
import { mapGenerationEventRow, mapGenerationRunRow } from './protocol-runtime-generation-types'

export async function loadGenerationRun(args: {
  supabase: SupabaseClient
  organizationId: string
  runId: string
}): Promise<{
  run: ReturnType<typeof mapGenerationRunRow>
  events: ReturnType<typeof mapGenerationEventRow>[]
} | null> {
  const { data: runRow, error: runError } = await args.supabase
    .from('protocol_runtime_generation_runs')
    .select('*')
    .eq('id', args.runId)
    .eq('organization_id', args.organizationId)
    .maybeSingle()

  if (runError) throw new Error(runError.message)
  if (!runRow) return null

  const run = mapGenerationRunRow(runRow as Record<string, unknown>)

  const { data: eventRows, error: eventError } = await args.supabase
    .from('protocol_runtime_generation_events')
    .select('*')
    .eq('generation_run_id', run.id)
    .order('event_timestamp', { ascending: false })
    .limit(200)

  if (eventError) throw new Error(eventError.message)

  return {
    run,
    events: (eventRows ?? []).map((row) => mapGenerationEventRow(row as Record<string, unknown>)),
  }
}

