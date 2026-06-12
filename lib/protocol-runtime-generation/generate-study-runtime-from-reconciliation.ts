import type { SupabaseClient } from '@supabase/supabase-js'
import { assignBlueprintToStudy } from '@/lib/procedure-library/assign-blueprint-to-study'
import { addProcedureToVisit } from '@/lib/study-runtime-composition/add-procedure-to-visit'
import { compileStudyRuntimeGraph } from '@/lib/study-runtime-composition/compile-study-runtime-graph'
import { createCompositionSnapshot } from '@/lib/study-runtime-composition/create-composition-snapshot'
import { createRuntimeVisit } from '@/lib/study-runtime-composition/create-runtime-visit'
import type { VisitType } from '@/lib/study-runtime-composition/runtime-composition-types'
import {
  GENERATION_EVENT_TYPE,
  GENERATION_STATUS,
  type GenerateStudyRuntimeResult,
  mapGenerationRunRow,
} from './protocol-runtime-generation-types'
import { appendGenerationEvent } from './append-generation-event'
import { buildGenerationRunStateSnapshot } from './generation-state-hash'
import { loadApprovedReconciliation } from './load-approved-reconciliation'
import { validateRuntimeGenerationReadiness } from './validate-runtime-generation-readiness'

export function coerceVisitType(value: string | null): VisitType {
  const allowed: VisitType[] = [
    'screening',
    'baseline',
    'treatment',
    'follow_up',
    'early_termination',
    'unscheduled',
    'phone',
    'remote',
    'other',
  ]
  if (!value) return 'other'
  const normalized = value.trim().toLowerCase() as VisitType
  return allowed.includes(normalized) ? normalized : 'other'
}

async function getOrCreateStudyProcedureBlueprint(args: {
  supabase: SupabaseClient
  organizationId: string
  studyId: string
  procedureId: string
  blueprintVersionId: string
  createdBy: string
}): Promise<string> {
  const { data: existing, error: existingError } = await args.supabase
    .from('study_procedure_blueprints')
    .select('id')
    .eq('organization_id', args.organizationId)
    .eq('study_id', args.studyId)
    .eq('procedure_id', args.procedureId)
    .eq('blueprint_version_id', args.blueprintVersionId)
    .maybeSingle()

  if (existingError) throw new Error(existingError.message)
  if (existing?.id) return String(existing.id)

  const assigned = await assignBlueprintToStudy({
    supabase: args.supabase,
    input: {
      organization_id: args.organizationId,
      study_id: args.studyId,
      procedure_id: args.procedureId,
      blueprint_version_id: args.blueprintVersionId,
      required: true,
    },
    createdBy: args.createdBy,
  })
  return assigned.id
}

async function getOrCreateRuntimeVisit(args: {
  supabase: SupabaseClient
  organizationId: string
  studyId: string
  visitCode: string
  visitName: string
  visitType: string | null
  studyDay: number | null
  windowBeforeDays: number | null
  windowAfterDays: number | null
  sequenceOrder: number
  createdBy: string
  metadata?: Record<string, unknown>
}): Promise<string> {
  const visitCode = args.visitCode.trim().toUpperCase()
  const { data: existing, error: existingError } = await args.supabase
    .from('study_runtime_visits')
    .select('id')
    .eq('organization_id', args.organizationId)
    .eq('study_id', args.studyId)
    .eq('visit_code', visitCode)
    .maybeSingle()

  if (existingError) throw new Error(existingError.message)
  if (existing?.id) return String(existing.id)

  const created = await createRuntimeVisit({
    supabase: args.supabase,
    input: {
      organization_id: args.organizationId,
      study_id: args.studyId,
      visit_code: visitCode,
      visit_name: args.visitName,
      visit_type: coerceVisitType(args.visitType),
      study_day: args.studyDay,
      window_before_days: args.windowBeforeDays,
      window_after_days: args.windowAfterDays,
      sequence_order: args.sequenceOrder,
      allowed_modes: ['onsite'],
      required: true,
      metadata: args.metadata ?? {},
    },
    createdBy: args.createdBy,
  })
  return created.id
}

async function getOrCreateVisitProcedure(args: {
  supabase: SupabaseClient
  organizationId: string
  studyId: string
  visitId: string
  studyProcedureBlueprintId: string
  procedureOrder: number
  required: boolean
  operationalOverrides: Record<string, unknown>
  createdBy: string
}): Promise<{ id: string; created: boolean }> {
  const { data: existing, error: existingError } = await args.supabase
    .from('study_runtime_visit_procedures')
    .select('id, procedure_order')
    .eq('organization_id', args.organizationId)
    .eq('study_id', args.studyId)
    .eq('visit_id', args.visitId)
    .eq('study_procedure_blueprint_id', args.studyProcedureBlueprintId)
    .maybeSingle()

  if (existingError) throw new Error(existingError.message)
  if (existing?.id) {
    // Safe update: keep ordering aligned to approved reconciliation.
    if (existing.procedure_order !== args.procedureOrder) {
      const { error: updateError } = await args.supabase
        .from('study_runtime_visit_procedures')
        .update({ procedure_order: args.procedureOrder })
        .eq('id', String(existing.id))
      if (updateError) throw new Error(updateError.message)
    }
    return { id: String(existing.id), created: false }
  }

  const created = await addProcedureToVisit({
    supabase: args.supabase,
    input: {
      organization_id: args.organizationId,
      study_id: args.studyId,
      visit_id: args.visitId,
      study_procedure_blueprint_id: args.studyProcedureBlueprintId,
      procedure_order: args.procedureOrder,
      required: args.required,
      operational_overrides: args.operationalOverrides,
    },
    createdBy: args.createdBy,
  })

  return { id: created.id, created: true }
}

export async function generateStudyRuntimeFromReconciliation(args: {
  supabase: SupabaseClient
  organizationId: string
  protocolVersionId: string
  studyId: string
  actorId: string
}): Promise<GenerateStudyRuntimeResult> {
  // Validate readiness first (does not mutate reconciliation rows).
  const readiness = await validateRuntimeGenerationReadiness({
    supabase: args.supabase,
    organizationId: args.organizationId,
    protocolVersionId: args.protocolVersionId,
  })
  if (!readiness.ok) {
    throw new Error(`Runtime generation not ready: ${JSON.stringify(readiness.errors)}`)
  }

  const approved = await loadApprovedReconciliation({
    supabase: args.supabase,
    organizationId: args.organizationId,
    protocolVersionId: args.protocolVersionId,
  })
  if (!approved) throw new Error('Approved reconciliation not found or missing study linkage')
  if (approved.studyId !== args.studyId) {
    throw new Error('study_id does not match protocol runtime study linkage')
  }

  // Create new generation run (each generation creates a new snapshot).
  const { data: insertedRun, error: insertError } = await args.supabase
    .from('protocol_runtime_generation_runs')
    .insert({
      organization_id: args.organizationId,
      protocol_version_id: args.protocolVersionId,
      protocol_runtime_study_id: approved.protocolRuntimeStudyId,
      study_id: args.studyId,
      generation_status: GENERATION_STATUS.VALIDATED,
      generated_by: args.actorId,
      source_summary: {
        approved_visits: approved.visits.length,
        approved_procedures: approved.procedures.length,
      },
      result_summary: {},
      validation_errors: readiness.errors,
      metadata: {},
    })
    .select('*')
    .single()

  if (insertError || !insertedRun) throw new Error(insertError?.message ?? 'Failed to create generation run')
  const run = mapGenerationRunRow(insertedRun as Record<string, unknown>)

  await appendGenerationEvent({
    supabase: args.supabase,
    organizationId: args.organizationId,
    generationRunId: run.id,
    protocolVersionId: args.protocolVersionId,
    eventType: GENERATION_EVENT_TYPE.VALIDATED,
    actorId: args.actorId,
    eventPayload: { summary: run.sourceSummary },
    stateSnapshot: buildGenerationRunStateSnapshot(run),
  })

  // 1) Ensure study_procedure_blueprints exist
  const blueprintKeyToAssignmentId = new Map<string, string>()
  let assignmentsCreated = 0
  for (const procedure of approved.procedures) {
    const key = `${procedure.matchedProcedureLibraryId}:${procedure.matchedBlueprintVersionId}`
    if (blueprintKeyToAssignmentId.has(key)) continue
    const before = blueprintKeyToAssignmentId.size
    const id = await getOrCreateStudyProcedureBlueprint({
      supabase: args.supabase,
      organizationId: args.organizationId,
      studyId: args.studyId,
      procedureId: procedure.matchedProcedureLibraryId,
      blueprintVersionId: procedure.matchedBlueprintVersionId,
      createdBy: args.actorId,
    })
    blueprintKeyToAssignmentId.set(key, id)
    if (blueprintKeyToAssignmentId.size > before) assignmentsCreated += 1
  }

  await appendGenerationEvent({
    supabase: args.supabase,
    organizationId: args.organizationId,
    generationRunId: run.id,
    protocolVersionId: args.protocolVersionId,
    eventType: GENERATION_EVENT_TYPE.STUDY_BLUEPRINTS_ASSIGNED,
    actorId: args.actorId,
    eventPayload: {
      distinct_assignments: blueprintKeyToAssignmentId.size,
      assignments_created: assignmentsCreated,
    },
    stateSnapshot: buildGenerationRunStateSnapshot(run),
  })

  // 2) Create/reuse runtime visits
  const visitReconIdToRuntimeVisitId = new Map<string, string>()
  const sortedVisits = [...approved.visits].sort((a, b) =>
    (a.studyDay ?? 999999) - (b.studyDay ?? 999999) || a.visitCode.localeCompare(b.visitCode),
  )
  for (const [idx, visit] of sortedVisits.entries()) {
    const runtimeVisitId = await getOrCreateRuntimeVisit({
      supabase: args.supabase,
      organizationId: args.organizationId,
      studyId: args.studyId,
      visitCode: visit.visitCode,
      visitName: visit.visitName,
      visitType: visit.visitType,
      studyDay: visit.studyDay,
      windowBeforeDays: visit.windowBeforeDays,
      windowAfterDays: visit.windowAfterDays,
      sequenceOrder: idx + 1,
      createdBy: args.actorId,
      metadata: { generated_from: { protocol_visit_reconciliation_id: visit.id } },
    })
    visitReconIdToRuntimeVisitId.set(visit.id, runtimeVisitId)
  }

  await appendGenerationEvent({
    supabase: args.supabase,
    organizationId: args.organizationId,
    generationRunId: run.id,
    protocolVersionId: args.protocolVersionId,
    eventType: GENERATION_EVENT_TYPE.RUNTIME_VISITS_CREATED,
    actorId: args.actorId,
    eventPayload: { visits_processed: sortedVisits.length },
    stateSnapshot: buildGenerationRunStateSnapshot(run),
  })

  // 3) Create visit procedures
  let visitProceduresCreated = 0
  for (const procedure of approved.procedures) {
    const visitId = visitReconIdToRuntimeVisitId.get(procedure.visitReconciliationId)
    if (!visitId) {
      throw new Error(`Approved procedure missing visit_reconciliation_id mapping: ${procedure.id}`)
    }
    const assignmentKey = `${procedure.matchedProcedureLibraryId}:${procedure.matchedBlueprintVersionId}`
    const assignmentId = blueprintKeyToAssignmentId.get(assignmentKey)
    if (!assignmentId) {
      throw new Error(`Missing study blueprint assignment for ${assignmentKey}`)
    }

    const order = procedure.procedureOrder ?? 9999
    const result = await getOrCreateVisitProcedure({
      supabase: args.supabase,
      organizationId: args.organizationId,
      studyId: args.studyId,
      visitId,
      studyProcedureBlueprintId: assignmentId,
      procedureOrder: order,
      required: procedure.required,
      operationalOverrides: procedure.operationalOverrides,
      createdBy: args.actorId,
    })
    if (result.created) visitProceduresCreated += 1
  }

  await appendGenerationEvent({
    supabase: args.supabase,
    organizationId: args.organizationId,
    generationRunId: run.id,
    protocolVersionId: args.protocolVersionId,
    eventType: GENERATION_EVENT_TYPE.VISIT_PROCEDURES_CREATED,
    actorId: args.actorId,
    eventPayload: {
      approved_procedures: approved.procedures.length,
      created: visitProceduresCreated,
    },
    stateSnapshot: buildGenerationRunStateSnapshot(run),
  })

  // 4) Compile graph + snapshot
  const compiled = await compileStudyRuntimeGraph({
    supabase: args.supabase,
    organizationId: args.organizationId,
    studyId: args.studyId,
  })

  await appendGenerationEvent({
    supabase: args.supabase,
    organizationId: args.organizationId,
    generationRunId: run.id,
    protocolVersionId: args.protocolVersionId,
    eventType: GENERATION_EVENT_TYPE.RUNTIME_GRAPH_COMPILED,
    actorId: args.actorId,
    eventPayload: { graph_hash: compiled.graphHash },
    stateSnapshot: buildGenerationRunStateSnapshot(run),
  })

  const snapshot = await createCompositionSnapshot({
    supabase: args.supabase,
    organizationId: args.organizationId,
    studyId: args.studyId,
    createdBy: args.actorId,
    graph: compiled.graph,
    graphHash: compiled.graphHash,
  })

  // 5) Finalize run
  const generatedAt = new Date().toISOString()
  const { data: updatedRun, error: updateError } = await args.supabase
    .from('protocol_runtime_generation_runs')
    .update({
      generation_status: GENERATION_STATUS.GENERATED,
      generated_runtime_snapshot_id: snapshot.id,
      generated_at: generatedAt,
      result_summary: {
        snapshot_id: snapshot.id,
        graph_hash: snapshot.graphHash,
        visits: approved.visits.length,
        procedures: approved.procedures.length,
        distinct_study_blueprints: blueprintKeyToAssignmentId.size,
      },
    })
    .eq('id', run.id)
    .select('*')
    .single()

  if (updateError || !updatedRun) throw new Error(updateError?.message ?? 'Failed to finalize generation run')
  const finalRun = mapGenerationRunRow(updatedRun as Record<string, unknown>)

  await appendGenerationEvent({
    supabase: args.supabase,
    organizationId: args.organizationId,
    generationRunId: finalRun.id,
    protocolVersionId: args.protocolVersionId,
    eventType: GENERATION_EVENT_TYPE.COMPLETED,
    actorId: args.actorId,
    eventPayload: finalRun.resultSummary,
    stateSnapshot: buildGenerationRunStateSnapshot(finalRun),
  })

  return {
    generationRunId: finalRun.id,
    runtimeSnapshotId: snapshot.id,
    summary: finalRun.resultSummary,
  }
}

