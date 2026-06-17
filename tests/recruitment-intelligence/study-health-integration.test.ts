import { describe, test, expect } from 'vitest'
import { scoreStudyHealth, resolveStudyOperationalState } from '@/lib/performance/scoring/study-scoring'
import type { StudyHealthInput } from '@/lib/performance/scoring/types'

function makeInput(overrides: Partial<StudyHealthInput> = {}): StudyHealthInput {
  return {
    studyId: 'study-test-1',
    blockedProcedureCount: 0,
    missedVisitCount: 0,
    openQueryCount: 0,
    openFindingsCount: 0,
    unsignedOver48hCount: 0,
    visitsClosingWindowToday: 0,
    staleStudyFlag: false,
    // Provide minimal budget evidence so existing checks don't fire
    budgetEvidenceDocumentCount: 1,
    contractEvidenceDocumentCount: 1,
    activeBudgetReferenceCount: 1,
    activeContractReferenceCount: 0,
    ...overrides,
  }
}

describe('study health integration — new VPI signal fields', () => {
  test('scoreStudyHealth returns studyId and operationalState', () => {
    const result = scoreStudyHealth(makeInput())
    expect(result.studyId).toBe('study-test-1')
    expect(result.operationalState).toBe('healthy')
    expect(typeof result.priorityRank).toBe('number')
  })

  test('forecastRisk null (no enrollment config) → does not affect healthy state', () => {
    // When forecastRisk is not provided in input (no enrollment config scenario),
    // the study remains healthy if no other signals fire
    const result = resolveStudyOperationalState(
      makeInput({
        enrollmentTarget: null,
        randomizedCount: 0,
      }),
    )
    expect(result).toBe('healthy')
  })

  test('enrollmentVelocity 0 when no subjects randomized does not crash scoring', () => {
    // Velocity=0 with no enrollment config → stalled but not a scoring crash
    expect(() =>
      resolveStudyOperationalState(
        makeInput({
          enrollmentTarget: null,
          randomizedCount: 0,
          qualifiedPipelineDepth: 0,
          subjectsRemaining: 0,
        }),
      ),
    ).not.toThrow()
  })

  test('pipeline_depth_risk escalates state to critical', () => {
    // qualifiedPipelineDepth (3) < subjectsRemaining (10) * 1.5 (15)
    const result = resolveStudyOperationalState(
      makeInput({
        qualifiedPipelineDepth: 3,
        subjectsRemaining: 10,
        enrollmentTarget: 20,
        randomizedCount: 10,
      }),
    )
    expect(result).toBe('critical')
  })

  test('source_concentration_risk escalates state to watch', () => {
    const result = resolveStudyOperationalState(
      makeInput({ sourceConcentrationRisk: true }),
    )
    expect(result).toBe('watch')
  })

  test('recruitment_funnel_stall escalates state to risk', () => {
    const result = resolveStudyOperationalState(
      makeInput({ recruitmentFunnelStall: true }),
    )
    expect(result).toBe('risk')
  })

  test('pipeline_depth_risk (critical) overrides funnel_stall (risk) → critical', () => {
    const result = resolveStudyOperationalState(
      makeInput({
        qualifiedPipelineDepth: 0,
        subjectsRemaining: 10,
        recruitmentFunnelStall: true,
      }),
    )
    expect(result).toBe('critical')
  })

  test('existing blockedProcedureCount critical check still works with new signals present', () => {
    // blockedProcedureCount > 0 should still produce critical regardless of recruitment signals
    const result = resolveStudyOperationalState(
      makeInput({
        blockedProcedureCount: 1,
        sourceConcentrationRisk: false,
        recruitmentFunnelStall: false,
      }),
    )
    expect(result).toBe('critical')
  })
})
