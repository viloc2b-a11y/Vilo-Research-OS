/**
 * Phase 16A-2 — Runtime observability schema smoke (static, no DB).
 * Run: npx tsx scripts/phase16a2-runtime-observability-smoke.ts
 */
import assert from 'node:assert/strict'
import {
  WORKFLOW_AUTHORITY_LEVEL,
  WORKFLOW_KEY,
  buildGovernedWorkflowTraceRefs,
} from '../lib/governance/workflow-authority'
import {
  OBS_FORBIDDEN_AUTHORITY_METADATA_KEYS,
  RUNTIME_TRACE_STATUS,
  RUNTIME_TRACE_STATUSES,
  RUNTIME_TRACE_TYPE,
  WORKFLOW_TELEMETRY_TYPE,
  WORKFLOW_TELEMETRY_TYPES,
  buildRuntimeTraceInsertPayload,
  collectTelemetryMetadataIssues,
  isRuntimeTraceStatus,
  isWorkflowTelemetryType,
  redactTelemetryMetadata,
  toRuntimeTraceAuthorityColumns,
  validateRuntimeTraceAuthorityFields,
} from '../lib/observability'

function smokeTraceStatusConstants() {
  assert.deepEqual(RUNTIME_TRACE_STATUSES, [
    'started',
    'in_progress',
    'completed',
    'failed',
    'cancelled',
    'degraded',
  ])
  assert.equal(isRuntimeTraceStatus(RUNTIME_TRACE_STATUS.COMPLETED), true)
  assert.equal(isRuntimeTraceStatus('unknown'), false)
}

function smokeTelemetryTypeConstants() {
  assert.ok(WORKFLOW_TELEMETRY_TYPES.includes(WORKFLOW_TELEMETRY_TYPE.AUTHORITY_RESOLVED))
  assert.equal(isWorkflowTelemetryType('authority_resolved'), true)
  assert.equal(isWorkflowTelemetryType('free_form'), false)
}

function smokeMetadataRedaction() {
  const redacted = redactTelemetryMetadata({
    layer: 'obs-1',
    patient_name: 'must-remove',
    authorityLabel: 'Human Required',
    nested: { mrn: '123', ok: true },
  })
  assert.equal('patient_name' in redacted, false)
  assert.equal('authorityLabel' in redacted, false)
  assert.deepEqual(redacted.nested, { ok: true })
  assert.ok(collectTelemetryMetadataIssues(redacted).length === 0)

  const issues = collectTelemetryMetadataIssues({ subject_id: 'x' })
  assert.ok(issues.length > 0)
}

function smokeObs2AuthorityFields() {
  const fail = validateRuntimeTraceAuthorityFields({
    workflowKey: WORKFLOW_KEY.ELIGIBILITY,
    baseAuthorityLevel: null,
    effectiveAuthorityLevel: WORKFLOW_AUTHORITY_LEVEL.HUMAN_REQUIRED,
  })
  assert.equal(fail.ok, false)

  const refs = buildGovernedWorkflowTraceRefs({
    workflowKey: WORKFLOW_KEY.SOURCE_SIGNING,
    baseAuthorityLevel: WORKFLOW_AUTHORITY_LEVEL.SYSTEM_ENFORCED,
    effectiveAuthorityLevel: WORKFLOW_AUTHORITY_LEVEL.SYSTEM_ENFORCED,
  })

  const columns = toRuntimeTraceAuthorityColumns(refs)
  assert.equal(columns.workflowKey, 'source_signing')
  assert.equal(columns.baseAuthorityLevel, 'system_enforced')
  assert.equal(columns.effectiveAuthorityLevel, 'system_enforced')

  const payload = buildRuntimeTraceInsertPayload({
    organizationId: '00000000-0000-4000-8000-000000000001',
    traceType: RUNTIME_TRACE_TYPE.WORKFLOW_EXECUTION,
    status: RUNTIME_TRACE_STATUS.STARTED,
    workflowKey: WORKFLOW_KEY.ELIGIBILITY,
    baseAuthorityLevel: WORKFLOW_AUTHORITY_LEVEL.HUMAN_REQUIRED,
    effectiveAuthorityLevel: WORKFLOW_AUTHORITY_LEVEL.HUMAN_REQUIRED,
    metadata: {
      projection_version: 2,
      authorityName: 'should be stripped',
    },
  })

  assert.equal(payload.workflowKey, 'eligibility')
  assert.equal(payload.baseAuthorityLevel, 'human_required')
  assert.equal(payload.effectiveAuthorityLevel, 'human_required')
  assert.equal('authorityName' in payload.metadata, false)

  for (const key of OBS_FORBIDDEN_AUTHORITY_METADATA_KEYS) {
    assert.equal(key in payload.metadata, false)
  }

  const serialized = JSON.stringify(payload)
  assert.equal(serialized.includes('authorityName'), false)
  assert.equal(serialized.includes('authorityLabel'), false)
}

function main() {
  smokeTraceStatusConstants()
  smokeTelemetryTypeConstants()
  smokeMetadataRedaction()
  smokeObs2AuthorityFields()
  console.log('Phase 16A-2 runtime observability smoke: PASS')
}

main()
