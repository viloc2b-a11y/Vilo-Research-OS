import type { SupabaseClient } from '@supabase/supabase-js'
import { createDeviation } from '@/lib/protocol-deviations/create-deviation'
import { DEVIATION_TYPE, DEVIATION_SEVERITY, type ProtocolDeviationRow } from '@/lib/protocol-deviations/deviation-types'
import { SAFETY_EVENT_TYPE, type SafetyEventRow } from './safety-types'

function mapSeverityToDeviation(
  severity: SafetyEventRow['severity'],
): (typeof DEVIATION_SEVERITY)[keyof typeof DEVIATION_SEVERITY] {
  if (severity === 'severe') return DEVIATION_SEVERITY.CRITICAL
  return DEVIATION_SEVERITY.MAJOR
}

/**
 * Idempotent bridge: when a safety event is classified as SAE, create a
 * corresponding protocol deviation with bidirectional metadata linkage.
 * Returns the existing deviation if one already exists for this event.
 */
export async function triggerSafetyDeviationBridge(args: {
  supabase: SupabaseClient
  safetyEvent: SafetyEventRow
  actorId: string
}): Promise<ProtocolDeviationRow | null> {
  const { supabase, safetyEvent, actorId } = args

  if (safetyEvent.eventType !== SAFETY_EVENT_TYPE.SAE) return null

  // Idempotency: check if a deviation was already created for this SAE.
  const { data: existing } = await supabase
    .from('protocol_deviations')
    .select('*')
    .eq('organization_id', safetyEvent.organizationId)
    .contains('metadata', { source_type: 'SAFETY_EVENT', source_id: safetyEvent.id })
    .maybeSingle()

  if (existing) {
    // Return existing without re-importing mapper to avoid circular dep.
    return existing as unknown as ProtocolDeviationRow
  }

  const deviation = await createDeviation(supabase, actorId, {
    organizationId: safetyEvent.organizationId,
    studyId: safetyEvent.studyId,
    subjectId: safetyEvent.subjectId,
    visitId: safetyEvent.visitId ?? null,
    deviationType: DEVIATION_TYPE.OTHER,
    severity: mapSeverityToDeviation(safetyEvent.severity),
    description: `SAE-originated deviation: ${safetyEvent.description}`,
    requiresSponsorNotification: true,
    requiresIrbNotification: true,
    metadata: {
      source_type: 'SAFETY_EVENT',
      source_id: safetyEvent.id,
    },
  })

  return deviation
}
