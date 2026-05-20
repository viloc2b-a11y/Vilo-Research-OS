/**
 * Phase 3E — Best-effort Source Engine operational event logging.
 */

import { logOperationalEvent } from '@/lib/operations/logOperationalEvent'
import type { ProcedureSourceEngineSnapshot } from '@/lib/source-engine/adapters/capture-runtime-adapter'
import type { SourceEngineResolution } from '@/lib/source-engine/resolution/source-template-resolver'
import {
  SOURCE_ENGINE_EVENT_TYPES,
  type SourceEngineEventType,
} from '@/lib/source-engine/telemetry/source-engine-event-types'
import { createServerClient } from '@/lib/supabase/server'

type Supabase = Awaited<ReturnType<typeof createServerClient>>

export type SourceEngineOperationalContext = {
  organizationId: string
  studyId: string
  subjectId: string
  visitId: string
  procedureExecutionId: string
  sourceResponseSetId?: string | null
  userId?: string | null
}

export type SourceEngineOperationalExtras = {
  templateId?: string | null
  resolutionSource?: SourceEngineResolution['source'] | null
  degraded?: boolean
  fallback?: boolean
  blockerCount?: number
  taskCount?: number
  dedupedTaskCount?: number
  errorMessage?: string | null
  skipReason?: string | null
  fieldsAppliedCount?: number
  metadata?: Record<string, unknown>
}

function isTruthyEnv(value: string | undefined): boolean {
  if (!value) return false
  return value === '1' || value.toLowerCase() === 'true' || value.toLowerCase() === 'yes'
}

export function isSourceEngineDebugEventsEnabled(): boolean {
  return (
    isTruthyEnv(process.env.SOURCE_ENGINE_DEBUG_EVENTS) ||
    isTruthyEnv(process.env.SOURCE_ENGINE_LOG_SNAPSHOT_GENERATED)
  )
}

export function resolutionMetaFromSnapshot(
  snapshot: ProcedureSourceEngineSnapshot | null | undefined,
): Pick<SourceEngineOperationalExtras, 'templateId' | 'resolutionSource' | 'degraded' | 'fallback'> {
  const resolution = snapshot?.engineStatus?.resolution
  return {
    templateId: resolution?.templateId ?? null,
    resolutionSource: resolution?.source ?? null,
    degraded: resolution?.degraded ?? false,
    fallback: resolution?.fallback ?? false,
  }
}

export function buildSourceEngineEventPayload(
  ctx: SourceEngineOperationalContext,
  extras: SourceEngineOperationalExtras = {},
): Record<string, unknown> {
  return {
    origin: 'source_engine',
    timestamp: new Date().toISOString(),
    studyId: ctx.studyId,
    subjectId: ctx.subjectId,
    visitId: ctx.visitId,
    procedureExecutionId: ctx.procedureExecutionId,
    sourceResponseSetId: ctx.sourceResponseSetId ?? null,
    templateId: extras.templateId ?? null,
    resolutionSource: extras.resolutionSource ?? null,
    degraded: extras.degraded ?? false,
    fallback: extras.fallback ?? false,
    blockerCount: extras.blockerCount ?? 0,
    taskCount: extras.taskCount ?? 0,
    dedupedTaskCount: extras.dedupedTaskCount ?? 0,
    userId: ctx.userId ?? null,
    errorMessage: extras.errorMessage ?? null,
    skipReason: extras.skipReason ?? null,
    fieldsAppliedCount: extras.fieldsAppliedCount ?? 0,
    ...extras.metadata,
  }
}

export async function procedureHasSourceEngineEvent(
  supabase: Supabase,
  procedureExecutionId: string,
  eventType: SourceEngineEventType,
): Promise<boolean> {
  const { data, error } = await supabase
    .from('operational_events')
    .select('id')
    .eq('procedure_execution_id', procedureExecutionId)
    .eq('event_type', eventType)
    .limit(1)

  if (error) {
    console.warn('[SourceEngine] event dedupe lookup failed', error.message)
    return true
  }

  return (data?.length ?? 0) > 0
}

export async function shouldLogPerProcedureEngineEvent(
  supabase: Supabase,
  procedureExecutionId: string,
  eventType: SourceEngineEventType,
): Promise<boolean> {
  if (isSourceEngineDebugEventsEnabled()) return true
  const exists = await procedureHasSourceEngineEvent(supabase, procedureExecutionId, eventType)
  return !exists
}

export type LogSourceEngineOperationalEventInput = {
  eventType: SourceEngineEventType
  context: SourceEngineOperationalContext
  extras?: SourceEngineOperationalExtras
  supabase?: Supabase
}

/**
 * Append a Source Engine event to operational_events. Never throws.
 */
export async function logSourceEngineOperationalEvent(
  input: LogSourceEngineOperationalEventInput,
): Promise<void> {
  try {
    const supabase = input.supabase ?? (await createServerClient())
    await logOperationalEvent({
      supabase,
      organizationId: input.context.organizationId,
      studyId: input.context.studyId,
      visitId: input.context.visitId,
      procedureExecutionId: input.context.procedureExecutionId,
      actorUserId: input.context.userId ?? null,
      eventType: input.eventType,
      payload: buildSourceEngineEventPayload(input.context, input.extras),
    })
  } catch (err) {
    console.warn(`[SourceEngine] failed to log ${input.eventType}`, err)
  }
}

export function operationalContextFromCapture(
  ctx: {
    organizationId: string
    studyId: string
    studySubjectId: string
    visitId: string
    procedureExecutionId: string
  },
  sourceResponseSetId?: string | null,
  userId?: string | null,
): SourceEngineOperationalContext {
  return {
    organizationId: ctx.organizationId,
    studyId: ctx.studyId,
    subjectId: ctx.studySubjectId,
    visitId: ctx.visitId,
    procedureExecutionId: ctx.procedureExecutionId,
    sourceResponseSetId: sourceResponseSetId ?? null,
    userId: userId ?? null,
  }
}

export function operationalContextFromSnapshot(
  snapshot: ProcedureSourceEngineSnapshot,
  procedureExecutionId: string,
  organizationId: string,
  sourceResponseSetId?: string | null,
  userId?: string | null,
): SourceEngineOperationalContext {
  return {
    organizationId,
    studyId: snapshot.context.studyId,
    subjectId: snapshot.context.subjectId,
    visitId: snapshot.context.visitId,
    procedureExecutionId,
    sourceResponseSetId: sourceResponseSetId ?? null,
    userId: userId ?? null,
  }
}

export { SOURCE_ENGINE_EVENT_TYPES }
