import { getRuntimeProjectionServiceClient } from '@/lib/projections/runtime-projection-persist'
import type { GovernanceSignal } from '@/lib/governance-fabric/types'
import type { SupabaseClient } from '@supabase/supabase-js'

export async function syncGovernanceSignalsForVisit(input: {
  supabase: SupabaseClient
  signals: GovernanceSignal[]
  organizationId: string
  visitId: string
  studyId?: string
}): Promise<{ upserted: number; superseded: number }> {
  const detectedKeys = new Set(input.signals.map((s) => s.signalKey))
  const studyId = input.studyId ?? input.signals[0]?.studyId ?? null

  try {
    const supabase = await getRuntimeProjectionServiceClient()

    const { data: existing, error: readError } = await supabase
      .from('governance_signals')
      .select('id, signal_key, status')
      .eq('organization_id', input.organizationId)
      .eq('visit_id', input.visitId)
      .eq('status', 'open')

    if (readError) {
      console.warn('[runtime-projections] governance signal read failed', {
        table: 'governance_signals',
        organizationId: input.organizationId,
        visitId: input.visitId,
        studyId,
        message: readError.message,
      })
      return { upserted: 0, superseded: 0 }
    }

    let superseded = 0
    for (const row of existing ?? []) {
      if (!detectedKeys.has(row.signal_key as string)) {
        const { error: updateError } = await supabase
          .from('governance_signals')
          .update({ status: 'superseded' })
          .eq('id', row.id as string)
        if (updateError) {
          console.warn('[runtime-projections] governance signal supersede failed', {
            table: 'governance_signals',
            organizationId: input.organizationId,
            visitId: input.visitId,
            studyId,
            message: updateError.message,
          })
          continue
        }
        superseded += 1
      }
    }

    if (input.signals.length === 0) return { upserted: 0, superseded }

    const rows = input.signals.map((s) => ({
      organization_id: s.organizationId,
      study_id: s.studyId,
      study_subject_id: s.studySubjectId ?? null,
      visit_id: s.visitId ?? null,
      procedure_execution_id: s.procedureExecutionId ?? null,
      source_response_set_id: s.sourceResponseSetId ?? null,
      workflow_action_id: s.workflowActionId ?? null,
      operational_event_id: s.operationalEventId ?? null,
      signal_key: s.signalKey,
      signal_type: s.signalType,
      severity: s.severity,
      status: s.status,
      label: s.label,
      detail: s.detail,
      detected_at: s.detectedAt,
      derivation: s.derivation,
    }))

    const { error } = await supabase.from('governance_signals').upsert(rows, {
      onConflict: 'organization_id,signal_key',
    })

    if (error) {
      console.warn('[runtime-projections] governance signal persist failed', {
        table: 'governance_signals',
        organizationId: input.organizationId,
        visitId: input.visitId,
        studyId,
        message: error.message,
      })
      return { upserted: 0, superseded }
    }

    return { upserted: rows.length, superseded }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.warn('[runtime-projections] governance signal persist exception', {
      table: 'governance_signals',
      organizationId: input.organizationId,
      visitId: input.visitId,
      studyId,
      message,
    })
    return { upserted: 0, superseded: 0 }
  }
}

export function governanceSignalsToBlockers(
  signals: GovernanceSignal[],
): Array<{
  id: string
  category: string
  severity: 'blocker' | 'warning' | 'info'
  label: string
  detail: string
}> {
  return signals
    .filter((s) => s.status === 'open')
    .map((s) => ({
      id: `governance:${s.signalKey}`,
      category: 'governance',
      severity: s.severity === 'blocker' ? 'blocker' : s.severity === 'info' ? 'info' : 'warning',
      label: s.label,
      detail: s.detail,
    }))
}
