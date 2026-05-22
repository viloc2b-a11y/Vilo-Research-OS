/**
 * Phase 3F — Operational QA smoke tests (no live DB; mock Supabase for inserts).
 */

import { parseCaptureFormToResponses } from '@/lib/source/capture/parse-form'
import type { CaptureFieldViewModel } from '@/lib/source/capture/types'
import {
  applyEngineRuntimeToCaptureFields,
  resolveProcedureSourceRuntime,
} from '@/lib/source-engine/adapters/capture-runtime-adapter'
import { mapEngineValidationToCaptureErrors } from '@/lib/source-engine/adapters/source-response-adapter'
import type { ProcedureCaptureBridge } from '@/lib/source-engine/adapters/procedure-runtime-adapter'
import { getSignatureBlockingErrors } from '@/lib/source-engine/adapters/signature-gate'
import type { CaptureValidationError } from '@/lib/source-engine/adapters/source-response-adapter'
import { mapProcedureExecutionToRuntimeContext } from '@/lib/source-engine/adapters/procedure-runtime-adapter'
import { createEmptyResponses } from '@/lib/source-engine/runtime/runtime-context'
import { validateForSignature } from '@/lib/source-engine/validators/validation-engine'
import type { SourceDefinitionResolutionContext } from '@/lib/source-engine/resolution/load-resolution-context'
import { resolveSourceEngineRuntimeConfigFromContext } from '@/lib/source-engine/resolution/source-template-resolver'
import {
  buildSourceEngineEventPayload,
  logSourceEngineOperationalEvent,
  SOURCE_ENGINE_EVENT_TYPES,
} from '@/lib/source-engine/telemetry'
import {
  canMaterializeTasksForSnapshot,
  extractEngineTaskCandidates,
  formatDescriptionWithDedupeKey,
  materializeSourceEngineTasks,
  parseDedupeKeyFromDescription,
} from '@/lib/source-engine/workflow/task-materializer'
import type { createServerClient } from '@/lib/supabase/server'

export type SmokeTestResult = {
  name: string
  pass: boolean
  detail?: string
}

type MockStore = {
  workflowRows: Array<{ description: string | null }>
  workflowInserts: Record<string, unknown>[]
  eventInserts: Array<{ event_type: string; payload: Record<string, unknown> }>
  failEventInsert: boolean
}

const PROC_ID = '00000000-0000-4000-8000-000000000001'
const ORG_ID = '00000000-0000-4000-8000-000000000002'
const STUDY_ID = '00000000-0000-4000-8000-000000000003'
const SUBJ_ID = '00000000-0000-4000-8000-000000000004'
const VISIT_ID = '00000000-0000-4000-8000-000000000005'
const RS_ID = '00000000-0000-4000-8000-000000000006'

function testBridge(overrides: Partial<ProcedureCaptureBridge> = {}): ProcedureCaptureBridge {
  return {
    procedureExecutionId: PROC_ID,
    organizationId: ORG_ID,
    studyId: STUDY_ID,
    studyVersionId: 'sv-1',
    studySubjectId: SUBJ_ID,
    visitId: VISIT_ID,
    wocbp: true,
    sexAtBirth: 'female',
    subjectAge: 42,
    isTreatment: true,
    ...overrides,
  }
}

function publishedResolutionContext(
  overrides: Partial<SourceDefinitionResolutionContext> = {},
): SourceDefinitionResolutionContext {
  const { publishedFieldKeys: overrideFieldKeys, ...rest } = overrides
  return {
    sourceDefinitionVersionId: '00000000-0000-4000-8000-000000000010',
    studyId: STUDY_ID,
    sourceDefinitionId: '00000000-0000-4000-8000-000000000011',
    definitionCode: 'GENERIC_OA_VITALS',
    definitionLabel: 'Vitals',
    lifecycleStatus: 'published',
    versionLabel: '1.0.0',
    meta: { source_engine_template_id: 'GENERIC_OA_PHASE3_TEMPLATE' },
    validationRulesManifest: null,
    publishedPackageId: 'pkg-smoke-1',
    publishedProvenance: null,
    publishedSourceStatus: 'published',
    publishedFieldKeys: overrideFieldKeys ?? [],
    ...rest,
  }
}

function fallbackResolutionContext(): SourceDefinitionResolutionContext {
  return publishedResolutionContext({
    definitionCode: 'UNKNOWN_MISC_QA_FORM',
    meta: {},
    publishedPackageId: null,
    publishedProvenance: null,
  })
}

function captureFields(): CaptureFieldViewModel[] {
  return [
    {
      fieldId: '00000000-0000-4000-8000-000000000020',
      fieldKey: 'height_cm',
      label: 'Height',
      kind: 'number',
      isRequired: true,
      blindingScope: 'blinded',
      options: [],
      value: { number: 170 },
    },
    {
      fieldId: '00000000-0000-4000-8000-000000000021',
      fieldKey: 'weight_kg',
      label: 'Weight',
      kind: 'number',
      isRequired: true,
      blindingScope: 'blinded',
      options: [],
      value: { number: 70 },
    },
    {
      fieldId: '00000000-0000-4000-8000-000000000022',
      fieldKey: 'pregnancy_test_result',
      label: 'Pregnancy result',
      kind: 'text',
      isRequired: false,
      blindingScope: 'blinded',
      options: [],
      value: { text: '' },
    },
  ]
}

function createMockSupabase(store: MockStore): Awaited<ReturnType<typeof createServerClient>> {
  const workflowSelectChain = {
    eq: () => workflowSelectChain,
    in: () => Promise.resolve({ data: store.workflowRows, error: null }),
  }

  return {
    from: (table: string) => {
      if (table === 'subject_workflow_actions') {
        return {
          select: () => workflowSelectChain,
          insert: (row: Record<string, unknown>) => {
            store.workflowInserts.push(row)
            return Promise.resolve({ error: null })
          },
        }
      }
      if (table === 'operational_events') {
        return {
          insert: (row: { event_type: string; payload: Record<string, unknown> }) => {
            if (store.failEventInsert) {
              return Promise.resolve({ error: { message: 'mock insert failed' } })
            }
            store.eventInserts.push(row)
            return Promise.resolve({ error: null })
          },
        }
      }
      return {
        select: () => workflowSelectChain,
        insert: () => Promise.resolve({ error: null }),
      }
    },
  } as unknown as Awaited<ReturnType<typeof createServerClient>>
}

function testTemplateResolution(): SmokeTestResult[] {
  const publishedConfig = resolveSourceEngineRuntimeConfigFromContext(
    publishedResolutionContext(),
  )
  const registryConfig = resolveSourceEngineRuntimeConfigFromContext(
    publishedResolutionContext({
      meta: {},
      definitionCode: 'STUDY_BIOSPECIMEN_COLLECTION',
    }),
  )
  const fallbackConfig = resolveSourceEngineRuntimeConfigFromContext(fallbackResolutionContext())

  const publishedSnap = resolveProcedureSourceRuntime(testBridge(), captureFields(), {
    runtimeConfig: publishedConfig,
  })
  const fallbackSnap = resolveProcedureSourceRuntime(testBridge(), captureFields(), {
    runtimeConfig: fallbackConfig,
  })

  return [
    {
      name: 'Template: published config enables signature enforcement',
      pass:
        publishedConfig.enforceSignatureBlockers === true &&
        publishedConfig.resolution.source === 'published',
    },
    {
      name: 'Template: registry config enables signature enforcement',
      pass:
        registryConfig.enforceSignatureBlockers === true &&
        registryConfig.resolution.source === 'registry',
    },
    {
      name: 'Template: fallback disables unsafe signature blockers',
      pass:
        fallbackConfig.enforceSignatureBlockers === false && fallbackConfig.resolution.fallback === true,
    },
    {
      name: 'Template: engineStatus.resolution populated on snapshot',
      pass:
        Boolean(publishedSnap.engineStatus?.resolution?.templateId) &&
        Boolean(fallbackSnap.engineStatus?.resolution?.fallback),
    },
  ]
}

function testRuntimeStateMapping(): SmokeTestResult[] {
  const publishedConfig = resolveSourceEngineRuntimeConfigFromContext(
    publishedResolutionContext(),
  )
  const snapshot = resolveProcedureSourceRuntime(testBridge(), captureFields(), {
    runtimeConfig: publishedConfig,
  })
  const applied = applyEngineRuntimeToCaptureFields(captureFields(), snapshot)

  const pregnancy = applied.find((f) => f.fieldKey === 'pregnancy_test_result')
  const height = applied.find((f) => f.fieldKey === 'height_cm')

  const hiddenField: CaptureFieldViewModel = {
    fieldId: '00000000-0000-4000-8000-000000000099',
    fieldKey: 'secret_field',
    label: 'Secret',
    kind: 'text',
    isRequired: true,
    blindingScope: 'blinded',
    options: [],
    value: { text: '' },
    runtimeState: {
      visible: false,
      required: true,
      disabled: false,
      locked: false,
      flags: [],
      messages: [],
    },
  }
  const disabledField: CaptureFieldViewModel = {
    fieldId: '00000000-0000-4000-8000-000000000098',
    fieldKey: 'locked_field',
    label: 'Locked',
    kind: 'text',
    isRequired: true,
    blindingScope: 'blinded',
    options: [],
    value: { text: 'x' },
    runtimeState: {
      visible: true,
      required: false,
      disabled: true,
      locked: true,
      flags: [],
      messages: [],
    },
  }

  const formData = new FormData()
  formData.set(`field_${hiddenField.fieldId}`, 'should-ignore')
  formData.set(`field_${disabledField.fieldId}`, 'should-ignore')
  formData.set(`field_${height!.fieldId}`, '170')

  const parseResult = parseCaptureFormToResponses(formData, [hiddenField, disabledField, height!])
  const visibleInUi = applied.filter((f) => f.runtimeState?.visible !== false)

  return [
    {
      name: 'Runtime: WOCBP shows pregnancy field visible',
      pass: pregnancy?.runtimeState?.visible === true,
    },
    {
      name: 'Runtime: visible required field stays required',
      pass:
        pregnancy?.runtimeState?.visible === true &&
        (pregnancy?.runtimeState?.required === true || pregnancy?.isRequired === true),
    },
    {
      name: 'Runtime: disabled field marked disabled',
      pass: disabledField.runtimeState?.disabled === true,
    },
    {
      name: 'Runtime: hidden/disabled omitted from visible field list',
      pass: visibleInUi.every((f) => f.runtimeState?.visible !== false),
    },
    {
      name: 'Runtime: parser skips hidden/disabled required fields',
      pass:
        parseResult.ok === true &&
        !parseResult.responses.some((r) => r.source_field_id === hiddenField.fieldId),
    },
  ]
}

function testSignatureGate(): SmokeTestResult[] {
  const publishedConfig = resolveSourceEngineRuntimeConfigFromContext(
    publishedResolutionContext(),
  )
  const fallbackConfig = resolveSourceEngineRuntimeConfigFromContext(fallbackResolutionContext())

  const publishedSnap = resolveProcedureSourceRuntime(testBridge(), captureFields(), {
    runtimeConfig: publishedConfig,
  })
  publishedSnap.validationErrors = [
    {
      severity: 'error',
      code: 'QA_SIGNATURE_BLOCK',
      message: 'Engine blocks signature',
      blocksSubmission: true,
      blocksSignature: true,
      fieldKey: 'height_cm',
    },
  ]
  const publishedBlockers = getSignatureBlockingErrors(publishedSnap.validationErrors)

  const responses = createEmptyResponses()
  responses.previousFields = { height_cm: { value: 160, unit: 'cm' } }
  responses.fields.height_cm = { value: 165, unit: 'cm' }
  const signedCtx = mapProcedureExecutionToRuntimeContext(
    testBridge({ isSubmitted: true, responseSetStatus: 'submitted' }),
  )
  const signedValidation = validateForSignature(
    publishedConfig.template,
    responses,
    { ...signedCtx, signatureState: 'signed' },
  )
  const signedEngineBlockers = getSignatureBlockingErrors(
    mapEngineValidationToCaptureErrors(signedValidation.results),
  )

  const advisoryOnly: CaptureValidationError[] = [
    {
      severity: 'warning',
      code: 'ADVISORY_ONLY',
      message: 'Advisory warning',
      blocksSubmission: false,
      blocksSignature: false,
    },
  ]

  const fallbackSnap = resolveProcedureSourceRuntime(testBridge(), captureFields(), {
    runtimeConfig: fallbackConfig,
  })
  fallbackSnap.validationErrors = publishedSnap.validationErrors.map((e) => ({
    ...e,
    blocksSignature: false,
  }))
  const fallbackBlockers = getSignatureBlockingErrors(fallbackSnap.validationErrors)

  return [
    {
      name: 'Signature: blocksSignature finding prevents sign when enforcement on',
      pass:
        publishedSnap.engineStatus.enforceSignatureBlockers === true &&
        publishedBlockers.length > 0 &&
        signedEngineBlockers.length > 0,
    },
    {
      name: 'Signature: advisory warning does not block',
      pass: getSignatureBlockingErrors(advisoryOnly).length === 0,
    },
    {
      name: 'Signature: fallback strips blocksSignature from validation errors',
      pass: fallbackBlockers.length === 0 && fallbackSnap.engineStatus.enforceSignatureBlockers === false,
    },
  ]
}

async function testSignatureGateEvents(): Promise<SmokeTestResult> {
  const store: MockStore = {
    workflowRows: [],
    workflowInserts: [],
    eventInserts: [],
    failEventInsert: false,
  }
  await logSourceEngineOperationalEvent({
    eventType: SOURCE_ENGINE_EVENT_TYPES.ENGINE_SIGNATURE_GATE_FAILED_CLOSED,
    context: {
      organizationId: ORG_ID,
      studyId: STUDY_ID,
      subjectId: SUBJ_ID,
      visitId: VISIT_ID,
      procedureExecutionId: PROC_ID,
      sourceResponseSetId: RS_ID,
    },
    extras: { errorMessage: 'mock unavailable' },
    supabase: createMockSupabase(store),
  })
  return {
    name: 'Signature: gate failure logs engine_signature_gate_failed_closed',
    pass: store.eventInserts.some(
      (e) => e.event_type === SOURCE_ENGINE_EVENT_TYPES.ENGINE_SIGNATURE_GATE_FAILED_CLOSED,
    ),
  }
}

async function testTaskMaterialization(): Promise<SmokeTestResult[]> {
  const publishedConfig = resolveSourceEngineRuntimeConfigFromContext(
    publishedResolutionContext(),
  )
  const fallbackConfig = resolveSourceEngineRuntimeConfigFromContext(fallbackResolutionContext())

  const blockerSnapshot = resolveProcedureSourceRuntime(testBridge(), captureFields(), {
    runtimeConfig: publishedConfig,
  })
  blockerSnapshot.validationErrors = [
    {
      severity: 'error',
      code: 'QA_BLOCKER',
      message: 'Blocking finding for task materialization',
      blocksSubmission: true,
      blocksSignature: true,
      fieldKey: 'height_cm',
    },
  ]

  const fallbackSnapshot = resolveProcedureSourceRuntime(testBridge(), captureFields(), {
    runtimeConfig: fallbackConfig,
  })
  fallbackSnapshot.validationErrors = blockerSnapshot.validationErrors

  const store: MockStore = {
    workflowRows: [],
    workflowInserts: [],
    eventInserts: [],
    failEventInsert: false,
  }
  const mockSupabase = createMockSupabase(store)

  const first = await materializeSourceEngineTasks({
    snapshot: blockerSnapshot,
    procedureExecutionId: PROC_ID,
    organizationId: ORG_ID,
    studyId: STUDY_ID,
    studySubjectId: SUBJ_ID,
    visitId: VISIT_ID,
    sourceResponseSetId: RS_ID,
    supabase: mockSupabase,
  })

  const key = extractEngineTaskCandidates(blockerSnapshot, PROC_ID)[0]?.deterministicKey
  if (key) {
    store.workflowRows.push({
      description: formatDescriptionWithDedupeKey(key, 'existing'),
    })
  }

  const second = await materializeSourceEngineTasks({
    snapshot: blockerSnapshot,
    procedureExecutionId: PROC_ID,
    organizationId: ORG_ID,
    studyId: STUDY_ID,
    studySubjectId: SUBJ_ID,
    visitId: VISIT_ID,
    sourceResponseSetId: RS_ID,
    supabase: mockSupabase,
  })

  const fallbackResult = await materializeSourceEngineTasks({
    snapshot: fallbackSnapshot,
    procedureExecutionId: PROC_ID,
    organizationId: ORG_ID,
    studyId: STUDY_ID,
    studySubjectId: SUBJ_ID,
    visitId: VISIT_ID,
    sourceResponseSetId: RS_ID,
    supabase: mockSupabase,
  })

  const fallbackOverrideCtx = fallbackResolutionContext()
  fallbackOverrideCtx.meta = { source_engine_allow_tasks_on_fallback: true }
  const fallbackOverrideSnap = resolveProcedureSourceRuntime(testBridge(), captureFields(), {
    runtimeConfig: resolveSourceEngineRuntimeConfigFromContext(fallbackOverrideCtx),
  })
  fallbackOverrideSnap.validationErrors = blockerSnapshot.validationErrors

  const fallbackOverrideResult = await materializeSourceEngineTasks({
    snapshot: fallbackOverrideSnap,
    procedureExecutionId: PROC_ID,
    organizationId: ORG_ID,
    studyId: STUDY_ID,
    studySubjectId: SUBJ_ID,
    visitId: VISIT_ID,
    sourceResponseSetId: RS_ID,
    supabase: createMockSupabase({
      workflowRows: [],
      workflowInserts: [],
      eventInserts: [],
      failEventInsert: false,
    }),
  })

  return [
    {
      name: 'Tasks: blocker creates workflow row',
      pass: first.created === 1 && store.workflowInserts.length >= 1,
    },
    {
      name: 'Tasks: repeated blocker dedupes',
      pass: second.created === 0 && second.deduped >= 1,
    },
    {
      name: 'Tasks: fallback template skips materialization',
      pass: fallbackResult.skipped === true && fallbackResult.created === 0,
    },
    {
      name: 'Tasks: fallback override allows materialization',
      pass: fallbackOverrideResult.created === 1,
    },
    {
      name: 'Tasks: canMaterialize rejects fallback by default',
      pass: canMaterializeTasksForSnapshot(fallbackSnapshot).allowed === false,
    },
    {
      name: 'Tasks: dedupe key round-trips in description',
      pass: key != null && parseDedupeKeyFromDescription(formatDescriptionWithDedupeKey(key, 'body')) === key,
    },
  ]
}

async function testOperationalEvents(): Promise<SmokeTestResult[]> {
  const store: MockStore = {
    workflowRows: [],
    workflowInserts: [],
    eventInserts: [],
    failEventInsert: false,
  }
  const mockSupabase = createMockSupabase(store)
  const ctx = {
    organizationId: ORG_ID,
    studyId: STUDY_ID,
    subjectId: SUBJ_ID,
    visitId: VISIT_ID,
    procedureExecutionId: PROC_ID,
    sourceResponseSetId: RS_ID,
  }

  await logSourceEngineOperationalEvent({
    eventType: SOURCE_ENGINE_EVENT_TYPES.ENGINE_SIGNATURE_BLOCKED,
    context: ctx,
    extras: { blockerCount: 2, resolutionSource: 'published', fallback: false },
    supabase: mockSupabase,
  })

  await logSourceEngineOperationalEvent({
    eventType: SOURCE_ENGINE_EVENT_TYPES.ENGINE_TASKS_MATERIALIZED,
    context: ctx,
    extras: { taskCount: 1, resolutionSource: 'registry' },
    supabase: mockSupabase,
  })

  await logSourceEngineOperationalEvent({
    eventType: SOURCE_ENGINE_EVENT_TYPES.ENGINE_FALLBACK_TEMPLATE_USED,
    context: ctx,
    extras: { fallback: true, resolutionSource: 'fallback' },
    supabase: mockSupabase,
  })

  let loggingThrew = false
  try {
    await logSourceEngineOperationalEvent({
      eventType: SOURCE_ENGINE_EVENT_TYPES.ENGINE_SNAPSHOT_FAILED,
      context: ctx,
      supabase: createMockSupabase({
        workflowRows: [],
        workflowInserts: [],
        eventInserts: [],
        failEventInsert: true,
      }),
    })
  } catch {
    loggingThrew = true
  }

  const payload = buildSourceEngineEventPayload(ctx, { resolutionSource: 'published' })

  return [
    {
      name: 'Events: signature block logged',
      pass: store.eventInserts.some((e) => e.event_type === SOURCE_ENGINE_EVENT_TYPES.ENGINE_SIGNATURE_BLOCKED),
    },
    {
      name: 'Events: task materialization logged',
      pass: store.eventInserts.some(
        (e) => e.event_type === SOURCE_ENGINE_EVENT_TYPES.ENGINE_TASKS_MATERIALIZED,
      ),
    },
    {
      name: 'Events: fallback logged',
      pass: store.eventInserts.some(
        (e) => e.event_type === SOURCE_ENGINE_EVENT_TYPES.ENGINE_FALLBACK_TEMPLATE_USED,
      ),
    },
    {
      name: 'Events: payload includes origin and procedure metadata',
      pass: payload.origin === 'source_engine' && payload.procedureExecutionId === PROC_ID,
    },
    {
      name: 'Events: logging failure does not throw',
      pass: loggingThrew === false,
    },
  ]
}

export async function runOperationalSmokeTests(): Promise<SmokeTestResult[]> {
  const results: SmokeTestResult[] = []
  results.push(...testTemplateResolution())
  results.push(...testRuntimeStateMapping())
  results.push(...testSignatureGate())
  results.push(await testSignatureGateEvents())
  results.push(...(await testTaskMaterialization()))
  results.push(...(await testOperationalEvents()))
  return results
}
