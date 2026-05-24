/**
 * Phase 16A-3 — Runtime observability hooks smoke (static + mock Supabase).
 */
import assert from 'node:assert/strict'
import {
  WORKFLOW_AUTHORITY_LEVEL,
  WORKFLOW_KEY,
} from '../lib/governance/workflow-authority'
import {
  OBS_COMPLIANCE_HOOK_SIGNALS,
  OBS_FORBIDDEN_AUTHORITY_METADATA_KEYS,
  OBS_HOOK_SIGNAL,
  RUNTIME_TRACE_STATUS,
  RUNTIME_TRACE_TYPE,
  WORKFLOW_TELEMETRY_TYPE,
  buildRuntimeTraceInsertPayload,
  observeBreakGlassAccessRequested,
  observeDelegationRuntimeChecked,
  observeTemporalConsistencyEvaluated,
  recordRuntimeTrace,
  recordWorkflowTelemetry,
  redactTelemetryMetadata,
  safeObserve,
  safeObserveAwait,
} from '../lib/observability'

function createMockSupabase() {
  const runtimeTraces: Record<string, unknown>[] = []
  const telemetry: Record<string, unknown>[] = []

  return {
    runtimeTraces,
    telemetry,
    client: {
      from(table: string) {
        return {
          insert(row: Record<string, unknown>) {
            return {
              select() {
                return {
                  async single() {
                    if (table === 'runtime_traces') {
                      runtimeTraces.push(row)
                      return { data: { id: 'trace-mock-1' }, error: null }
                    }
                    if (table === 'workflow_telemetry_events') {
                      telemetry.push(row)
                      return { data: { id: 'telemetry-mock-1' }, error: null }
                    }
                    return { data: null, error: { message: 'unknown table' } }
                  },
                }
              },
            }
          },
        }
      },
    },
  }
}

async function smokeSafeObserve() {
  await safeObserveAwait('throws', async () => {
    throw new Error('observability write failed')
  })
}

function smokeMetadataRedaction() {
  const redacted = redactTelemetryMetadata({
    signal: OBS_HOOK_SIGNAL.SOURCE_DRAFT_SAVED,
    patient_name: 'remove-me',
    authorityLabel: 'Human Required',
    nested: { mrn: '1', ok: true },
  })
  assert.equal('patient_name' in redacted, false)
  assert.equal('authorityLabel' in redacted, false)
  assert.deepEqual(redacted.nested, { ok: true })
}

function smokeAuthoritySerialization() {
  const payload = buildRuntimeTraceInsertPayload({
    organizationId: '00000000-0000-4000-8000-000000000001',
    studyId: '00000000-0000-4000-8000-000000000002',
    traceType: RUNTIME_TRACE_TYPE.MUTATION_GATEWAY,
    status: RUNTIME_TRACE_STATUS.COMPLETED,
    workflowKey: WORKFLOW_KEY.SOURCE_SIGNING,
    baseAuthorityLevel: WORKFLOW_AUTHORITY_LEVEL.SYSTEM_ENFORCED,
    effectiveAuthorityLevel: WORKFLOW_AUTHORITY_LEVEL.SYSTEM_ENFORCED,
    metadata: {
      signal: OBS_HOOK_SIGNAL.CLINICAL_MUTATION_EMITTED,
      authorityName: 'strip-me',
    },
  })

  assert.equal(payload.workflowKey, 'source_signing')
  assert.equal(payload.baseAuthorityLevel, 'system_enforced')
  assert.equal(payload.effectiveAuthorityLevel, 'system_enforced')
  for (const key of OBS_FORBIDDEN_AUTHORITY_METADATA_KEYS) {
    assert.equal(key in payload.metadata, false)
  }
  const json = JSON.stringify(payload)
  assert.equal(json.includes('authorityName'), false)
  assert.equal(json.includes('authorityLabel'), false)
}

async function smokeRecordHelpers() {
  const mock = createMockSupabase()

  await recordRuntimeTrace({
    supabase: mock.client as never,
    organizationId: '00000000-0000-4000-8000-000000000001',
    studyId: '00000000-0000-4000-8000-000000000002',
    traceType: RUNTIME_TRACE_TYPE.MUTATION_GATEWAY,
    status: RUNTIME_TRACE_STATUS.COMPLETED,
    workflowKey: WORKFLOW_KEY.ELIGIBILITY,
    baseAuthorityLevel: WORKFLOW_AUTHORITY_LEVEL.HUMAN_REQUIRED,
    effectiveAuthorityLevel: WORKFLOW_AUTHORITY_LEVEL.HUMAN_REQUIRED,
    metadata: { signal: OBS_HOOK_SIGNAL.CLINICAL_MUTATION_EMITTED, mutation: 'test' },
  })

  assert.equal(mock.runtimeTraces.length, 1)
  const traceRow = mock.runtimeTraces[0]!
  assert.equal(traceRow.workflow_key, 'eligibility')
  assert.equal(traceRow.base_authority_level, 'human_required')
  assert.equal(traceRow.effective_authority_level, 'human_required')

  await recordWorkflowTelemetry({
    supabase: mock.client as never,
    organizationId: '00000000-0000-4000-8000-000000000001',
    telemetryType: WORKFLOW_TELEMETRY_TYPE.GOVERNANCE_SIGNAL,
    signal: OBS_HOOK_SIGNAL.VISIT_RUNTIME_UI_MODEL_LOADED,
    workflowKey: WORKFLOW_KEY.VISIT_LOCKING,
    metadata: {
      blocked: true,
      next_action_count: 2,
      authorityDisplayName: 'should-strip',
    },
  })

  assert.equal(mock.telemetry.length, 1)
  const telemetryRow = mock.telemetry[0]!
  assert.equal(telemetryRow.workflow_key, 'visit_locking')
  const meta = telemetryRow.metadata as Record<string, unknown>
  assert.equal(meta.blocked, true)
  assert.equal('authorityDisplayName' in meta, false)
}

function smokeComplianceHookSignals() {
  assert.deepEqual(OBS_COMPLIANCE_HOOK_SIGNALS, [
    'temporal_consistency_evaluated',
    'delegation_runtime_checked',
    'break_glass_access_requested',
  ])
  assert.equal(OBS_HOOK_SIGNAL.TEMPORAL_CONSISTENCY_EVALUATED, 'temporal_consistency_evaluated')
  assert.equal(OBS_HOOK_SIGNAL.DELEGATION_RUNTIME_CHECKED, 'delegation_runtime_checked')
  assert.equal(OBS_HOOK_SIGNAL.BREAK_GLASS_ACCESS_REQUESTED, 'break_glass_access_requested')
}

async function smokeComplianceObserveHooks() {
  const mock = createMockSupabase()

  observeTemporalConsistencyEvaluated({
    supabase: mock.client as never,
    organizationId: '00000000-0000-4000-8000-000000000001',
    studyId: '00000000-0000-4000-8000-000000000002',
    evaluationId: 'eval-1',
    ruleKey: 'consent_before_screening',
    evaluationResult: 'pass',
    severity: 'blocker',
  })

  observeDelegationRuntimeChecked({
    supabase: mock.client as never,
    organizationId: '00000000-0000-4000-8000-000000000001',
    studyId: '00000000-0000-4000-8000-000000000002',
    actorUserId: '00000000-0000-4000-8000-000000000003',
    checkId: 'chk-1',
    checkResult: 'delegated',
    delegated: true,
    systemBlocking: false,
    requiresPiDelegation: false,
    regulated: true,
    workflowKey: WORKFLOW_KEY.SOURCE_SIGNING,
  })

  observeBreakGlassAccessRequested({
    supabase: mock.client as never,
    organizationId: '00000000-0000-4000-8000-000000000001',
    studyId: '00000000-0000-4000-8000-000000000002',
    actorUserId: '00000000-0000-4000-8000-000000000003',
    eventId: 'bg-1',
    workflowKey: WORKFLOW_KEY.SOURCE_SIGNING,
    baseAuthorityLevel: WORKFLOW_AUTHORITY_LEVEL.SYSTEM_ENFORCED,
    effectiveAuthorityLevel: WORKFLOW_AUTHORITY_LEVEL.SYSTEM_ENFORCED,
    accessScope: 'read',
    resourceType: 'source_response_set',
    approvalMode: 'self_granted',
  })

  await new Promise((resolve) => setTimeout(resolve, 50))
  assert.equal(mock.telemetry.length, 3)

  const temporalRow = mock.telemetry.find(
    (r) =>
      (r.metadata as Record<string, unknown>).signal ===
      OBS_HOOK_SIGNAL.TEMPORAL_CONSISTENCY_EVALUATED,
  )
  assert.ok(temporalRow)
  const temporalMeta = temporalRow!.metadata as Record<string, unknown>
  assert.equal(temporalMeta.base_authority_level, 'human_required')
  assert.equal(temporalMeta.effective_authority_level, 'human_required')
  assert.equal('authorityName' in temporalMeta, false)
}

function smokeObservabilityDoesNotBlockCaller() {
  let callerResult: string | null = null

  const failingClient = {
    from() {
      return {
        insert() {
          return {
            select() {
              return {
                async single() {
                  throw new Error('simulated observability db failure')
                },
              }
            },
          }
        },
      }
    },
  }

  safeObserve('compliance-fail', async () => {
    await recordWorkflowTelemetry({
      supabase: failingClient as never,
      organizationId: '00000000-0000-4000-8000-000000000001',
      telemetryType: WORKFLOW_TELEMETRY_TYPE.GOVERNANCE_SIGNAL,
      signal: OBS_HOOK_SIGNAL.TEMPORAL_CONSISTENCY_EVALUATED,
      studyId: '00000000-0000-4000-8000-000000000002',
    })
  })

  callerResult = 'clinical-operation-succeeded'
  assert.equal(callerResult, 'clinical-operation-succeeded')
}

async function main() {
  await smokeSafeObserve()
  smokeMetadataRedaction()
  smokeAuthoritySerialization()
  await smokeRecordHelpers()
  smokeComplianceHookSignals()
  await smokeComplianceObserveHooks()
  smokeObservabilityDoesNotBlockCaller()
  console.log('Phase 16A-3 runtime observability hooks smoke: PASS')
}

main()
