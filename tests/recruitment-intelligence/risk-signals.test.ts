import { describe, test, expect } from 'vitest'
import { resolveRecruitmentRiskSignals } from '@/lib/performance/scoring/study-scoring'
import type { StudyHealthInput } from '@/lib/performance/scoring/types'

function makeInput(overrides: Partial<StudyHealthInput> = {}): StudyHealthInput {
  return {
    studyId: 'study-1',
    blockedProcedureCount: 0,
    missedVisitCount: 0,
    openQueryCount: 0,
    openFindingsCount: 0,
    unsignedOver48hCount: 0,
    visitsClosingWindowToday: 0,
    staleStudyFlag: false,
    ...overrides,
  }
}

describe('resolveRecruitmentRiskSignals', () => {
  // Pipeline Depth Risk
  test('pipeline_depth_risk fires when qualifiedPipelineDepth < subjectsRemaining * 1.5', () => {
    const signals = resolveRecruitmentRiskSignals(
      makeInput({
        qualifiedPipelineDepth: 5,
        subjectsRemaining: 10,
        // 5 < 10 * 1.5 = 15 → fires
      }),
    )
    const signal = signals.find((s) => s.type === 'pipeline_depth_risk')
    expect(signal).toBeDefined()
    expect(signal?.severity).toBe('critical')
    expect(signal?.message).toBe('Pipeline depth below safe threshold')
  })

  test('pipeline_depth_risk does NOT fire when pipeline is adequate', () => {
    const signals = resolveRecruitmentRiskSignals(
      makeInput({
        qualifiedPipelineDepth: 20,
        subjectsRemaining: 10,
        // 20 >= 10 * 1.5 = 15 → does not fire
      }),
    )
    expect(signals.find((s) => s.type === 'pipeline_depth_risk')).toBeUndefined()
  })

  test('pipeline_depth_risk does NOT fire when subjects_remaining is 0', () => {
    const signals = resolveRecruitmentRiskSignals(
      makeInput({
        qualifiedPipelineDepth: 0,
        subjectsRemaining: 0,
      }),
    )
    expect(signals.find((s) => s.type === 'pipeline_depth_risk')).toBeUndefined()
  })

  // Source Concentration Risk
  test('source_concentration_risk fires when sourceConcentrationRisk is true', () => {
    const signals = resolveRecruitmentRiskSignals(
      makeInput({ sourceConcentrationRisk: true }),
    )
    const signal = signals.find((s) => s.type === 'source_concentration_risk')
    expect(signal).toBeDefined()
    expect(signal?.severity).toBe('watch')
    expect(signal?.message).toBe('Over 80% of leads from single source')
  })

  test('source_concentration_risk does NOT fire when sourceConcentrationRisk is false', () => {
    const signals = resolveRecruitmentRiskSignals(
      makeInput({ sourceConcentrationRisk: false }),
    )
    expect(signals.find((s) => s.type === 'source_concentration_risk')).toBeUndefined()
  })

  test('source_concentration_risk does NOT fire when sourceConcentrationRisk is undefined', () => {
    const signals = resolveRecruitmentRiskSignals(makeInput())
    expect(signals.find((s) => s.type === 'source_concentration_risk')).toBeUndefined()
  })

  // Funnel Stall
  test('recruitment_funnel_stall fires when recruitmentFunnelStall is true', () => {
    const signals = resolveRecruitmentRiskSignals(
      makeInput({ recruitmentFunnelStall: true }),
    )
    const signal = signals.find((s) => s.type === 'recruitment_funnel_stall')
    expect(signal).toBeDefined()
    expect(signal?.severity).toBe('risk')
    expect(signal?.message).toBe('No lead stage movement in 14+ days')
  })

  test('recruitment_funnel_stall does NOT fire when recruitmentFunnelStall is false', () => {
    const signals = resolveRecruitmentRiskSignals(
      makeInput({ recruitmentFunnelStall: false }),
    )
    expect(signals.find((s) => s.type === 'recruitment_funnel_stall')).toBeUndefined()
  })

  test('multiple signals can fire simultaneously', () => {
    const signals = resolveRecruitmentRiskSignals(
      makeInput({
        recruitmentFunnelStall: true,
        qualifiedPipelineDepth: 2,
        subjectsRemaining: 10,
        sourceConcentrationRisk: true,
      }),
    )
    expect(signals).toHaveLength(3)
  })

  test('no signals fire when all inputs are safe', () => {
    const signals = resolveRecruitmentRiskSignals(
      makeInput({
        recruitmentFunnelStall: false,
        qualifiedPipelineDepth: 30,
        subjectsRemaining: 10,
        sourceConcentrationRisk: false,
      }),
    )
    expect(signals).toHaveLength(0)
  })
})
