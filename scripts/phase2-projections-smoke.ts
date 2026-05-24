/**
 * Phase 2 — Static smoke for projection module (no DB).
 * Run: npx tsx scripts/phase2-projections-smoke.ts
 */

import {
  RUNTIME_PROJECTION_VERSION,
  projectionScopesForEventType,
  deriveReadinessStatusFromBlockers,
  projectionBlocker,
  EVENT_PROJECTION_RULES,
} from '../lib/projections'
import { OPERATIONAL_EVENT_TYPES } from '../lib/operations/event-types'

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`FAIL: ${message}`)
    process.exit(1)
  }
  console.log(`OK: ${message}`)
}

assert(RUNTIME_PROJECTION_VERSION === 1, 'projection version is 1')
assert(EVENT_PROJECTION_RULES.length >= 5, 'event projection rules defined')

const checkInScopes = projectionScopesForEventType(OPERATIONAL_EVENT_TYPES.VISIT_CHECKED_IN)
assert(checkInScopes.refreshVisit && checkInScopes.refreshSubject, 'check-in cascades visit+subject')

const publishScopes = projectionScopesForEventType(OPERATIONAL_EVENT_TYPES.SOURCE_PACKAGE_PUBLISHED)
assert(publishScopes.refreshStudy && !publishScopes.refreshVisit, 'publish refreshes study only')

const status = deriveReadinessStatusFromBlockers(
  [
    projectionBlocker({
      id: 't',
      category: 'test',
      label: 'Test',
      detail: 'warning only',
      severity: 'warning',
    }),
  ],
  false,
)
assert(status === 'attention', 'warning → attention')

console.log('\nPhase 2 projections smoke passed.')
