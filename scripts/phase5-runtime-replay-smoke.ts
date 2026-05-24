/**
 * Phase 5 runtime replay & operational intelligence smoke (no DB).
 * Run: npx tsx scripts/phase5-runtime-replay-smoke.ts
 */
import assert from 'node:assert/strict'
import { buildCausalityChainFromTimeline } from '../lib/runtime-replay/causality/build-chain'
import { explainVisitReadinessBlocked } from '../lib/runtime-replay/explain/readiness-blocked'
import { RUNTIME_REPLAY_VERSION } from '../lib/runtime-replay/types'
import { computeRuntimeRisk } from '../lib/operational-intelligence/metrics/runtime-risk'
import { emitOperationalIntelligenceSignals } from '../lib/operational-intelligence/signals/engine'
import { GOVERNANCE_DEVIATION_RULES_V1 } from '../lib/governance-fabric/deviation-rules'
import type { VisitReadinessProjection } from '../lib/projections/types'

function smokeCausalityChain() {
  const chain = buildCausalityChainFromTimeline({
    segments: [
      {
        segmentType: 'safety_escalation',
        label: 'Safety',
        entries: [
          {
            id: 'safety:ae:1',
            kind: 'safety_registry',
            segmentType: 'safety_escalation',
            occurredAt: '2026-01-01T00:00:00Z',
            label: 'Headache',
            detail: 'open',
          },
        ],
      },
    ],
    readinessExplanation: {
      visitId: 'v1',
      readinessStatus: 'blocked',
      blocked: true,
      primaryCauses: ['safety: Unresolved AE'],
      blockerSummaries: [
        {
          id: 'safety-signoff-ae-subject',
          category: 'safety_continuity',
          severity: 'blocker',
          label: 'Unresolved AE blocks signoff',
          detail: '1 open AE',
        },
      ],
      graphTriggerSummaries: [],
      causalityPath: ['safety-signoff-ae-subject'],
    },
  })
  assert.ok(chain.nodes.some((n) => n.kind === 'readiness_state'))
  assert.ok(chain.links.some((l) => l.relation === 'blocked'))
}

function smokeReadinessExplanation() {
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
    missingSourceCount: 2,
    safetyBlockerCount: 1,
    visitCompletionReady: false,
    coordinatorSignReady: false,
    investigatorSignReady: false,
    blockerCount: 2,
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
  const explanation = explainVisitReadinessBlocked({ projection })
  assert.equal(explanation.blocked, true)
  assert.ok(explanation.primaryCauses.length >= 2)
}

function smokeRuntimeRisk() {
  const risk = computeRuntimeRisk({
    coordinatorBurden: {
      openWorkflowCount: 3,
      openQueryCount: 2,
      unresolvedFindingCount: 1,
      sourceBacklogCount: 4,
      safetyBurdenCount: 1,
      queryDensity: 2,
      rescheduleCount: 2,
      overdueWorkflowCount: 1,
      burdenScore: 55,
    },
    protocolFriction: {
      repeatedBlockerPatternCount: 1,
      graphEscalationCount: 2,
      unresolvedWorkflowRecurrence: 1,
      highBurdenVisitCount: 0,
      deviationSignalCount: 1,
      frictionScore: 40,
    },
    unresolvedBlockerCount: 3,
  })
  assert.ok(['low', 'moderate', 'elevated', 'critical'].includes(risk.riskLevel))
  assert.ok(risk.riskScore > 0)
}

function smokeIntelligenceSignals() {
  const signals = emitOperationalIntelligenceSignals({
    coordinatorBurden: {
      openWorkflowCount: 10,
      openQueryCount: 5,
      unresolvedFindingCount: 0,
      sourceBacklogCount: 3,
      safetyBurdenCount: 0,
      queryDensity: 5,
      rescheduleCount: 0,
      overdueWorkflowCount: 2,
      burdenScore: 80,
    },
    protocolFriction: {
      repeatedBlockerPatternCount: 0,
      graphEscalationCount: 0,
      unresolvedWorkflowRecurrence: 0,
      highBurdenVisitCount: 0,
      deviationSignalCount: 0,
      frictionScore: 10,
    },
    runtimeRisk: {
      riskLevel: 'elevated',
      unresolvedRiskScore: 40,
      operationalInstabilityScore: 30,
      deviationPressureScore: 20,
      coordinatorOverloadScore: 80,
      riskScore: 50,
      riskFactors: ['overload'],
    },
    scope: 'visit',
  })
  assert.ok(signals.some((s) => s.kind === 'coordinator_overload'))
}

function smokeVersions() {
  assert.equal(RUNTIME_REPLAY_VERSION, 1)
  assert.ok(GOVERNANCE_DEVIATION_RULES_V1.length >= 7)
}

function main() {
  smokeCausalityChain()
  smokeReadinessExplanation()
  smokeRuntimeRisk()
  smokeIntelligenceSignals()
  smokeVersions()
  console.log('phase5-runtime-replay-smoke: OK')
}

main()
