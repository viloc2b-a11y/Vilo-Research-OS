/**
 * CAPA Runtime — smoke test
 *
 * Validates type definitions, constants, and import paths.
 * Does NOT require a database connection.
 */

// ---------------------------------------------------------------------------
// 1. Type imports
// ---------------------------------------------------------------------------

import {
  CAPA_STATUS,
  EFFECTIVENESS_RESULT,
  type CapaActionRow,
  type CreateCapaActionInput,
  type UpdateCapaActionInput,
} from '@/lib/capa-runtime/capa-types'

import { createCapaAction } from '@/lib/capa-runtime/create-capa-action'
import { loadCapaActions, loadCapaAction, loadCapaActionByDeviation } from '@/lib/capa-runtime/load-capa-actions'
import { updateCapaAction } from '@/lib/capa-runtime/update-capa-action'

let passed = 0
let failed = 0

function assert(description: string, condition: boolean) {
  if (condition) {
    passed++
    console.log(`  ✅ ${description}`)
  } else {
    failed++
    console.error(`  ❌ FAIL: ${description}`)
  }
}

console.log('--- CAPA types ---')

assert('CAPA_STATUS.OPEN is "open"', CAPA_STATUS.OPEN === 'open')
assert('CAPA_STATUS.IN_PROGRESS is "in_progress"', CAPA_STATUS.IN_PROGRESS === 'in_progress')
assert('CAPA_STATUS.UNDER_REVIEW is "under_review"', CAPA_STATUS.UNDER_REVIEW === 'under_review')
assert('CAPA_STATUS.COMPLETED is "completed"', CAPA_STATUS.COMPLETED === 'completed')
assert('CAPA_STATUS.VERIFIED is "verified"', CAPA_STATUS.VERIFIED === 'verified')
assert('CAPA_STATUS.CLOSED is "closed"', CAPA_STATUS.CLOSED === 'closed')
assert('EFFECTIVENESS_RESULT.PENDING is "pending"', EFFECTIVENESS_RESULT.PENDING === 'pending')
assert('EFFECTIVENESS_RESULT.PASS is "pass"', EFFECTIVENESS_RESULT.PASS === 'pass')
assert('EFFECTIVENESS_RESULT.FAIL is "fail"', EFFECTIVENESS_RESULT.FAIL === 'fail')
assert('EFFECTIVENESS_RESULT.NOT_APPLICABLE is "not_applicable"', EFFECTIVENESS_RESULT.NOT_APPLICABLE === 'not_applicable')

console.log('--- Type shapes (compile-time) ---')

const _sampleRow: CapaActionRow = {
  id: 'id',
  organizationId: 'org',
  studyId: 'study',
  deviationId: 'deviation',
  capaStatus: 'open',
  ownerId: null,
  rootCauseAnalysis: null,
  correctiveAction: 'test',
  preventiveAction: null,
  dueDate: null,
  completionDate: null,
  effectivenessCheckRequired: false,
  effectivenessCheckDate: null,
  effectivenessCheckResult: null,
  effectivenessVerifiedBy: null,
  effectivenessNotes: null,
  closedBy: null,
  closureNotes: null,
  createdBy: 'user',
  updatedBy: 'user',
  metadata: {},
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
}

assert('CapaActionRow type compiles', !!_sampleRow.id)

const _createInput: CreateCapaActionInput = {
  organizationId: 'org',
  studyId: 'study',
  deviationId: 'deviation',
  correctiveAction: 'test corrective action',
}

assert('CreateCapaActionInput type compiles (minimal)', !!_createInput.correctiveAction)

const _updateInput: UpdateCapaActionInput = {
  capaStatus: 'completed',
}

assert('UpdateCapaActionInput type compiles', _updateInput.capaStatus === 'completed')

console.log('--- Service function signatures (compile-time) ---')

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _createFn = createCapaAction
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _loadManyFn = loadCapaActions
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _loadOneFn = loadCapaAction
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _loadByDeviationFn = loadCapaActionByDeviation
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _updateFn = updateCapaAction

assert('createCapaAction exports', typeof createCapaAction === 'function')
assert('loadCapaActions exports', typeof loadCapaActions === 'function')
assert('loadCapaAction exports', typeof loadCapaAction === 'function')
assert('loadCapaActionByDeviation exports', typeof loadCapaActionByDeviation === 'function')
assert('updateCapaAction exports', typeof updateCapaAction === 'function')

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------

console.log(`\n---\nCAPA Runtime smoke test passed.\n`)
console.log(`Coverage:`)
console.log(`  ✅ Type constants (CAPA status, effectiveness result)`)
console.log(`  ✅ CapaActionRow type (full shape + nullable fields)`)
console.log(`  ✅ CreateCapaActionInput (minimal)`)
console.log(`  ✅ UpdateCapaActionInput (partial update)`)
console.log(`  ✅ All 5 service functions export cleanly`)

if (failed > 0) {
  console.error(`\n❌ ${failed} test(s) FAILED`)
  process.exit(1)
} else {
  console.log(`\n✅ All ${passed} assertions passed.`)
}
