/**
 * Phase 7 financial runtime intelligence smoke (no DB).
 * Run: npx tsx scripts/phase7-financial-runtime-smoke.ts
 */
import assert from 'node:assert/strict'
import { computeEarnedFinancialState } from '../lib/financial-runtime/compute/earned'
import { computeExecutedFinancialState } from '../lib/financial-runtime/compute/executed'
import { computeExpectedFinancialState } from '../lib/financial-runtime/compute/expected'
import { detectRevenueLeakage, scoreLeakage } from '../lib/financial-runtime/compute/leakage'
import { buildProcedureFinancialAttributions } from '../lib/financial-runtime/compute/procedure-attribution'
import { computeUnscheduledRuntimeBurden } from '../lib/financial-runtime/compute/unscheduled-burden'
import { EARNED_RATE_BASIS, FINANCIAL_RUNTIME_VERSION } from '../lib/financial-runtime/constants'
import type { VisitFinancialContext } from '../lib/financial-runtime/load/visit-context'
import { evaluateFinancialIntegritySafeguards } from '../lib/financial-runtime/safeguards/integrity'

function mockCtx(overrides?: Partial<VisitFinancialContext>): VisitFinancialContext {
  return {
    visitId: 'v1',
    organizationId: 'o1',
    studyId: 's1',
    studySubjectId: 'sub1',
    visitDefinitionId: 'vd1',
    visitStatus: 'in_progress',
    windowStatus: 'in_window',
    scheduledDate: '2026-05-01',
    visitReviewStatus: null,
    procedures: [
      {
        id: 'pe1',
        procedureDefinitionId: 'pd1',
        code: 'LAB',
        label: 'Lab draw',
        executionStatus: 'completed',
        isSigned: false,
        billableFlag: true,
        billableDefault: true,
        sectionDisabled: false,
        validationStatus: null,
      },
      {
        id: 'pe2',
        procedureDefinitionId: 'pd2',
        code: 'VIT',
        label: 'Vitals',
        executionStatus: 'completed',
        isSigned: true,
        billableFlag: false,
        billableDefault: false,
        sectionDisabled: false,
        validationStatus: null,
      },
    ],
    protocolMaps: [
      {
        mapId: 'm1',
        procedureDefinitionId: 'pd1',
        isRequired: true,
        isConditional: false,
        conditionLabel: null,
      },
      {
        mapId: 'm2',
        procedureDefinitionId: 'pd2',
        isRequired: true,
        isConditional: false,
        conditionLabel: null,
      },
    ],
    sourceSubmittedByProcedure: new Map([['pe2', true]]),
    openAeVisitCount: 0,
    workflowOpenCount: 2,
    queryOpenCount: 1,
    rescheduleEventCount: 0,
    readiness: {
      visitId: 'v1',
      organizationId: 'o1',
      studyId: 's1',
      studySubjectId: 'sub1',
      computedAt: new Date().toISOString(),
      projectionVersion: 1,
      readinessStatus: 'blocked',
      pendingProcedureCount: 0,
      unsignedProcedureCount: 1,
      unresolvedFindingCount: 0,
      missingSourceCount: 1,
      safetyBlockerCount: 0,
      visitCompletionReady: false,
      coordinatorSignReady: false,
      investigatorSignReady: false,
      blockerCount: 1,
      blockers: [],
      snapshot: {},
    },
    ...overrides,
  }
}

function smokeExpectedExecutedEarned() {
  const ctx = mockCtx()
  const expected = computeExpectedFinancialState(ctx, 3)
  const executed = computeExecutedFinancialState(ctx)
  const earned = computeEarnedFinancialState({
    ctx,
    expected,
    visitBlocked: true,
    graphBlocked: false,
  })

  assert.equal(expected.procedureCount, 2)
  assert.equal(executed.procedureCompletedCount, 2)
  assert.equal(earned.procedureEarnedCount, 0, 'blocked visit prevents earn')
  assert.ok(earned.units.find((u) => u.procedureExecutionId === 'pe1')?.earnBlockers.includes('unsigned'))
}

function smokeLeakage() {
  const ctx = mockCtx()
  const expected = computeExpectedFinancialState(ctx, null)
  const executed = computeExecutedFinancialState(ctx)
  const earned = computeEarnedFinancialState({
    ctx,
    expected,
    visitBlocked: false,
    graphBlocked: false,
  })
  const unscheduled = computeUnscheduledRuntimeBurden(ctx)
  const leakage = detectRevenueLeakage({
    ctx,
    expected,
    executed,
    earned,
    unscheduled,
    graphBlocked: false,
  })

  assert.ok(leakage.some((l) => l.kind === 'executed_unsigned'))
  assert.ok(leakage.some((l) => l.kind === 'completed_missing_source'))
  const score = scoreLeakage(leakage)
  assert.ok(score > 0 && score <= 100)
}

function smokeAttribution() {
  const ctx = mockCtx()
  const expected = computeExpectedFinancialState(ctx, 1)
  const earned = computeEarnedFinancialState({
    ctx,
    expected,
    visitBlocked: false,
    graphBlocked: false,
  })
  const leakage = detectRevenueLeakage({
    ctx,
    expected,
    executed: computeExecutedFinancialState(ctx),
    earned,
    unscheduled: computeUnscheduledRuntimeBurden(ctx),
    graphBlocked: false,
  })
  const attrs = buildProcedureFinancialAttributions({ ctx, expected, earned, leakage })
  assert.equal(attrs.length, ctx.procedures.filter((p) => !p.sectionDisabled).length)
  assert.ok(attrs.some((a) => a.leakageKinds.includes('executed_unsigned')))
}

function smokeSafeguards() {
  const safeguards = evaluateFinancialIntegritySafeguards({
    expected: {
      procedureCount: 2,
      billableProcedureCount: 1,
      requiredProcedureCount: 2,
      conditionalExpectedCount: 0,
      units: [],
      protocolGraphRevision: null,
    },
    executed: {
      procedureCompletedCount: 3,
      procedureBillableCompletedCount: 2,
      workflowExecutionCount: 0,
      sourceCaptureSubmittedCount: 0,
      safetyExecutionCount: 0,
      units: [],
    },
    earned: {
      procedureEarnedCount: 4,
      billableEarnedCount: 3,
      graphCompliantEarnedCount: 4,
      signableEarnedCount: 4,
      units: [],
    },
    hasProtocolGraph: false,
  })
  assert.ok(safeguards.some((s) => s.id === 'safeguard:earned-exceeds-executed'))
}

function smokeEarnedRate() {
  const expectedCount = 4
  const earnedCount = 3
  const basis = Math.round((earnedCount / expectedCount) * EARNED_RATE_BASIS)
  assert.equal(basis, 7500)
}

function smokeUnscheduledBurden() {
  const ctx = mockCtx({
    scheduledDate: null,
    windowStatus: 'out_of_window',
  })
  const burden = computeUnscheduledRuntimeBurden(ctx)
  assert.ok(burden.burdenScore > 0)
  assert.equal(burden.missingScheduledDate, true)
}

function main() {
  assert.equal(FINANCIAL_RUNTIME_VERSION, 1)
  smokeExpectedExecutedEarned()
  smokeLeakage()
  smokeAttribution()
  smokeSafeguards()
  smokeEarnedRate()
  smokeUnscheduledBurden()
  console.log('phase7-financial-runtime-smoke: OK')
}

main()
