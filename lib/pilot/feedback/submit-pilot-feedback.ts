/**
 * Append-only pilot feedback intake (API-ready; no coordinator UI in this phase).
 */

import { redactTelemetryMetadata } from '@/lib/observability/redact-telemetry-metadata'
import type { SupabaseClient } from '@supabase/supabase-js'

export type SubmitPilotFeedbackInput = {
  supabase: SupabaseClient
  actorId: string
  organizationId: string
  studyId?: string | null
  studySubjectId?: string | null
  visitId?: string | null
  currentUrl: string
  feedbackText: string
  runtimeContext?: Record<string, unknown> | null
}

export type SubmitPilotFeedbackResult =
  | { ok: true; feedbackId: string }
  | { ok: false; reason: string }

/**
 * Insert-only; never throws to coordinator caller.
 */
export async function submitPilotFeedback(
  input: SubmitPilotFeedbackInput,
): Promise<SubmitPilotFeedbackResult> {
  try {
    const runtimeContext =
      input.runtimeContext != null
        ? redactTelemetryMetadata(input.runtimeContext)
        : null

    const { data, error } = await input.supabase
      .from('pilot_feedback')
      .insert({
        actor_id: input.actorId,
        organization_id: input.organizationId,
        study_id: input.studyId ?? null,
        study_subject_id: input.studySubjectId ?? null,
        visit_id: input.visitId ?? null,
        current_url: input.currentUrl,
        feedback_text: input.feedbackText,
        runtime_context: runtimeContext,
      })
      .select('id')
      .single()

    if (error) {
      return { ok: false, reason: error.message }
    }

    return { ok: true, feedbackId: data.id as string }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return { ok: false, reason: message }
  }
}
