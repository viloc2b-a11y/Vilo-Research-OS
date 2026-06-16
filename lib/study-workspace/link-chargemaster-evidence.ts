import type { SupabaseClient } from '@supabase/supabase-js'
import {
  appendStudyBudgetNegotiationEvent,
} from '@/lib/study-workspace/load-budget-evidence-summary'

export type ChargemasterEvidenceInput = {
  supabase: SupabaseClient
  organizationId: string
  studyId: string
  actorUserId: string
  chargemasterSummary: {
    visitRevenue: number
    totalMinimumBudget: number
    askPrice: number
    batnaFloor: number
    certaintyLevel: string
  }
  studyParameters: {
    totalVisits: number
    totalPatients: number
  }
}

export type ChargemasterEvidenceLinkResult =
  | { ok: true; eventId: string }
  | { ok: false; error: string }

export async function linkChargemasterAsEvidence(
  input: ChargemasterEvidenceInput,
): Promise<ChargemasterEvidenceLinkResult> {
  try {
    const { data: existingEvents } = await input.supabase
      .from('study_budget_negotiation_events')
      .select('negotiation_round')
      .eq('organization_id', input.organizationId)
      .eq('study_id', input.studyId)
      .order('negotiation_round', { ascending: false })
      .limit(1)

    const currentRound = (existingEvents?.[0]?.negotiation_round as number | undefined) ?? 1

    const event = await appendStudyBudgetNegotiationEvent({
      supabase: input.supabase,
      organizationId: input.organizationId,
      studyId: input.studyId,
      eventType: 'evidence_linked',
      title: 'Chargemaster computed',
      summary: `Site chargemaster computed. Ask price: ${input.chargemasterSummary.askPrice}. Certainty: ${input.chargemasterSummary.certaintyLevel}.`,
      ownerRole: 'finance',
      negotiationRound: currentRound,
      actorUserId: input.actorUserId,
      eventPayload: {
        type: 'chargemaster_evidence',
        chargemaster: input.chargemasterSummary,
        study_parameters: input.studyParameters,
        linked_at: new Date().toISOString(),
      },
    })

    return { ok: true, eventId: event.id }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  }
}
