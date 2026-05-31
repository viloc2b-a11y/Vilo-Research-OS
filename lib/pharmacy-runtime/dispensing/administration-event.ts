'use server'

import { randomUUID } from 'crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createServerClient } from '@/lib/supabase/server'
import { appendVisitRuntimeEvent, buildStateSnapshot } from '@/lib/visit-runtime-execution/append-visit-runtime-event'
import { loadVisitWorkspace } from '@/lib/visit-runtime-execution/load-visit-workspace'
import { VISIT_RUNTIME_EVENT_TYPE } from '@/lib/visit-runtime-execution/visit-runtime-types'
import { assertPharmacyActionGate } from '../actions/access'
import { loadActivePharmacyDispensingBlueprint } from './blueprint-rules'
import { appendPharmacyDispensingAudit } from './audit'
import type { AdministrationEventInput } from './types'

export async function recordAdministrationEventInsideVisitRuntime(
  input: AdministrationEventInput,
  supabase?: SupabaseClient,
) {
  const client = supabase ?? (await createServerClient())
  const gate = await assertPharmacyActionGate({
    studyId: input.studyId,
    siteId: input.siteId,
    action: 'dispense',
    resourceType: 'ip_administration_event',
    resourceId: input.procedureInstanceId,
    supabase: client,
  })
  const blueprint = await loadActivePharmacyDispensingBlueprint(client, input.studyId, input.siteId)
  const workspace = await loadVisitWorkspace(client, input.organizationId, input.visitInstanceId)
  if (!workspace) throw new Error('Administration must execute inside an existing Visit Runtime instance.')

  const procedure = workspace.procedureInstances.find((item) => item.id === input.procedureInstanceId)
  if (!procedure || procedure.subjectId !== input.subjectId || procedure.studyId !== input.studyId) {
    throw new Error('Administration must execute inside the matching Procedure Runtime instance.')
  }

  const administrationEventId = randomUUID()
  const administeredAt = input.administeredAt ?? new Date().toISOString()
  const { error } = await client
    .from('ip_administration_events')
    .insert({
      id: administrationEventId,
      organization_id: input.organizationId,
      study_id: input.studyId,
      site_id: input.siteId ?? null,
      blueprint_id: blueprint.id,
      subject_id: input.subjectId,
      visit_instance_id: input.visitInstanceId,
      procedure_instance_id: input.procedureInstanceId,
      dispensation_id: input.dispensationId ?? null,
      administration_status: input.administrationStatus,
      administered_at: administeredAt,
      performed_by: gate.actorId,
      supporting_document_id: input.supportingDocumentId ?? null,
      deviation_reason: input.deviationReason ?? null,
      metadata: {
        ...(input.metadata ?? {}),
        execution_path: 'Subject > Visit Runtime > Procedure Runtime > Administration Event',
      },
    })

  if (error) throw new Error(error.message)

  await appendVisitRuntimeEvent({
    supabase: client,
    organizationId: input.organizationId,
    studyId: input.studyId,
    subjectId: input.subjectId,
    visitInstanceId: input.visitInstanceId,
    procedureInstanceId: input.procedureInstanceId,
    eventType: VISIT_RUNTIME_EVENT_TYPE.IP_ADMINISTRATION_EVENT,
    actorId: gate.actorId,
    eventPayload: {
      administration_event_id: administrationEventId,
      administration_status: input.administrationStatus,
      dispensation_id: input.dispensationId ?? null,
    },
    stateSnapshot: buildStateSnapshot({
      visitInstanceId: workspace.visitInstance.id,
      visitStatus: workspace.visitInstance.visitStatus,
      progressPercent: workspace.visitInstance.progressPercent,
      procedures: workspace.procedureInstances.map((item) => ({
        id: item.id,
        procedureStatus: item.procedureStatus,
        fieldValues: item.fieldValues,
      })),
    }),
    metadata: {
      pharmacy_runtime: 'dispensing_phase_2',
      no_separate_administration_module: true,
    },
  })

  await appendPharmacyDispensingAudit(client, {
    organizationId: input.organizationId,
    studyId: input.studyId,
    siteId: input.siteId,
    subjectId: input.subjectId,
    visitInstanceId: input.visitInstanceId,
    procedureInstanceId: input.procedureInstanceId,
    dispensationId: input.dispensationId,
    administrationEventId,
    actorId: gate.actorId,
    eventType: 'administration_event_recorded_inside_visit_runtime',
    eventPayload: {
      administration_status: input.administrationStatus,
      procedure_runtime_instance_id: input.procedureInstanceId,
    },
  })

  return {
    id: administrationEventId,
    administration_status: input.administrationStatus,
    administered_at: administeredAt,
  }
}
