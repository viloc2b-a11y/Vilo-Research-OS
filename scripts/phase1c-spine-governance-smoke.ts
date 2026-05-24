/**
 * Phase 1C — Static smoke: registry + gateway exports (no DB).
 * Run: npx tsx scripts/phase1c-spine-governance-smoke.ts
 */

import {
  ALL_REGISTERED_OPERATIONAL_EVENT_TYPES,
  GATEWAY_EMITTED_EVENT_TYPES,
  OPERATIONAL_EVENT_TYPES,
  OPERATIONAL_PAYLOAD_SCHEMA_VERSION,
  RPC_EMITTED_EVENT_TYPES,
  buildOperationalEventPayload,
  ClinicalMutationGateway,
} from '../lib/operations'

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`FAIL: ${message}`)
    process.exit(1)
  }
  console.log(`OK: ${message}`)
}

const payload = buildOperationalEventPayload({
  source: 'phase1c-spine-governance-smoke',
  mutation: 'test.emit',
  subjectId: '00000000-0000-0000-0000-000000000001',
  details: { example: true },
})

assert(payload.schema_version === OPERATIONAL_PAYLOAD_SCHEMA_VERSION, 'payload schema_version')
assert(typeof payload.details === 'object', 'payload has details envelope')
assert(
  GATEWAY_EMITTED_EVENT_TYPES.has(OPERATIONAL_EVENT_TYPES.VISIT_CHECKED_IN),
  'VISIT_CHECKED_IN in gateway set',
)
assert(
  GATEWAY_EMITTED_EVENT_TYPES.has(OPERATIONAL_EVENT_TYPES.SCHEDULE_MATERIALIZED),
  'SCHEDULE_MATERIALIZED in gateway set',
)
assert(
  RPC_EMITTED_EVENT_TYPES.has(OPERATIONAL_EVENT_TYPES.PROCEDURE_COMPLETED),
  'PROCEDURE_COMPLETED in RPC set',
)
assert(
  ALL_REGISTERED_OPERATIONAL_EVENT_TYPES.has(OPERATIONAL_EVENT_TYPES.ADVERSE_EVENT_CREATED),
  'ADVERSE_EVENT_CREATED registered',
)
assert(typeof ClinicalMutationGateway.emit === 'function', 'ClinicalMutationGateway.emit exists')

console.log('\nPhase 1C spine governance smoke passed.')
