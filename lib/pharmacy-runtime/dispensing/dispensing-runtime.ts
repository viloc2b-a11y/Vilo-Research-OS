'use server'

import { randomUUID } from 'crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createServerClient } from '@/lib/supabase/server'
import { assertPharmacyActionGate } from '../actions/access'
import { loadActivePharmacyDispensingBlueprint } from './blueprint-rules'
import { appendPharmacyDispensingAudit } from './audit'
import type { DispensationReviewInput, VisitLinkedDispensingInput } from './types'

export async function createVisitLinkedDispensation(
  input: VisitLinkedDispensingInput,
  supabase?: SupabaseClient,
) {
  const client = supabase ?? (await createServerClient())
  const gate = await assertPharmacyActionGate({
    studyId: input.studyId,
    siteId: input.siteId,
    action: 'dispense',
    resourceType: 'ip_dispensation',
    resourceId: input.procedureInstanceId,
    supabase: client,
  })
  const blueprint = await loadActivePharmacyDispensingBlueprint(client, input.studyId, input.siteId)
  await assertVisitProcedureContext(client, input)
  const dispensationId = randomUUID()

  const { error } = await client
    .from('ip_dispensations')
    .insert({
      id: dispensationId,
      organization_id: input.organizationId,
      study_id: input.studyId,
      site_id: input.siteId ?? null,
      blueprint_id: blueprint.id,
      subject_id: input.subjectId,
      visit_instance_id: input.visitInstanceId,
      procedure_instance_id: input.procedureInstanceId,
      subject_assignment_id: input.subjectAssignmentId ?? null,
      kit_id: input.kitId ?? null,
      lot_id: input.lotId ?? null,
      dispensation_status: 'dispensed',
      dispensed_by: gate.actorId,
      signature_id: input.signatureId ?? null,
      supporting_document_id: input.supportingDocumentId ?? null,
      masked_operational_facts: input.maskedOperationalFacts ?? {
        subject_matched: true,
        visit_matched: true,
        medication_dispensed: true,
      },
      metadata: {
        visit_linked: true,
        procedure_runtime_execution: true,
        inventory_source_of_truth: 'ip_ledger_events',
      },
    })

  if (error) throw new Error(error.message)

  const review = await createDispensationReviewObligation(
    client,
    {
      organizationId: input.organizationId,
      studyId: input.studyId,
      siteId: input.siteId,
      subjectId: input.subjectId,
      visitInstanceId: input.visitInstanceId,
      procedureInstanceId: input.procedureInstanceId,
      dispensationId,
      executionMode: blueprint.reviewExecutionMode,
      dueAt: resolveReviewDueAt(blueprint.reviewExecutionMode, blueprint.reviewWindowHours),
      protocolBasis: blueprint.protocolBasis,
      metadata: {
        review_window_hours: blueprint.reviewWindowHours,
      },
    },
    gate.actorId,
  )

  await appendPharmacyDispensingAudit(client, {
    organizationId: input.organizationId,
    studyId: input.studyId,
    siteId: input.siteId,
    subjectId: input.subjectId,
    visitInstanceId: input.visitInstanceId,
    procedureInstanceId: input.procedureInstanceId,
    dispensationId,
    reviewConfirmationId: review?.id ? String(review.id) : null,
    actorId: gate.actorId,
    eventType: 'visit_linked_dispensation_recorded',
    eventPayload: {
      execution_mode: blueprint.reviewExecutionMode,
      command_center_integrated: true,
      no_independent_pharmacy_queue: true,
    },
  })

  if (blueprint.reviewExecutionMode === 'real_time_required' && review?.review_status !== 'reviewed') {
    return {
      ok: false as const,
      dispensation: { id: dispensationId, dispensation_status: 'dispensed' },
      review,
      blocked: true,
      message: 'Real-time secondary CRC review is required before dispensation can complete.',
    }
  }

  return { ok: true as const, dispensation: { id: dispensationId, dispensation_status: 'dispensed' }, review, blocked: false }
}

async function createDispensationReviewObligation(
  supabase: SupabaseClient,
  input: DispensationReviewInput,
  primaryCrcId: string,
) {
  if (input.executionMode === 'not_required') {
    return null
  }
  const reviewId = randomUUID()
  const blueprintId = await activeBlueprintId(supabase, input.studyId, input.siteId)

  const { error } = await supabase
    .from('ip_dispensation_review_confirmations')
    .insert({
      id: reviewId,
      organization_id: input.organizationId,
      study_id: input.studyId,
      site_id: input.siteId ?? null,
      blueprint_id: blueprintId,
      subject_id: input.subjectId,
      visit_instance_id: input.visitInstanceId,
      procedure_instance_id: input.procedureInstanceId,
      dispensation_id: input.dispensationId,
      execution_mode: input.executionMode,
      review_status: input.executionMode === 'optional' ? 'pending' : 'pending',
      primary_crc_id: primaryCrcId,
      due_at: input.dueAt ?? null,
      protocol_basis: input.protocolBasis,
      metadata: input.metadata ?? {},
    })

  if (error) throw new Error(error.message)
  return {
    id: reviewId,
    execution_mode: input.executionMode,
    review_status: 'pending',
    due_at: input.dueAt ?? null,
  }
}

async function activeBlueprintId(supabase: SupabaseClient, studyId: string, siteId?: string | null) {
  const blueprint = await loadActivePharmacyDispensingBlueprint(supabase, studyId, siteId)
  return blueprint.id
}

async function assertVisitProcedureContext(supabase: SupabaseClient, input: VisitLinkedDispensingInput) {
  const { data, error } = await supabase
    .from('procedure_runtime_instances')
    .select('id,study_id,subject_id,visit_instance_id,procedure_status')
    .eq('id', input.procedureInstanceId)
    .eq('visit_instance_id', input.visitInstanceId)
    .eq('subject_id', input.subjectId)
    .eq('study_id', input.studyId)
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (!data) throw new Error('Dispensing must be linked to the correct subject, visit, and procedure runtime.')
}

function resolveReviewDueAt(mode: string, hours: number | null) {
  if (mode !== 'asynchronous_required' || !hours) return null
  return new Date(Date.now() + hours * 60 * 60 * 1000).toISOString()
}
