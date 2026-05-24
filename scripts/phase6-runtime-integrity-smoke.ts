/**
 * Phase 6 runtime integrity smoke — static contracts (no DB).
 * Run: npx tsx scripts/phase6-runtime-integrity-smoke.ts
 */
import assert from 'node:assert/strict'
import {
  isApprovedMutationPath,
  scanSourceForDirectMutations,
  summarizeDirectMutationFindings,
} from '../lib/runtime-integrity/detect/direct-mutation-scanner'
import { catalogSummary } from '../lib/runtime-integrity/detect/silent-mutation-catalog'
import { isClinicalExecutionTable, isDerivedProjectionTable } from '../lib/runtime-integrity/clinical-tables'
import { SPINE_ENFORCEMENT_STRATEGY } from '../lib/runtime-integrity/enforcement-strategy'
import {
  collectRegistryDrift,
  normalizeOperationalEventType,
} from '../lib/runtime-integrity/event-registry/normalize'
import { RPC_EMISSION_HARDENING_PLAN } from '../lib/runtime-integrity/integrity/rpc-emission-plan'
import { detectCataloguedReplayGaps } from '../lib/runtime-integrity/integrity/replay-gaps'
import { explainVisitReadinessBlocked } from '../lib/runtime-replay/explain/readiness-blocked'
import type { VisitReadinessProjection } from '../lib/projections/types'

function smokeEnforcementStrategy() {
  assert.equal(SPINE_ENFORCEMENT_STRATEGY.version, 6)
  assert.ok(SPINE_ENFORCEMENT_STRATEGY.enforcementLayers.length >= 4)
}

function smokeEventNormalization() {
  const norm = normalizeOperationalEventType('external_randomization_recorded')
  assert.equal(norm.canonical, 'EXTERNAL_RANDOMIZATION_RECORDED')
  assert.equal(norm.wasAliased, true)
  assert.equal(normalizeOperationalEventType('VISIT_CHECKED_IN').registered, true)
}

function smokeDirectMutationScanner() {
  const silent = `
    await supabase.from('visits').update({ visit_status: 'checked_in' })
  `
  const findings = scanSourceForDirectMutations(silent, 'lib/example/silent.ts')
  assert.ok(findings.some((f) => f.severity === 'blocker'))

  const withGateway = `
    await ClinicalMutationGateway.emitVisit({ supabase, visitId, eventType: 'VISIT_CHECKED_IN' })
    await supabase.from('visits').update({ visit_status: 'checked_in' })
  `
  const ok = scanSourceForDirectMutations(withGateway, 'lib/example/gateway.ts')
  assert.ok(ok.every((f) => f.severity !== 'blocker' || f.hasEmissionHint))

  assert.ok(isApprovedMutationPath('lib/projections/persist.ts'))
  assert.ok(isDerivedProjectionTable('visit_readiness_projections'))
  assert.ok(isClinicalExecutionTable('visits'))
}

function smokeCatalogAndRpc() {
  const catalog = catalogSummary()
  assert.ok((catalog.silent ?? 0) + (catalog.partial ?? 0) > 0)
  assert.ok(RPC_EMISSION_HARDENING_PLAN.length >= 5)
  assert.ok(detectCataloguedReplayGaps().length > 0)
}

function smokeRegistryDrift() {
  const drift = collectRegistryDrift()
  assert.ok(drift.legacyAliases.includes('external_randomization_recorded'))
}

function smokeReadinessExplainIntegration() {
  const projection: VisitReadinessProjection = {
    visitId: 'v1',
    organizationId: 'o1',
    studyId: 's1',
    studySubjectId: 'sub1',
    computedAt: new Date().toISOString(),
    projectionVersion: 1,
    readinessStatus: 'blocked',
    pendingProcedureCount: 0,
    unsignedProcedureCount: 0,
    unresolvedFindingCount: 1,
    missingSourceCount: 0,
    safetyBlockerCount: 1,
    visitCompletionReady: false,
    coordinatorSignReady: false,
    investigatorSignReady: false,
    blockerCount: 1,
    blockers: [
      {
        id: 'unresolved-findings',
        category: 'source',
        severity: 'blocker',
        label: 'Unresolved findings',
        detail: '1 finding',
      },
    ],
    snapshot: {},
  }
  const ex = explainVisitReadinessBlocked({ projection })
  assert.equal(ex.blocked, true)
}

function main() {
  smokeEnforcementStrategy()
  smokeEventNormalization()
  smokeDirectMutationScanner()
  smokeCatalogAndRpc()
  smokeRegistryDrift()
  smokeReadinessExplainIntegration()

  const sampleFindings = scanSourceForDirectMutations(
    `await supabase.from('governance_signals').upsert({})`,
    'lib/governance-fabric/signals.ts',
  )
  assert.equal(summarizeDirectMutationFindings(sampleFindings).blockers, 0)

  console.log('phase6-runtime-integrity-smoke: OK')
}

main()
