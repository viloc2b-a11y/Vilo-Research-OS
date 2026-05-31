'use server'

import type { SupabaseClient } from '@supabase/supabase-js'
import { createServerClient } from '@/lib/supabase/server'
import { assertPharmacyActionGate } from '../actions/access'
import { loadActivePharmacyDispensingBlueprint } from './blueprint-rules'
import { appendPharmacyDispensingAudit } from './audit'
import type { PharmacySubjectAssignmentInput } from './types'

export async function deriveSubjectAssignmentFromBlueprint(
  input: PharmacySubjectAssignmentInput,
  supabase?: SupabaseClient,
) {
  const client = supabase ?? (await createServerClient())
  const gate = await assertPharmacyActionGate({
    studyId: input.studyId,
    siteId: input.siteId,
    action: 'dispense',
    resourceType: 'pharmacy_subject_assignment',
    resourceId: input.subjectId,
    supabase: client,
  })
  const blueprint = await loadActivePharmacyDispensingBlueprint(client, input.studyId, input.siteId)
  const assignmentSource = input.manualExceptionReason ? 'manual_exception' : 'activated_blueprint'

  const { data, error } = await client
    .from('pharmacy_subject_assignments')
    .insert({
      organization_id: input.organizationId,
      study_id: input.studyId,
      site_id: input.siteId ?? null,
      blueprint_id: blueprint.id,
      subject_id: input.subjectId,
      randomization_id: input.randomizationId ?? null,
      assignment_required: blueprint.assignment.assignmentRequired,
      assignment_strategy: blueprint.assignment.assignmentStrategy,
      assignment_timing: blueprint.assignment.assignmentTiming,
      randomization_dependency: blueprint.assignment.randomizationDependency,
      dispensing_eligibility_rules: blueprint.assignment.dispensingEligibilityRules,
      assignment_source: assignmentSource,
      assignment_status: blueprint.assignment.assignmentRequired ? 'eligible' : 'assigned',
      assigned_by: gate.actorId,
      manual_exception_reason: input.manualExceptionReason ?? null,
      metadata: { blueprint_protocol_basis: blueprint.protocolBasis },
    })
    .select('*')
    .single()

  if (error || !data) throw new Error(error?.message ?? 'Failed to derive Pharmacy subject assignment.')

  await appendPharmacyDispensingAudit(client, {
    organizationId: input.organizationId,
    studyId: input.studyId,
    siteId: input.siteId,
    subjectId: input.subjectId,
    actorId: gate.actorId,
    eventType: 'subject_assignment_derived_from_blueprint',
    eventPayload: {
      assignment_id: data.id,
      assignment_source: assignmentSource,
      assignment_strategy: blueprint.assignment.assignmentStrategy,
      randomization_dependency: blueprint.assignment.randomizationDependency,
    },
  })

  return data
}
