/**
 * Phase 3C — Materialize Source Engine findings / CREATE_TASK actions into subject_workflow_actions.
 */

import type { ProcedureSourceEngineSnapshot } from '@/lib/source-engine/adapters/capture-runtime-adapter'
import type { CaptureValidationError } from '@/lib/source-engine/adapters/source-response-adapter'
import type { RuleAction } from '@/lib/source-engine/definitions/types'
import type {
  SubjectWorkflowActionType,
  SubjectWorkflowPriority,
  SubjectWorkflowStatus,
} from '@/lib/subject/workflow/types'
import { emitWorkflowActionCreatedEvent } from '@/lib/operations/emit-workflow-created'
import {
  logSourceEngineOperationalEvent,
  operationalContextFromSnapshot,
  resolutionMetaFromSnapshot,
  SOURCE_ENGINE_EVENT_TYPES,
} from '@/lib/source-engine/telemetry'
import { createServerClient } from '@/lib/supabase/server'

export const SOURCE_ENGINE_TASK_KEY_PREFIX = '[source_engine_key='

export type EngineTaskCandidate = {
  deterministicKey: string
  findingCode: string
  fieldId: string | null
  sectionId: string | null
  severity: CaptureValidationError['severity']
  title: string
  description: string
  assignedRole: string | null
  source: 'finding' | 'rule_action'
  taskKind: string | null
}

export type EngineTaskInsertPayload = {
  origin: 'source_engine'
  organizationId: string
  studyId: string
  subjectId: string
  visitId: string | null
  procedureExecutionId: string
  sourceResponseSetId: string | null
  fieldId: string | null
  sectionId: string | null
  severity: EngineTaskCandidate['severity']
  title: string
  description: string
  deterministicKey: string
  assignedRole: string | null
  status: SubjectWorkflowStatus
  actionType: SubjectWorkflowActionType
  priority: SubjectWorkflowPriority
  metadata: Record<string, unknown>
}

export type MaterializeSourceEngineTasksInput = {
  snapshot: ProcedureSourceEngineSnapshot
  procedureExecutionId: string
  organizationId: string
  studyId: string
  studySubjectId: string
  visitId: string
  sourceResponseSetId?: string | null
  actorUserId?: string | null
  /** Optional — used by operational smoke tests to avoid live DB. */
  supabase?: Awaited<ReturnType<typeof createServerClient>>
}

export type MaterializeSourceEngineTasksResult = {
  ok: boolean
  skipped: boolean
  skipReason: string | null
  created: number
  deduped: number
  errors: string[]
}

export function buildDeterministicTaskKey(parts: {
  procedureExecutionId: string
  findingCode: string
  fieldId?: string | null
  sectionId?: string | null
}): string {
  const field = parts.fieldId?.trim() || '_'
  const section = parts.sectionId?.trim() || '_'
  return `source_engine:${parts.procedureExecutionId}:${parts.findingCode}:${field}:${section}`
}

export function formatDescriptionWithDedupeKey(
  deterministicKey: string,
  body: string,
): string {
  return `${SOURCE_ENGINE_TASK_KEY_PREFIX}${deterministicKey}]\n\n${body}`
}

export function parseDedupeKeyFromDescription(description: string | null): string | null {
  if (!description?.startsWith(SOURCE_ENGINE_TASK_KEY_PREFIX)) return null
  const end = description.indexOf(']')
  if (end < 0) return null
  return description.slice(SOURCE_ENGINE_TASK_KEY_PREFIX.length, end)
}

export function canMaterializeTasksForSnapshot(
  snapshot: ProcedureSourceEngineSnapshot,
): { allowed: boolean; reason: string | null } {
  const resolution = snapshot.engineStatus?.resolution
  if (!resolution) {
    return { allowed: false, reason: 'Missing engine resolution metadata.' }
  }
  if (resolution.fallback) {
    if (resolution.allowTaskMaterialization === true) {
      return { allowed: true, reason: null }
    }
    return {
      allowed: false,
      reason: 'Fallback template — task materialization disabled unless explicitly marked safe.',
    }
  }
  if (resolution.source === 'published' || resolution.source === 'registry') {
    return { allowed: true, reason: null }
  }
  return { allowed: false, reason: `Resolution source "${resolution.source}" is not eligible.` }
}

export function extractTaskCandidatesFromFindings(
  findings: CaptureValidationError[],
  procedureExecutionId: string,
): EngineTaskCandidate[] {
  const out: EngineTaskCandidate[] = []

  for (const finding of findings) {
    const eligible =
      finding.taskEligible === true ||
      ((finding.severity === 'critical' || finding.severity === 'error') &&
        finding.blocksSignature === true)

    if (!eligible) continue

    const fieldId = finding.fieldKey ?? null
    const sectionId = finding.sectionId ?? null
    const findingCode = finding.code || 'ENGINE_FINDING'

    out.push({
      deterministicKey: buildDeterministicTaskKey({
        procedureExecutionId,
        findingCode,
        fieldId,
        sectionId,
      }),
      findingCode,
      fieldId,
      sectionId,
      severity: finding.severity,
      title: `Source Engine: ${findingCode}`,
      description: finding.message,
      assignedRole: 'crc',
      source: 'finding',
      taskKind: null,
    })
  }

  return out
}

export function extractTaskCandidatesFromRuleActions(
  ruleActions: RuleAction[],
  procedureExecutionId: string,
): EngineTaskCandidate[] {
  const out: EngineTaskCandidate[] = []

  for (const action of ruleActions) {
    if (action.type !== 'CREATE_TASK') continue
    const taskKind = action.taskKind ?? 'monitor_review'
    const fieldId = action.fieldId ?? null
    const sectionId = action.sectionId ?? action.repeatableSectionId ?? null
    const findingCode = `RULE_TASK_${taskKind}`

    out.push({
      deterministicKey: buildDeterministicTaskKey({
        procedureExecutionId,
        findingCode,
        fieldId,
        sectionId,
      }),
      findingCode,
      fieldId,
      sectionId,
      severity: 'error',
      title: action.message?.trim() || `Source Engine task: ${taskKind}`,
      description: action.message?.trim() || `Rule requested coordinator follow-up (${taskKind}).`,
      assignedRole: 'crc',
      source: 'rule_action',
      taskKind,
    })
  }

  return out
}

export function extractEngineTaskCandidates(
  snapshot: ProcedureSourceEngineSnapshot,
  procedureExecutionId: string,
): EngineTaskCandidate[] {
  const findings = snapshot.validationErrors ?? []
  const ruleActions = snapshot.runtime?.triggeredRuleActions ?? []
  const byKey = new Map<string, EngineTaskCandidate>()

  for (const candidate of [
    ...extractTaskCandidatesFromFindings(findings, procedureExecutionId),
    ...extractTaskCandidatesFromRuleActions(ruleActions, procedureExecutionId),
  ]) {
    byKey.set(candidate.deterministicKey, candidate)
  }

  return [...byKey.values()]
}

function mapTaskKindToActionType(taskKind: string | null): SubjectWorkflowActionType {
  switch (taskKind) {
    case 'signature_required':
      return 'signature_request'
    case 'correction_required':
      return 'correction'
    case 'hit_workup':
    case 'acth_stimulation_required':
    case 'pregnancy_confirm':
    case 'pk_window_deviation':
    case 'monitor_review':
      return 'follow_up'
    default:
      return 'action'
  }
}

function mapSeverityToPriority(severity: EngineTaskCandidate['severity']): SubjectWorkflowPriority {
  if (severity === 'critical') return 'urgent'
  if (severity === 'error') return 'high'
  if (severity === 'warning') return 'normal'
  return 'low'
}

export function mapEngineTaskToSubjectWorkflowAction(
  candidate: EngineTaskCandidate,
  input: Omit<MaterializeSourceEngineTasksInput, 'snapshot'>,
  snapshot: ProcedureSourceEngineSnapshot,
): EngineTaskInsertPayload {
  const resolution = snapshot.engineStatus?.resolution
  const metadata = {
    origin: 'source_engine',
    deterministicKey: candidate.deterministicKey,
    findingCode: candidate.findingCode,
    candidateSource: candidate.source,
    taskKind: candidate.taskKind,
    engineResolutionSource: resolution?.source ?? null,
    engineTemplateId: resolution?.templateId ?? null,
    engineRegistryTemplateId: resolution?.registryTemplateId ?? null,
    engineFallback: resolution?.fallback ?? null,
  }

  return {
    origin: 'source_engine',
    organizationId: input.organizationId,
    studyId: input.studyId,
    subjectId: input.studySubjectId,
    visitId: input.visitId,
    procedureExecutionId: input.procedureExecutionId,
    sourceResponseSetId: input.sourceResponseSetId ?? null,
    fieldId: candidate.fieldId,
    sectionId: candidate.sectionId,
    severity: candidate.severity,
    title: candidate.title,
    description: formatDescriptionWithDedupeKey(candidate.deterministicKey, candidate.description),
    deterministicKey: candidate.deterministicKey,
    assignedRole: candidate.assignedRole,
    status: 'open',
    actionType: mapTaskKindToActionType(candidate.taskKind),
    priority: mapSeverityToPriority(candidate.severity),
    metadata,
  }
}

async function loadExistingDedupeKeys(
  procedureExecutionId: string,
  organizationId: string,
  supabaseClient?: Awaited<ReturnType<typeof createServerClient>>,
): Promise<Set<string>> {
  const supabase = supabaseClient ?? (await createServerClient())
  const { data, error } = await supabase
    .from('subject_workflow_actions')
    .select('description')
    .eq('procedure_execution_id', procedureExecutionId)
    .eq('organization_id', organizationId)
    .in('status', ['open', 'in_progress'])

  if (error) {
    throw new Error(`Could not load workflow actions for dedupe: ${error.message}`)
  }

  const keys = new Set<string>()
  for (const row of data ?? []) {
    const key = parseDedupeKeyFromDescription(row.description as string | null)
    if (key) keys.add(key)
  }
  return keys
}

async function logTaskMaterializationSkipped(
  input: MaterializeSourceEngineTasksInput,
  skipReason: string,
) {
  await logSourceEngineOperationalEvent({
    eventType: SOURCE_ENGINE_EVENT_TYPES.ENGINE_TASK_MATERIALIZATION_SKIPPED,
    context: operationalContextFromSnapshot(
      input.snapshot,
      input.procedureExecutionId,
      input.organizationId,
      input.sourceResponseSetId,
      input.actorUserId ?? null,
    ),
    extras: {
      ...resolutionMetaFromSnapshot(input.snapshot),
      skipReason,
    },
    supabase: input.supabase,
  })
}

export async function materializeSourceEngineTasks(
  input: MaterializeSourceEngineTasksInput,
): Promise<MaterializeSourceEngineTasksResult> {
  const eligibility = canMaterializeTasksForSnapshot(input.snapshot)
  if (!eligibility.allowed) {
    void logTaskMaterializationSkipped(input, eligibility.reason ?? 'Not eligible.')
    return {
      ok: true,
      skipped: true,
      skipReason: eligibility.reason,
      created: 0,
      deduped: 0,
      errors: [],
    }
  }

  const candidates = extractEngineTaskCandidates(
    input.snapshot,
    input.procedureExecutionId,
  )

  if (candidates.length === 0) {
    void logTaskMaterializationSkipped(
      input,
      'No eligible Source Engine task candidates.',
    )
    return {
      ok: true,
      skipped: true,
      skipReason: 'No eligible Source Engine task candidates.',
      created: 0,
      deduped: 0,
      errors: [],
    }
  }

  let existingKeys: Set<string>
  try {
    existingKeys = await loadExistingDedupeKeys(
      input.procedureExecutionId,
      input.organizationId,
      input.supabase,
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    void logTaskMaterializationSkipped(
      input,
      'Unsafe to create tasks without dedupe lookup.',
    )
    return {
      ok: false,
      skipped: true,
      skipReason: 'Unsafe to create tasks without dedupe lookup.',
      created: 0,
      deduped: 0,
      errors: [message],
    }
  }

  const supabase = input.supabase ?? (await createServerClient())
  let created = 0
  let deduped = 0
  const errors: string[] = []

  for (const candidate of candidates) {
    if (existingKeys.has(candidate.deterministicKey)) {
      deduped += 1
      continue
    }

    const payload = mapEngineTaskToSubjectWorkflowAction(candidate, input, input.snapshot)

    const { data: inserted, error } = await supabase
      .from('subject_workflow_actions')
      .insert({
        organization_id: payload.organizationId,
        study_id: payload.studyId,
        study_subject_id: payload.subjectId,
        visit_id: payload.visitId,
        procedure_execution_id: payload.procedureExecutionId,
        source_response_set_id: payload.sourceResponseSetId,
        source_section_key: payload.sectionId,
        action_type: payload.actionType,
        status: payload.status,
        priority: payload.priority,
        title: payload.title,
        description: payload.description,
        assigned_role: payload.assignedRole,
        created_by: input.actorUserId ?? null,
      })
      .select('id')
      .single()

    if (error) {
      errors.push(`${candidate.deterministicKey}: ${error.message}`)
      continue
    }

    await emitWorkflowActionCreatedEvent({
      supabase,
      organizationId: payload.organizationId,
      studyId: payload.studyId,
      studySubjectId: payload.subjectId,
      visitId: payload.visitId,
      procedureExecutionId: payload.procedureExecutionId,
      actorUserId: input.actorUserId ?? null,
      workflowActionId: inserted.id as string,
      actionType: payload.actionType,
      title: payload.title,
      assignedRole: payload.assignedRole,
      origin: 'source_engine_task_materializer',
    })

    existingKeys.add(candidate.deterministicKey)
    created += 1
  }

  const result = {
    ok: errors.length === 0,
    skipped: false,
    skipReason: null,
    created,
    deduped,
    errors,
  }

  if (created > 0) {
    void logSourceEngineOperationalEvent({
      eventType: SOURCE_ENGINE_EVENT_TYPES.ENGINE_TASKS_MATERIALIZED,
      context: operationalContextFromSnapshot(
        input.snapshot,
        input.procedureExecutionId,
        input.organizationId,
        input.sourceResponseSetId,
        input.actorUserId ?? null,
      ),
      extras: {
        ...resolutionMetaFromSnapshot(input.snapshot),
        taskCount: created,
        dedupedTaskCount: deduped,
        blockerCount: candidates.length,
      },
      supabase: input.supabase,
    })
  } else if (deduped > 0) {
    void logTaskMaterializationSkipped(
      input,
      `All ${candidates.length} candidate(s) already materialized (deduped).`,
    )
  }

  return result
}
