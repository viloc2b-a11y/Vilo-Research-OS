/**
 * Phase 4 safety & governance smoke — static contracts (no DB).
 * Run: npx tsx scripts/phase4-safety-governance-smoke.ts
 */
import assert from 'node:assert/strict'
import { GOVERNANCE_DEVIATION_RULES_V1, ruleById } from '../lib/governance-fabric/deviation-rules'
import { CAPA_PLACEHOLDER_ARCHITECTURE } from '../lib/governance-fabric/capa-placeholder'
import { INSPECTION_REPLAY_READINESS } from '../lib/governance-fabric/inspection-replay'
import { governanceSignalsToBlockers } from '../lib/governance-fabric/signals'
import type { GovernanceSignal } from '../lib/governance-fabric/types'
import { SAFETY_CONTINUITY_PROJECTION_VERSION } from '../lib/safety-continuity/constants'
import { strengthenGraphSafetyBlockers } from '../lib/safety-continuity/graph-safety-bridge'

function smokeDeviationRules() {
  assert.equal(GOVERNANCE_DEVIATION_RULES_V1.length, 7)
  assert.ok(ruleById('visit_window_deviation'))
  assert.ok(ruleById('unresolved_ae_at_signoff'))
  assert.ok(ruleById('protocol_graph_blocker_unresolved'))
}

function smokeCapaPlaceholderArch() {
  assert.equal(CAPA_PLACEHOLDER_ARCHITECTURE.phase, 4)
  assert.ok(CAPA_PLACEHOLDER_ARCHITECTURE.deferred.includes('capa_workflow_states'))
}

function smokeInspectionReplay() {
  assert.ok(INSPECTION_REPLAY_READINESS.canonicalSources.length >= 5)
  assert.ok(INSPECTION_REPLAY_READINESS.derivedRebuildable.includes('governance_signals'))
}

function smokeGraphSafetyStrengthen() {
  const elevated = strengthenGraphSafetyBlockers({
    graphBlockers: [
      {
        id: 'graph:cbc',
        category: 'safety',
        severity: 'warning',
        label: 'CBC review',
        detail: 'Critical finding',
      },
    ],
    subjectContinuityState: 'critical',
    unresolvedItems: [
      {
        source: 'ae_registry',
        sourceId: 'ae-1',
        label: 'Headache',
        detail: 'open',
        severity: 'warning',
      },
    ],
  })
  assert.equal(elevated[0]?.severity, 'blocker')
}

function smokeGovernanceBlockers() {
  const signals: GovernanceSignal[] = [
    {
      signalKey: 'test:1',
      signalType: 'visit_window_deviation',
      severity: 'warning',
      status: 'open',
      label: 'Window',
      detail: 'Outside window',
      organizationId: 'org',
      studyId: 'study',
      detectedAt: new Date().toISOString(),
      derivation: {},
    },
  ]
  const blockers = governanceSignalsToBlockers(signals)
  assert.equal(blockers.length, 1)
  assert.equal(blockers[0]?.category, 'governance')
}

function smokeSafetyVersion() {
  assert.equal(SAFETY_CONTINUITY_PROJECTION_VERSION, 1)
}

function main() {
  smokeDeviationRules()
  smokeCapaPlaceholderArch()
  smokeInspectionReplay()
  smokeGraphSafetyStrengthen()
  smokeGovernanceBlockers()
  smokeSafetyVersion()
  console.log('phase4-safety-governance-smoke: OK')
}

main()
