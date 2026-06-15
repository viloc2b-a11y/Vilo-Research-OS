import type { SupabaseClient } from '@supabase/supabase-js'
import { recordLeadStageTransition } from '@/lib/crm/lead-stage-history'

export type LinkLeadToSubjectArgs = {
  supabase: SupabaseClient
  organizationId: string
  leadId: string
  studySubjectId: string
  actorId: string
}

export type LinkLeadToSubjectResult =
  | { ok: true }
  | { ok: false; error: string }

/**
 * Links a CRM patient lead to a study subject record.
 *
 * Updates `patient_leads.linked_subject_id` with the study subject UUID and
 * advances the lead stage to 'randomized' to reflect enrollment completion.
 * If the lead is already linked to a different subject, the link is replaced.
 */
export async function linkLeadToSubject(
  args: LinkLeadToSubjectArgs,
): Promise<LinkLeadToSubjectResult> {
  const { supabase, organizationId, leadId, studySubjectId, actorId } = args

  // Verify the subject exists and belongs to the organization
  const { data: subject, error: subjectError } = await supabase
    .from('study_subjects')
    .select('id, study_id, enrollment_status')
    .eq('id', studySubjectId)
    .eq('organization_id', organizationId)
    .maybeSingle()

  if (subjectError) {
    return { ok: false, error: subjectError.message }
  }
  if (!subject) {
    return { ok: false, error: 'Study subject not found or access denied.' }
  }

  // Fetch lead's current stage before updating (for stage history)
  const { data: lead } = await supabase
    .from('patient_leads')
    .select('stage')
    .eq('id', leadId)
    .eq('organization_id', organizationId)
    .maybeSingle()

  const previousStage = lead?.stage ? String(lead.stage) : null

  // Update the lead: set linked_subject_id and advance stage to randomized
  const { error: updateError } = await supabase
    .from('patient_leads')
    .update({
      linked_subject_id: studySubjectId,
      stage: 'randomized',
    })
    .eq('id', leadId)
    .eq('organization_id', organizationId)

  if (updateError) {
    return { ok: false, error: updateError.message }
  }

  // I2: write reverse attribution on study_subjects
  await supabase
    .from('study_subjects')
    .update({ patient_lead_id: leadId })
    .eq('id', studySubjectId)
    .eq('organization_id', organizationId)

  // I3: record stage transition in CRM v1 history
  await recordLeadStageTransition({
    supabase,
    organizationId,
    leadId,
    fromStage: previousStage,
    toStage: 'randomized',
    actorId: actorId ?? null,
    reason: 'Linked to study subject — enrollment confirmed.',
    metadata: { studySubjectId, studyId: String(subject.study_id) },
  })

  return { ok: true }
}
