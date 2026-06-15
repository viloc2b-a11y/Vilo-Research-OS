import type { SupabaseClient } from '@supabase/supabase-js'
import type { GovernanceSignal, GovernanceSignalType } from '@/lib/governance-fabric/types'
import type { DeviationType, DeviationSeverity } from '@/lib/protocol-deviations/deviation-types'
import { createDeviation } from '@/lib/protocol-deviations/create-deviation'
import { createCapaAction } from '@/lib/capa-runtime/create-capa-action'

export type PromoteGovernanceSignalResult =
  | { ok: true; deviationId: string; capaId: string; alreadyLinked: false }
  | { ok: true; deviationId: string; capaId: string; alreadyLinked: true }
  | { ok: false; reason: 'not_eligible' | 'missing_subject' | 'error'; detail: string }

function mapSignalTypeToDeviationType(signalType: GovernanceSignalType): DeviationType {
  const map: Record<GovernanceSignalType, DeviationType> = {
    visit_window_deviation: 'visit_window_violation',
    missing_source_at_signoff: 'missed_procedure',
    unresolved_finding_at_closeout: 'other',
    unresolved_ae_at_signoff: 'other',
    protocol_graph_blocker_unresolved: 'protocol_exception',
    open_query_unresolved: 'other',
    safety_continuity_elevated: 'other',
  }
  return map[signalType] ?? 'other'
}

function mapSeverityToDeviationSeverity(
  severity: 'blocker' | 'warning',
): DeviationSeverity {
  return severity === 'blocker' ? 'major' : 'minor'
}

export async function promoteGovernanceSignalToCapaCandidate(args: {
  supabase: SupabaseClient
  signal: GovernanceSignal
  actorId: string
  correctiveAction?: string
}): Promise<PromoteGovernanceSignalResult> {
  const { supabase, signal, actorId } = args

  // 1. Eligibility check
  if (signal.severity === 'info') {
    return {
      ok: false,
      reason: 'not_eligible',
      detail: 'Info-level signals do not generate CAPA candidates.',
    }
  }

  // 2. Subject requirement
  if (!signal.studySubjectId) {
    return {
      ok: false,
      reason: 'missing_subject',
      detail: 'Governance signal has no study subject context. Cannot create protocol deviation.',
    }
  }

  // 3. Idempotency check
  const { data: signalRow } = await supabase
    .from('governance_signals')
    .select('capa_deviation_id')
    .eq('organization_id', signal.organizationId)
    .eq('signal_key', signal.signalKey)
    .maybeSingle()

  if (signalRow?.capa_deviation_id) {
    const { data: capaRow } = await supabase
      .from('capa_actions')
      .select('id')
      .eq('deviation_id', signalRow.capa_deviation_id)
      .maybeSingle()

    return {
      ok: true,
      deviationId: signalRow.capa_deviation_id as string,
      capaId: (capaRow?.id as string) ?? '',
      alreadyLinked: true,
    }
  }

  // 4-8. Create deviation, CAPA action, write back
  try {
    const deviationType = mapSignalTypeToDeviationType(signal.signalType)
    const deviationSeverity = mapSeverityToDeviationSeverity(
      signal.severity as 'blocker' | 'warning',
    )

    // 6. Create deviation
    const deviation = await createDeviation(supabase, actorId, {
      organizationId: signal.organizationId,
      studyId: signal.studyId,
      subjectId: signal.studySubjectId,
      visitId: signal.visitId ?? null,
      deviationType,
      severity: deviationSeverity,
      description: `${signal.label}: ${signal.detail}`,
      metadata: {
        governance_signal_key: signal.signalKey,
        signal_type: signal.signalType,
        derivation: signal.derivation,
      },
    })

    // 7. Create CAPA action
    const capa = await createCapaAction(supabase, actorId, {
      organizationId: signal.organizationId,
      studyId: signal.studyId,
      deviationId: deviation.id,
      correctiveAction:
        args.correctiveAction ?? `Review and remediate: ${signal.label}`,
      metadata: {
        source: 'governance_signal_promotion',
        signal_key: signal.signalKey,
      },
    })

    // 8. Write back capa_deviation_id to governance_signals
    await supabase
      .from('governance_signals')
      .update({ capa_deviation_id: deviation.id })
      .eq('organization_id', signal.organizationId)
      .eq('signal_key', signal.signalKey)

    return {
      ok: true,
      deviationId: deviation.id,
      capaId: capa.id,
      alreadyLinked: false,
    }
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err)
    return { ok: false, reason: 'error', detail }
  }
}
