/**
 * Phase 16 — Runtime API hardening smoke (coordinator-safe error translation).
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { normalizeRpcError } from '../lib/api/source/errors'
import { fromRpcThrown } from '../lib/api/source/envelope'
import {
  RUNTIME_ERROR_CODE,
  apiErrorFromRuntimeError,
  coordinatorMessageFromError,
  translateRuntimeError,
} from '../lib/runtime-errors'

function assertNoLeak(message: string) {
  const forbidden = [
    'select ',
    'insert into',
    'public.',
    'constraint',
    'stack trace',
    'violates unique constraint',
    'row-level security policy for table',
    'pg_',
    'supabase',
  ]
  const lower = message.toLowerCase()
  for (const token of forbidden) {
    assert.ok(!lower.includes(token), `coordinator leak "${token}": ${message}`)
  }
}

function smokeTranslatedPatterns() {
  const unique = translateRuntimeError({
    error: { code: '23505', message: 'duplicate key value violates unique constraint "foo"' },
  })
  assert.equal(unique.code, RUNTIME_ERROR_CODE.UNIQUE_CONSTRAINT)
  assertNoLeak(unique.coordinatorMessage)
  assert.ok(unique.technicalMessage.includes('duplicate'))

  const rls = translateRuntimeError({
    error: { code: '42501', message: 'new row violates row-level security policy for table visits' },
  })
  assert.equal(rls.code, RUNTIME_ERROR_CODE.RLS_DENIED)
  assertNoLeak(rls.coordinatorMessage)

  const occ = translateRuntimeError({ error: new Error('STALE_WRITE: version conflict') })
  assert.equal(occ.code, RUNTIME_ERROR_CODE.STALE_OCC_VERSION)
  assert.equal(occ.retryable, true)

  const submitted = translateRuntimeError({
    error: new Error('SET_NOT_MUTABLE: SUBMITTED_VALUE_IMMUTABLE'),
  })
  assert.equal(submitted.code, RUNTIME_ERROR_CODE.RESPONSE_SET_ALREADY_SUBMITTED)
  assertNoLeak(submitted.coordinatorMessage)
  assert.match(submitted.coordinatorMessage, /submitted|correction/i)

  const breakGlass = translateRuntimeError({ error: new Error('break_glass access has expired') })
  assert.equal(breakGlass.code, RUNTIME_ERROR_CODE.BREAK_GLASS_EXPIRED)
  assert.equal(breakGlass.coordinatorMessage, 'Emergency access expired. Request a new approval.')
}

function smokeApiEnvelopeTranslation() {
  const envelope = fromRpcThrown(
    { code: '23505', message: 'duplicate key value violates unique constraint' },
    { requestId: 'smoke-req', rpc: 'save_source_draft' },
  )
  assert.equal(envelope.ok, false)
  assert.equal(envelope.errors.length, 1)
  assertNoLeak(envelope.errors[0]!.message)
  const ctx = envelope.errors[0]!.context as Record<string, unknown>
  assert.ok(typeof ctx.technical_message === 'string')
  assert.equal(ctx.retryable, true)
}

function smokeNormalizeRpcPrefix() {
  const errors = normalizeRpcError(new Error('STALE_WRITE: row updated'))
  assert.equal(errors[0]?.code, 'STALE_WRITE')
  assertNoLeak(errors[0]!.message)
}

function smokeCoordinatorMessageHelper() {
  const msg = coordinatorMessageFromError(new Error('permission denied for table study_subjects'), {
    fallbackMessage: 'Action failed.',
  })
  assertNoLeak(msg)
}

function smokeSourceRoutesUseFromRpcThrown() {
  const routes = [
    'app/api/source/response-set/open/route.ts',
    'app/api/source/response-set/save-draft/route.ts',
    'app/api/source/response-set/submit/route.ts',
    'app/api/source/response/correct/route.ts',
    'app/api/source/response-set/addendum/route.ts',
  ]
  for (const route of routes) {
    const content = readFileSync(join(process.cwd(), route), 'utf8')
    assert.ok(content.includes('fromRpcThrown'), `${route} must use fromRpcThrown`)
  }
}

function smokePilotFeedbackNeverThrows() {
  const content = readFileSync(
    join(process.cwd(), 'lib/pilot/feedback/submit-pilot-feedback.ts'),
    'utf8',
  )
  assert.ok(content.includes('never throws to coordinator caller'))
  assert.ok(content.includes('catch'))
  assert.ok(!content.includes('throw '))
}

function smokeApiErrorPreservesTechnical() {
  const err = apiErrorFromRuntimeError(new Error('duplicate key on source_response_sets'), {
    hardBlockCode: 'LINEAGE_CONFLICT',
  })
  assertNoLeak(err.message)
  const ctx = err.context as Record<string, unknown>
  assert.ok(String(ctx.technical_message).includes('duplicate'))
}

function main() {
  smokeTranslatedPatterns()
  smokeApiEnvelopeTranslation()
  smokeNormalizeRpcPrefix()
  smokeCoordinatorMessageHelper()
  smokeSourceRoutesUseFromRpcThrown()
  smokePilotFeedbackNeverThrows()
  smokeApiErrorPreservesTechnical()
  console.log('phase16-runtime-api-hardening-smoke: PASS')
}

main()
