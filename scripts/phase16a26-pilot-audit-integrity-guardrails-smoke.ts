/**
 * Phase 16A-2.6 — Pilot audit integrity guardrails smoke (static, no DB).
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  WORKFLOW_ESCALATION_RULE_KEY,
  WORKFLOW_KEY,
  WORKFLOW_KEYS,
  assertWorkflowKey,
} from '../lib/governance/workflow-authority'
import {
  assertConditionExpressionNotMutated,
  assertWorkflowKeyNotRenamed,
} from '../lib/governance/workflow-authority/immutability'
import {
  OBS_AUDIT_INTEGRITY_HOOK_SIGNALS,
  OBS_HOOK_SIGNAL,
} from '../lib/observability/hook-signals'
import { collectTelemetryMetadataIssues } from '../lib/observability/redact-telemetry-metadata'
import { OPERATIONAL_EVENT_TYPES } from '../lib/operations/event-types'
import {
  hashFieldValue,
  normalizeSourceFieldValueForHash,
  SOURCE_SNAPSHOT_VERIFY_RESULT,
  verifySourceSnapshot,
} from '../lib/source/integrity'
import {
  checkRoleConflict,
  findGlobalRoleConflictPolicy,
  GLOBAL_ROLE_CONFLICT_POLICIES,
  ROLE_CONFLICT_RESOLUTION,
  ROLE_CONFLICT_TYPE,
  roleConflictRequiresJustification,
} from '../lib/role-conflicts'

function smokeFieldHashing() {
  const slots = { valueType: 'text', valueText: 'alpha', valueNumber: null }
  const normalized = normalizeSourceFieldValueForHash(slots)
  assert.ok(normalized.includes('alpha'))

  const hash1 = hashFieldValue(slots)
  const hash2 = hashFieldValue({ valueType: 'text', valueText: 'alpha' })
  assert.equal(hash1, hash2)
  assert.match(hash1, /^[a-f0-9]{64}$/)
  assert.notEqual(hash1, hashFieldValue({ valueType: 'text', valueText: 'beta' }))
}

function smokeSnapshotImmutabilityMigration() {
  const sql = readFileSync(
    join(process.cwd(), 'supabase/migrations/0088_phase16a26_source_integrity.sql'),
    'utf8',
  )
  assert.ok(sql.includes('block_source_snapshot_updates'))
  assert.ok(sql.includes('source_response_field_snapshots are immutable'))
  assert.ok(!sql.includes('auto_snapshot_on_submit'))
  assert.ok(!/trigger[\s\S]*on public\.source_responses/i.test(sql))
}

function smokeStaleWorkflowLogic() {
  const thresholdHours = 24
  const fresh = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()
  const stale = new Date(Date.now() - 30 * 60 * 60 * 1000).toISOString()

  function staleAgeHours(lastActiveAt: string): number {
    return (Date.now() - new Date(lastActiveAt).getTime()) / (1000 * 60 * 60)
  }

  assert.ok(staleAgeHours(fresh) < thresholdHours)
  assert.ok(staleAgeHours(stale) >= thresholdHours)
}

async function smokeRoleConflicts() {
  assert.equal(GLOBAL_ROLE_CONFLICT_POLICIES.length, 5)

  const selfSign = findGlobalRoleConflictPolicy(
    WORKFLOW_KEY.SOURCE_SIGNING,
    ROLE_CONFLICT_TYPE.SELF_SIGN,
  )
  assert.ok(selfSign)
  assert.equal(selfSign.resolution, ROLE_CONFLICT_RESOLUTION.BLOCKED)

  const blocked = await checkRoleConflict({
    organizationId: '00000000-0000-4000-8000-000000000001',
    workflowKey: WORKFLOW_KEY.SOURCE_SIGNING,
    conflictType: ROLE_CONFLICT_TYPE.SELF_SIGN,
    selfConflict: true,
  })
  assert.equal(blocked.conflictDetected, true)
  assert.equal(blocked.blocked, true)

  assert.equal(
    roleConflictRequiresJustification({
      resolution: ROLE_CONFLICT_RESOLUTION.ALLOWED_WITH_JUSTIFICATION,
      justificationRequired: true,
      justification: 'short',
    }),
    true,
  )
  assert.equal(
    roleConflictRequiresJustification({
      resolution: ROLE_CONFLICT_RESOLUTION.ALLOWED_WITH_JUSTIFICATION,
      justificationRequired: true,
      justification: 'valid clinical justification for self-review',
    }),
    false,
  )
}

function smokeGov1Registry() {
  assert.ok(WORKFLOW_KEYS.includes(WORKFLOW_KEY.SOURCE_INTEGRITY_SNAPSHOT))
  assert.ok(WORKFLOW_KEYS.includes(WORKFLOW_KEY.SOURCE_INTEGRITY_VIOLATION))
  assert.ok(WORKFLOW_KEYS.includes(WORKFLOW_KEY.WORKFLOW_ABANDONMENT_REVIEW))
  assert.ok(WORKFLOW_KEYS.includes(WORKFLOW_KEY.ROLE_CONFLICT_RESOLUTION))

  assertWorkflowKey(WORKFLOW_KEY.SOURCE_INTEGRITY_SNAPSHOT)
  assertWorkflowKey(WORKFLOW_KEY.SOURCE_INTEGRITY_VIOLATION)

  assert.equal(WORKFLOW_ESCALATION_RULE_KEY.HASH_MISMATCH_DETECTED, 'hash_mismatch_detected')
  assert.equal(
    WORKFLOW_ESCALATION_RULE_KEY.STALE_WORKFLOW_UNRESOLVED_PAST_ESCALATION_THRESHOLD,
    'stale_workflow_unresolved_past_escalation_threshold',
  )
  assert.equal(
    WORKFLOW_ESCALATION_RULE_KEY.SINGLE_STAFF_SITE_EXEMPTION,
    'single_staff_site_exemption',
  )

  assert.doesNotThrow(() => {
    assertWorkflowKeyNotRenamed({
      previousWorkflowKey: WORKFLOW_KEY.SOURCE_SIGNING,
      nextWorkflowKey: WORKFLOW_KEY.SOURCE_SIGNING,
    })
  })
  assert.throws(() => {
    assertWorkflowKeyNotRenamed({
      previousWorkflowKey: WORKFLOW_KEY.SOURCE_SIGNING,
      nextWorkflowKey: WORKFLOW_KEY.SOURCE_INTEGRITY_SNAPSHOT,
    })
  })

  assert.doesNotThrow(() => {
    assertConditionExpressionNotMutated({
      ruleKey: WORKFLOW_ESCALATION_RULE_KEY.HASH_MISMATCH_DETECTED,
      previousExpression: { field: 'stored_hash_matches_recalculated', operator: '=', value: false },
      nextExpression: { field: 'stored_hash_matches_recalculated', operator: '=', value: false },
    })
  })
  assert.throws(() => {
    assertConditionExpressionNotMutated({
      ruleKey: WORKFLOW_ESCALATION_RULE_KEY.HASH_MISMATCH_DETECTED,
      previousExpression: { field: 'stored_hash_matches_recalculated', operator: '=', value: false },
      nextExpression: { field: 'stored_hash_matches_recalculated', operator: '=', value: true },
    })
  })
}

function smokeVerifyResultTypes() {
  assert.equal(SOURCE_SNAPSHOT_VERIFY_RESULT.MATCH, 'match')
  assert.equal(SOURCE_SNAPSHOT_VERIFY_RESULT.MISMATCH, 'mismatch')
  assert.equal(SOURCE_SNAPSHOT_VERIFY_RESULT.MISSING_SNAPSHOT, 'missing_snapshot')
}

async function smokeVerifyWithEmptySupabase() {
  const noopSupabase = {
    from() {
      return {
        select() {
          return this
        },
        eq() {
          return this
        },
        order() {
          return this
        },
        limit() {
          return this
        },
        maybeSingle: async () => ({ data: null, error: null }),
        then(resolve: (v: { data: never[]; error: null }) => void) {
          resolve({ data: [], error: null })
        },
      }
    },
  }

  const outcome = await verifySourceSnapshot({
    scope: {
      supabase: noopSupabase as never,
      organizationId: '00000000-0000-4000-8000-000000000001',
      studyId: '00000000-0000-4000-8000-000000000002',
      sourceResponseSetId: '00000000-0000-4000-8000-000000000003',
      actorUserId: '00000000-0000-4000-8000-000000000004',
    },
    snapshotType: 'submit',
  })
  assert.equal(outcome.overall, SOURCE_SNAPSHOT_VERIFY_RESULT.MATCH)
  assert.equal(outcome.fieldResults.length, 0)
}

function smokeEventAndObsConstants() {
  assert.equal(
    OPERATIONAL_EVENT_TYPES.SOURCE_FIELD_SNAPSHOT_CAPTURED,
    'SOURCE_FIELD_SNAPSHOT_CAPTURED',
  )
  assert.equal(
    OPERATIONAL_EVENT_TYPES.SOURCE_INTEGRITY_VIOLATION_DETECTED,
    'SOURCE_INTEGRITY_VIOLATION_DETECTED',
  )
  assert.equal(OPERATIONAL_EVENT_TYPES.WORKFLOW_STALE_ALERT, 'WORKFLOW_STALE_ALERT')
  assert.equal(OPERATIONAL_EVENT_TYPES.ROLE_CONFLICT_DETECTED, 'ROLE_CONFLICT_DETECTED')

  assert.equal(OBS_HOOK_SIGNAL.SOURCE_FIELD_SNAPSHOT_CAPTURED, 'source_field_snapshot_captured')
  assert.equal(
    OBS_HOOK_SIGNAL.SOURCE_INTEGRITY_VIOLATION_DETECTED,
    'source_integrity_violation_detected',
  )
  assert.equal(OBS_HOOK_SIGNAL.WORKFLOW_STALE_ALERT, 'workflow_stale_alert')
  assert.equal(OBS_HOOK_SIGNAL.ROLE_CONFLICT_DETECTED, 'role_conflict_detected')
  assert.equal(OBS_AUDIT_INTEGRITY_HOOK_SIGNALS.length, 4)
}

function smokeTelemetryMetadataRedaction() {
  const issues = collectTelemetryMetadataIssues({
    source_response_set_id: '00000000-0000-4000-8000-000000000001',
    patient_name: 'hidden',
    authorityName: 'blocked',
  })
  assert.ok(issues.some((i) => i.includes('patient_name')))
  assert.ok(issues.some((i) => i.includes('authorityName')))
}

async function main() {
  smokeFieldHashing()
  smokeSnapshotImmutabilityMigration()
  smokeStaleWorkflowLogic()
  smokeGov1Registry()
  smokeVerifyResultTypes()
  await smokeVerifyWithEmptySupabase()
  await smokeRoleConflicts()
  smokeEventAndObsConstants()
  smokeTelemetryMetadataRedaction()
  console.log('phase16a26-pilot-audit-integrity-guardrails-smoke: OK')
}

void main()
