/**
 * Phase 16A-2.7 — Pre-pilot runtime safety net smoke (static).
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createHash } from 'node:crypto'
import {
  BREAK_GLASS_ACCESS_VALIDATION,
  validateBreakGlassAccess,
} from '../lib/break-glass'
import { OPERATIONAL_EVENT_TYPES } from '../lib/operations/event-types'
import { canonicalSerialize } from '../lib/source/integrity/canonical-serialize'
import { hashFieldValue } from '../lib/source/integrity/hash-field-value'
import {
  calculateSaeTimelines,
  SAE_FOLLOWUP_DAYS,
  SAE_INITIAL_NOTIFICATION_HOURS,
  SAE_NARRATIVE_DAYS,
} from '../lib/safety/sae-timeline-calculator'
import {
  evaluateTemporalConsistencyRule,
  TEMPORAL_CONSTRAINT_TYPE,
  TEMPORAL_EVALUATION_RESULT,
  TEMPORAL_SEVERITY,
} from '../lib/temporal-consistency'
import { translateRuntimeError } from '../lib/runtime-errors'

function smokeMigration0089() {
  const sql = readFileSync(
    join(process.cwd(), 'supabase/migrations/0089_phase16a27_runtime_safety_net.sql'),
    'utf8',
  )
  assert.ok(sql.includes('allocate_source_field_snapshot_version'))
  assert.ok(sql.includes('workflow_activity_checkpoints_stale_detection_idx'))
  assert.ok(sql.includes("status in ('active', 'stale')"))
  assert.ok(sql.includes('block_pilot_feedback_mutation'))
  assert.ok(sql.includes("'pending'"))
  assert.ok(sql.includes('consent_version_id'))
  assert.ok(sql.includes('sae_onset_at'))
  assert.ok(sql.includes('document_versions'))
}

function smokeCaptureSnapshotTransactional() {
  const ts = readFileSync(
    join(process.cwd(), 'lib/source/integrity/capture-snapshot.ts'),
    'utf8',
  )
  assert.ok(ts.includes('allocateSnapshotVersion'))
  assert.ok(
    ts.includes(
      'Each unlock/relock cycle intentionally produces a new immutable snapshot version',
    ),
  )
  const alloc = readFileSync(
    join(process.cwd(), 'lib/source/integrity/allocate-snapshot-version.ts'),
    'utf8',
  )
  assert.ok(alloc.includes('allocate_source_field_snapshot_version'))
}

function smokeCanonicalAndUnlockRelock() {
  const v1 = hashFieldValue({ valueText: 'pilot', valueType: 'text' })
  const v2 = hashFieldValue({ valueType: 'text', valueText: 'pilot' })
  assert.equal(v1, v2)

  const reorder = hashFieldValue({ valueJson: { b: 1, a: 2 } })
  const reorder2 = hashFieldValue({ valueJson: { a: 2, b: 1 } })
  assert.equal(reorder, reorder2)

  const versionA = canonicalSerialize({ snapshot_version: 1 })
  const versionB = canonicalSerialize({ snapshot_version: 2 })
  assert.notEqual(
    createHash('sha256').update(versionA).digest('hex'),
    createHash('sha256').update(versionB).digest('hex'),
  )
}

function smokeTemporalPending() {
  const rule = {
    ruleKey: 'consent_before_screening',
    constraintType: TEMPORAL_CONSTRAINT_TYPE.A_BEFORE_OR_EQUAL_B,
    severity: TEMPORAL_SEVERITY.BLOCKER,
    systemBlocking: false,
  }

  const consentMissing = evaluateTemporalConsistencyRule({
    rule,
    eventAValue: null,
    eventBValue: '2026-01-02T10:00:00.000Z',
  })
  assert.equal(consentMissing.evaluationResult, TEMPORAL_EVALUATION_RESULT.PENDING)

  const screeningMissing = evaluateTemporalConsistencyRule({
    rule,
    eventAValue: '2026-01-01T10:00:00.000Z',
    eventBValue: null,
  })
  assert.equal(screeningMissing.evaluationResult, TEMPORAL_EVALUATION_RESULT.PENDING)

  const bothMissing = evaluateTemporalConsistencyRule({ rule, eventAValue: null, eventBValue: null })
  assert.equal(bothMissing.evaluationResult, TEMPORAL_EVALUATION_RESULT.PENDING)

  const pass = evaluateTemporalConsistencyRule({
    rule,
    eventAValue: '2026-01-01T10:00:00.000Z',
    eventBValue: '2026-01-02T10:00:00.000Z',
  })
  assert.equal(pass.evaluationResult, TEMPORAL_EVALUATION_RESULT.PASS)

  const fail = evaluateTemporalConsistencyRule({
    rule,
    eventAValue: '2026-01-03T10:00:00.000Z',
    eventBValue: '2026-01-02T10:00:00.000Z',
  })
  assert.equal(fail.evaluationResult, TEMPORAL_EVALUATION_RESULT.FAIL)
  assert.notEqual(fail.evaluationResult, TEMPORAL_EVALUATION_RESULT.PASS)
}

function smokeBreakGlassExpiry() {
  const future = new Date(Date.now() + 60_000).toISOString()
  assert.equal(
    validateBreakGlassAccess({ status: 'active', expiresAt: future }),
    BREAK_GLASS_ACCESS_VALIDATION.ACTIVE,
  )

  const past = new Date(Date.now() - 60_000).toISOString()
  assert.equal(
    validateBreakGlassAccess({ status: 'active', expiresAt: past }),
    BREAK_GLASS_ACCESS_VALIDATION.EXPIRED,
  )

  assert.equal(
    validateBreakGlassAccess({ status: 'rejected', expiresAt: future }),
    BREAK_GLASS_ACCESS_VALIDATION.INVALID,
  )

  assert.equal(
    OPERATIONAL_EVENT_TYPES.BREAK_GLASS_EXPIRED_ACCESS_ATTEMPT,
    'BREAK_GLASS_EXPIRED_ACCESS_ATTEMPT',
  )
}

function smokeSaeCalculator() {
  const onset = new Date('2026-01-01T12:00:00.000Z')
  const timelines = calculateSaeTimelines(onset)
  assert.equal(timelines.saeOnsetAt, onset.toISOString())

  const initialDue = new Date(timelines.initialNotificationDueAt).getTime()
  assert.equal(
    initialDue - onset.getTime(),
    SAE_INITIAL_NOTIFICATION_HOURS * 60 * 60 * 1000,
  )

  const followupDue = new Date(timelines.followupDueAt).getTime()
  assert.equal(followupDue - onset.getTime(), SAE_FOLLOWUP_DAYS * 24 * 60 * 60 * 1000)

  const narrativeDue = new Date(timelines.narrativeDueAt).getTime()
  assert.equal(narrativeDue - onset.getTime(), SAE_NARRATIVE_DAYS * 24 * 60 * 60 * 1000)
}

function smokePilotFeedbackFoundation() {
  const submit = readFileSync(
    join(process.cwd(), 'lib/pilot/feedback/submit-pilot-feedback.ts'),
    'utf8',
  )
  assert.ok(submit.includes(".from('pilot_feedback')"))
  assert.ok(submit.includes('never throws to coordinator caller'))
  assert.ok(submit.includes('redactTelemetryMetadata'))
}

function smokeRuntimeErrorTranslation() {
  const translated = translateRuntimeError({ error: new Error('permission denied for table visits') })
  assert.ok(!translated.coordinatorMessage.toLowerCase().includes('visits'))
  assert.ok(translated.technicalMessage.includes('visits'))
}

function main() {
  smokeMigration0089()
  smokeCaptureSnapshotTransactional()
  smokeCanonicalAndUnlockRelock()
  smokeTemporalPending()
  smokeBreakGlassExpiry()
  smokeSaeCalculator()
  smokePilotFeedbackFoundation()
  smokeRuntimeErrorTranslation()
  console.log('phase16a27-pre-pilot-safety-hardening-smoke: PASS')
}

main()
