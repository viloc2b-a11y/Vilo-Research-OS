import type { SupabaseClient } from '@supabase/supabase-js'

export async function appendPharmacyDispensingAudit(
  supabase: SupabaseClient,
  input: {
    organizationId: string
    studyId: string
    siteId?: string | null
    subjectId?: string | null
    visitInstanceId?: string | null
    procedureInstanceId?: string | null
    dispensationId?: string | null
    administrationEventId?: string | null
    reviewConfirmationId?: string | null
    actorId?: string | null
    eventType: string
    eventPayload?: Record<string, unknown>
  },
) {
  const { error } = await supabase.from('pharmacy_dispensing_audit_events').insert({
    organization_id: input.organizationId,
    study_id: input.studyId,
    site_id: input.siteId ?? null,
    subject_id: input.subjectId ?? null,
    visit_instance_id: input.visitInstanceId ?? null,
    procedure_instance_id: input.procedureInstanceId ?? null,
    dispensation_id: input.dispensationId ?? null,
    administration_event_id: input.administrationEventId ?? null,
    review_confirmation_id: input.reviewConfirmationId ?? null,
    actor_id: input.actorId ?? null,
    event_type: input.eventType,
    event_payload: input.eventPayload ?? {},
  })
  if (error) throw new Error(error.message)
}
