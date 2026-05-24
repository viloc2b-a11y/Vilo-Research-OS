import type { CapaPlaceholder, GovernanceSignal } from '@/lib/governance-fabric/types'
import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * CAPA placeholder architecture only — no workflow, routing, or closure in Phase 4.
 * Future CAPA module will promote placeholders to tracked corrective actions.
 */
export async function createCapaPlaceholderForSignal(input: {
  supabase: SupabaseClient
  signal: GovernanceSignal
  title?: string
}): Promise<CapaPlaceholder> {
  const title =
    input.title?.trim()
    || `CAPA placeholder: ${input.signal.label}`

  const { data, error } = await input.supabase
    .from('governance_capa_placeholders')
    .insert({
      organization_id: input.signal.organizationId,
      study_id: input.signal.studyId,
      study_subject_id: input.signal.studySubjectId ?? null,
      governance_signal_id: null,
      status: 'placeholder',
      title,
      metadata: {
        phase: 4,
        placeholder_only: true,
        signal_key: input.signal.signalKey,
        signal_type: input.signal.signalType,
        derivation: input.signal.derivation,
      },
    })
    .select('id, organization_id, study_id, study_subject_id, status, title, metadata')
    .single()

  if (error || !data) {
    throw new Error(error?.message ?? 'Failed to create CAPA placeholder.')
  }

  const placeholderId = data.id as string

  await input.supabase
    .from('governance_signals')
    .update({ capa_placeholder_id: placeholderId })
    .eq('organization_id', input.signal.organizationId)
    .eq('signal_key', input.signal.signalKey)

  return {
    id: placeholderId,
    organizationId: data.organization_id as string,
    studyId: data.study_id as string,
    studySubjectId: (data.study_subject_id as string | null) ?? null,
    governanceSignalId: input.signal.signalKey,
    status: 'placeholder',
    title: data.title as string,
    metadata: (data.metadata as Record<string, unknown>) ?? {},
  }
}

export const CAPA_PLACEHOLDER_ARCHITECTURE = {
  phase: 4,
  statusValues: ['placeholder', 'draft', 'active', 'closed'] as const,
  capabilities: [
    'link_placeholder_to_governance_signal',
    'store_metadata_for_future_capa_module',
  ],
  deferred: [
    'capa_workflow_states',
    'assignee_routing',
    'effectiveness_checks',
    'sponsor_reporting',
  ],
} as const
