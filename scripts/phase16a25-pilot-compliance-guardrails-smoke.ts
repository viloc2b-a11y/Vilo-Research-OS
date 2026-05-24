/**
 * Phase 16A-2.5 — Pilot compliance guardrails smoke (static, no DB).
 */
import assert from 'node:assert/strict'
import { OPERATIONAL_EVENT_TYPES } from '../lib/operations/event-types'
import {
  BREAK_GLASS_APPROVAL_MODE,
  validateBreakGlassAccessRequest,
} from '../lib/break-glass'
import {
  WORKFLOW_AUTHORITY_LEVEL,
  WORKFLOW_KEY,
} from '../lib/governance/workflow-authority'
import {
  checkDelegationRuntime,
  DELEGATION_CHECK_RESULT,
  DELEGATION_RUNTIME_OUTCOME,
} from '../lib/delegation-runtime'
import {
  collectGuardrailMetadataIssues,
  evaluateTemporalConsistencyRule,
  redactGuardrailMetadata,
  TEMPORAL_CONSTRAINT_TYPE,
  TEMPORAL_EVALUATION_RESULT,
  TEMPORAL_SEVERITY,
} from '../lib/temporal-consistency'

function smokeTemporalEvaluator() {
  const pass = evaluateTemporalConsistencyRule({
    rule: {
      ruleKey: 'consent_before_screening',
      constraintType: TEMPORAL_CONSTRAINT_TYPE.A_BEFORE_OR_EQUAL_B,
      severity: TEMPORAL_SEVERITY.BLOCKER,
      systemBlocking: false,
    },
    eventAValue: '2026-01-01T10:00:00.000Z',
    eventBValue: '2026-01-02T10:00:00.000Z',
  })
  assert.equal(pass.evaluationResult, TEMPORAL_EVALUATION_RESULT.PASS)

  const fail = evaluateTemporalConsistencyRule({
    rule: {
      ruleKey: 'consent_before_screening',
      constraintType: TEMPORAL_CONSTRAINT_TYPE.A_BEFORE_OR_EQUAL_B,
      severity: TEMPORAL_SEVERITY.BLOCKER,
      systemBlocking: false,
    },
    eventAValue: '2026-01-03T10:00:00.000Z',
    eventBValue: '2026-01-02T10:00:00.000Z',
  })
  assert.equal(fail.evaluationResult, TEMPORAL_EVALUATION_RESULT.FAIL)

  const windowNa = evaluateTemporalConsistencyRule({
    rule: {
      ruleKey: 'ip_admin_window',
      constraintType: TEMPORAL_CONSTRAINT_TYPE.A_WITHIN_WINDOW_OF_B,
      severity: TEMPORAL_SEVERITY.BLOCKER,
      systemBlocking: true,
    },
    eventAValue: '2026-01-01T10:00:00.000Z',
    eventBValue: '2026-01-01T12:00:00.000Z',
  })
  assert.equal(windowNa.evaluationResult, TEMPORAL_EVALUATION_RESULT.NOT_APPLICABLE)

  const pending = evaluateTemporalConsistencyRule({
    rule: {
      ruleKey: 'consent_before_screening',
      constraintType: TEMPORAL_CONSTRAINT_TYPE.A_BEFORE_OR_EQUAL_B,
      severity: TEMPORAL_SEVERITY.BLOCKER,
      systemBlocking: false,
    },
    eventAValue: null,
    eventBValue: '2026-01-02T10:00:00.000Z',
  })
  assert.equal(pending.evaluationResult, TEMPORAL_EVALUATION_RESULT.PENDING)
  assert.notEqual(pending.evaluationResult, TEMPORAL_EVALUATION_RESULT.PASS)

  const blocked = evaluateTemporalConsistencyRule({
    rule: {
      ruleKey: 'lab_collection_before_lab_result',
      constraintType: TEMPORAL_CONSTRAINT_TYPE.A_BEFORE_OR_EQUAL_B,
      severity: TEMPORAL_SEVERITY.BLOCKER,
      systemBlocking: true,
    },
    eventAValue: '2026-01-05T10:00:00.000Z',
    eventBValue: '2026-01-02T10:00:00.000Z',
    enforce: true,
  })
  assert.equal(blocked.evaluationResult, TEMPORAL_EVALUATION_RESULT.BLOCKED)
}

function smokeBreakGlass() {
  const missingJustification = validateBreakGlassAccessRequest({
    supabase: {},
    organizationId: '00000000-0000-4000-8000-000000000001',
    actorUserId: '00000000-0000-4000-8000-000000000002',
    studyId: '00000000-0000-4000-8000-000000000003',
    workflowKey: WORKFLOW_KEY.SOURCE_SIGNING,
    accessScope: 'read',
    resourceType: 'source_response_set',
    justification: 'short',
    approvalMode: BREAK_GLASS_APPROVAL_MODE.SELF_GRANTED,
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
  })
  assert.ok(missingJustification.length > 0)

  const invalidMode = validateBreakGlassAccessRequest({
    supabase: {},
    organizationId: '00000000-0000-4000-8000-000000000001',
    actorUserId: '00000000-0000-4000-8000-000000000002',
    studyId: '00000000-0000-4000-8000-000000000003',
    workflowKey: WORKFLOW_KEY.SOURCE_SIGNING,
    accessScope: 'read',
    resourceType: 'source_response_set',
    justification: 'Coordinator requires urgent read-only access for query resolution.',
    approvalMode: BREAK_GLASS_APPROVAL_MODE.DUAL_CONFIRMED,
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
  })
  assert.ok(invalidMode.some((e) => e.includes('dual_confirmed')))

  const ok = validateBreakGlassAccessRequest({
    supabase: {},
    organizationId: '00000000-0000-4000-8000-000000000001',
    actorUserId: '00000000-0000-4000-8000-000000000002',
    studyId: '00000000-0000-4000-8000-000000000003',
    workflowKey: WORKFLOW_KEY.SOURCE_SIGNING,
    baseAuthorityLevel: WORKFLOW_AUTHORITY_LEVEL.SYSTEM_ENFORCED,
    effectiveAuthorityLevel: WORKFLOW_AUTHORITY_LEVEL.SYSTEM_ENFORCED,
    accessScope: 'read',
    resourceType: 'source_response_set',
    justification: 'Coordinator requires urgent read-only access for query resolution.',
    approvalMode: BREAK_GLASS_APPROVAL_MODE.SELF_GRANTED,
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
  })
  assert.equal(ok.length, 0)
}

function smokeDelegation() {
  const unknown = checkDelegationRuntime({
    requirement: null,
    delegated: false,
  })
  assert.equal(unknown.outcome, DELEGATION_RUNTIME_OUTCOME.UNKNOWN)
  assert.equal(unknown.checkResult, DELEGATION_CHECK_RESULT.UNKNOWN)

  const delegated = checkDelegationRuntime({
    requirement: {
      id: 'r1',
      organizationId: null,
      studyId: null,
      studyVersionId: null,
      procedureKey: 'blood_draw',
      workflowKey: WORKFLOW_KEY.LAB_SAFETY_ESCALATION,
      requiresDelegation: true,
      requiresPiDelegation: true,
      regulated: true,
      blockingIfMissing: true,
      active: true,
      notes: null,
    },
    delegated: true,
  })
  assert.equal(delegated.outcome, DELEGATION_RUNTIME_OUTCOME.DELEGATED)

  const warning = checkDelegationRuntime({
    requirement: {
      id: 'r1',
      organizationId: null,
      studyId: null,
      studyVersionId: null,
      procedureKey: 'blood_draw',
      workflowKey: WORKFLOW_KEY.LAB_SAFETY_ESCALATION,
      requiresDelegation: true,
      requiresPiDelegation: false,
      regulated: true,
      blockingIfMissing: false,
      active: true,
      notes: null,
    },
    delegated: false,
  })
  assert.equal(warning.outcome, DELEGATION_RUNTIME_OUTCOME.WARNING)

  const blocked = checkDelegationRuntime({
    requirement: {
      id: 'r1',
      organizationId: null,
      studyId: null,
      studyVersionId: null,
      procedureKey: 'ip_administration',
      workflowKey: WORKFLOW_KEY.RANDOMIZATION,
      requiresDelegation: true,
      requiresPiDelegation: true,
      regulated: true,
      blockingIfMissing: true,
      active: true,
      notes: null,
    },
    delegated: false,
    enforce: true,
  })
  assert.equal(blocked.outcome, DELEGATION_RUNTIME_OUTCOME.BLOCKED)
  assert.equal(blocked.systemBlocking, true)
}

function smokeEventConstants() {
  assert.equal(OPERATIONAL_EVENT_TYPES.TEMPORAL_CONSISTENCY_EVALUATED, 'TEMPORAL_CONSISTENCY_EVALUATED')
  assert.equal(OPERATIONAL_EVENT_TYPES.BREAK_GLASS_ACCESS_REQUESTED, 'BREAK_GLASS_ACCESS_REQUESTED')
  assert.equal(OPERATIONAL_EVENT_TYPES.DELEGATION_RUNTIME_CHECKED, 'DELEGATION_RUNTIME_CHECKED')
}

function smokeMetadataPhi() {
  const issues = collectGuardrailMetadataIssues({
    patient_name: 'x',
    nested: { subject_id: 'y', ok: true },
  })
  assert.ok(issues.length >= 2)
  const redacted = redactGuardrailMetadata({ patient_name: 'x', count: 1 })
  assert.equal('patient_name' in redacted, false)
  assert.equal(redacted.count, 1)
}

function main() {
  smokeTemporalEvaluator()
  smokeBreakGlass()
  smokeDelegation()
  smokeEventConstants()
  smokeMetadataPhi()
  console.log('Phase 16A-2.5 pilot compliance guardrails smoke: PASS')
}

main()
