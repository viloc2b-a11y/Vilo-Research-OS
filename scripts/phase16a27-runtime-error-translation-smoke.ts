/**
 * Phase 16A-2.7 — Runtime error translation smoke.
 */
import assert from 'node:assert/strict'
import {
  RUNTIME_ERROR_CODE,
  translateRuntimeError,
} from '../lib/runtime-errors'

function assertNoLeak(message: string) {
  const forbidden = ['select ', 'insert ', 'public.', 'constraint', 'stack', 'pg_']
  const lower = message.toLowerCase()
  for (const token of forbidden) {
    assert.ok(!lower.includes(token), `coordinatorMessage leaked "${token}": ${message}`)
  }
}

function main() {
  const unique = translateRuntimeError({
    error: { code: '23505', message: 'duplicate key value violates unique constraint' },
  })
  assert.equal(unique.code, RUNTIME_ERROR_CODE.UNIQUE_CONSTRAINT)
  assertNoLeak(unique.coordinatorMessage)

  const rls = translateRuntimeError({
    error: { code: '42501', message: 'new row violates row-level security policy' },
  })
  assert.equal(rls.code, RUNTIME_ERROR_CODE.RLS_DENIED)
  assertNoLeak(rls.coordinatorMessage)

  const study = translateRuntimeError({ error: new Error('user_has_study_access denied') })
  assert.equal(study.code, RUNTIME_ERROR_CODE.STUDY_ACCESS_DENIED)

  const snapshot = translateRuntimeError({
    error: new Error('block_source_snapshot_updates: snapshots are immutable'),
  })
  assert.equal(snapshot.code, RUNTIME_ERROR_CODE.IMMUTABLE_SNAPSHOT)

  const occ = translateRuntimeError({ error: new Error('stale OCC version conflict') })
  assert.equal(occ.code, RUNTIME_ERROR_CODE.STALE_OCC_VERSION)
  assert.equal(occ.retryable, true)

  const missing = translateRuntimeError({ error: new Error('response set not found') })
  assert.equal(missing.code, RUNTIME_ERROR_CODE.RESPONSE_SET_MISSING)

  const submitted = translateRuntimeError({ error: new Error('SUBMITTED_VALUE_IMMUTABLE already submitted') })
  assert.equal(submitted.code, RUNTIME_ERROR_CODE.RESPONSE_SET_ALREADY_SUBMITTED)

  const breakGlass = translateRuntimeError({ error: new Error('break_glass access has expired') })
  assert.equal(breakGlass.code, RUNTIME_ERROR_CODE.BREAK_GLASS_EXPIRED)
  assert.equal(breakGlass.coordinatorMessage, 'Emergency access expired. Request a new approval.')

  const generic = translateRuntimeError({ error: new Error('unexpected worker fault') })
  assert.equal(generic.code, RUNTIME_ERROR_CODE.GENERIC_RUNTIME)
  assert.ok(generic.technicalMessage.includes('unexpected'))

  console.log('phase16a27-runtime-error-translation-smoke: PASS')
}

main()
