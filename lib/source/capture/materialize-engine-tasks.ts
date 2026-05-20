/**
 * Phase 3C — Materialize coordinator workflow tasks after Source Engine events.
 */

import { loadProcedureCaptureContext } from '@/lib/source/capture/context'
import { buildProcedureEngineSnapshot } from '@/lib/source/capture/engine-signature-validation'
import type { ProcedureSourceEngineSnapshot } from '@/lib/source-engine/adapters/index'
import { materializeSourceEngineTasks } from '@/lib/source-engine/workflow/task-materializer'

export async function materializeEngineTasksAfterSignatureBlock(params: {
  procedureExecutionId: string
  organizationId: string
  responseSetId: string
  actorUserId: string | null
  snapshot?: ProcedureSourceEngineSnapshot | null
}) {
  const ctx = await loadProcedureCaptureContext(params.procedureExecutionId)
  if (!ctx) {
    return {
      ok: false,
      skipped: true,
      skipReason: 'Procedure context not found.',
      created: 0,
      deduped: 0,
      errors: [] as string[],
    }
  }

  const snapshot =
    params.snapshot ??
    (await buildProcedureEngineSnapshot({
      procedureExecutionId: params.procedureExecutionId,
      organizationId: params.organizationId,
      responseSetId: params.responseSetId,
    }))

  if (!snapshot) {
    return {
      ok: false,
      skipped: true,
      skipReason: 'Could not build engine snapshot for task materialization.',
      created: 0,
      deduped: 0,
      errors: [] as string[],
    }
  }

  return materializeSourceEngineTasks({
    snapshot,
    procedureExecutionId: params.procedureExecutionId,
    organizationId: params.organizationId,
    studyId: ctx.studyId,
    studySubjectId: ctx.studySubjectId,
    visitId: ctx.visitId,
    sourceResponseSetId: params.responseSetId,
    actorUserId: params.actorUserId,
  })
}

export async function materializeEngineTasksAfterSubmit(params: {
  procedureExecutionId: string
  organizationId: string
  responseSetId: string
  actorUserId: string | null
  snapshot: ProcedureSourceEngineSnapshot
}) {
  const ctx = await loadProcedureCaptureContext(params.procedureExecutionId)
  if (!ctx) {
    return {
      ok: false,
      skipped: true,
      skipReason: 'Procedure context not found.',
      created: 0,
      deduped: 0,
      errors: [] as string[],
    }
  }

  return materializeSourceEngineTasks({
    snapshot: params.snapshot,
    procedureExecutionId: params.procedureExecutionId,
    organizationId: params.organizationId,
    studyId: ctx.studyId,
    studySubjectId: ctx.studySubjectId,
    visitId: ctx.visitId,
    sourceResponseSetId: params.responseSetId,
    actorUserId: params.actorUserId,
  })
}
