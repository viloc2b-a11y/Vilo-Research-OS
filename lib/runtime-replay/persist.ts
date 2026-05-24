import type { RuntimeReplayArtifact } from '@/lib/runtime-replay/types'
import type { SupabaseClient } from '@supabase/supabase-js'

export async function persistRuntimeReplayArtifact(
  supabase: SupabaseClient,
  artifact: RuntimeReplayArtifact,
): Promise<string> {
  const { data: existing } = await supabase
    .from('runtime_replay_artifacts')
    .select('replay_version')
    .eq('scope', artifact.scope)
    .eq('scope_id', artifact.scopeId)
    .order('replay_version', { ascending: false })
    .limit(1)
    .maybeSingle()

  const replayVersion = (existing?.replay_version as number | undefined ?? 0) + 1

  const { data, error } = await supabase
    .from('runtime_replay_artifacts')
    .insert({
      organization_id: artifact.organizationId,
      study_id: artifact.studyId,
      scope: artifact.scope,
      scope_id: artifact.scopeId,
      replay_version: replayVersion,
      computed_at: artifact.computedAt,
      timeline_document: { segments: artifact.timeline },
      causality_chain: artifact.causalityChain,
      explanations: artifact.explanations,
      source_event_count: artifact.sourceEventCount,
    })
    .select('id')
    .single()

  if (error) throw new Error(error.message)
  return data?.id as string
}
