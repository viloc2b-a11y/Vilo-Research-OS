import { calculateLeadScore } from '@/lib/crm/calculate-lead-score'
import type { LeadScoreInput, OrgScoreConfig } from '@/lib/crm/calculate-lead-score'

const defaultConfig: OrgScoreConfig = { minAge: 18, maxAge: 75 }

// All signals true + in range + in area: max score 20
const allTrue: LeadScoreInput = {
  symptomMatch: true,
  durationMeetsThreshold: true,
  age: 45,
  withinServiceArea: true,
  diagnosisConfirmed: true,
  availabilityConfirmed: true,
}

// Only gates pass (age in range, in area), all scoring booleans false
const gatesOnly: LeadScoreInput = {
  symptomMatch: false,
  durationMeetsThreshold: false,
  age: 45,
  withinServiceArea: true,
  diagnosisConfirmed: false,
  availabilityConfirmed: false,
}

describe('calculateLeadScore — hard fail gates', () => {
  test('age below minAge → hardFail:true, failReason:age_out_of_range, score:0, all signals 0', () => {
    const result = calculateLeadScore({ ...allTrue, age: 17 }, defaultConfig)
    expect(result.hardFail).toBe(true)
    expect(result.failReason).toBe('age_out_of_range')
    expect(result.score).toBe(0)
    expect(result.signals).toEqual({
      symptomMatch: 0,
      duration: 0,
      age: 0,
      location: 0,
      diagnosis: 0,
      availability: 0,
    })
  })

  test('age above maxAge → hardFail:true, failReason:age_out_of_range, score:0, all signals 0', () => {
    const result = calculateLeadScore({ ...allTrue, age: 76 }, defaultConfig)
    expect(result.hardFail).toBe(true)
    expect(result.failReason).toBe('age_out_of_range')
    expect(result.score).toBe(0)
    expect(result.signals).toEqual({
      symptomMatch: 0,
      duration: 0,
      age: 0,
      location: 0,
      diagnosis: 0,
      availability: 0,
    })
  })

  test('withinServiceArea:false → hardFail:true, failReason:outside_service_area', () => {
    const result = calculateLeadScore({ ...allTrue, withinServiceArea: false }, defaultConfig)
    expect(result.hardFail).toBe(true)
    expect(result.failReason).toBe('outside_service_area')
    expect(result.score).toBe(0)
  })

  test('age out of range AND withinServiceArea:false → failReason:age_out_of_range (age checked first)', () => {
    const result = calculateLeadScore(
      { ...allTrue, age: 10, withinServiceArea: false },
      defaultConfig
    )
    expect(result.hardFail).toBe(true)
    expect(result.failReason).toBe('age_out_of_range')
  })
})

describe('calculateLeadScore — scoring and tier assignment', () => {
  test('all signals true, age in range, in area → score:20, tier:high, hardFail:false', () => {
    const result = calculateLeadScore(allTrue, defaultConfig)
    expect(result.score).toBe(20)
    expect(result.tier).toBe('high')
    expect(result.hardFail).toBe(false)
  })

  test('only gates pass (all booleans false) → score:7, tier:waitlist', () => {
    // age:4 + location:3 = 7
    const result = calculateLeadScore(gatesOnly, defaultConfig)
    expect(result.score).toBe(7)
    expect(result.tier).toBe('waitlist')
    expect(result.hardFail).toBe(false)
  })

  test('score 16 → tier:high (lowest achievable high threshold)', () => {
    // symptomMatch:3 + duration:3 + age:4 + location:3 + diagnosis:4 - availability:0 + ... let's do:
    // symptomMatch:3 + duration:3 + age:4 + location:3 + diagnosis:3... no, diagnosis=4
    // To get 16: age:4 + location:3 + diagnosis:4 + symptomMatch:3 + duration:3 - availability:0 = 17 (too high)
    // age:4 + location:3 + diagnosis:4 + symptomMatch:3 + availability:3 - duration:0 = 17
    // age:4 + location:3 + symptomMatch:3 + duration:3 + availability:3 = 16 (no diagnosis)
    const input: LeadScoreInput = {
      symptomMatch: true,
      durationMeetsThreshold: true,
      age: 45,
      withinServiceArea: true,
      diagnosisConfirmed: false,
      availabilityConfirmed: true,
    }
    const result = calculateLeadScore(input, defaultConfig)
    expect(result.score).toBe(16)
    expect(result.tier).toBe('high')
  })

  test('score 14 → tier:medium', () => {
    // symptomMatch:3 + duration:3 + age:4 + location:3 + diagnosis:0 + availability:0 = 13... not 14
    // symptomMatch:3 + duration:0 + age:4 + location:3 + diagnosis:4 + availability:0 = 14
    const input: LeadScoreInput = {
      symptomMatch: true,
      durationMeetsThreshold: false,
      age: 45,
      withinServiceArea: true,
      diagnosisConfirmed: true,
      availabilityConfirmed: false,
    }
    const result = calculateLeadScore(input, defaultConfig)
    expect(result.score).toBe(14)
    expect(result.tier).toBe('medium')
  })

  test('score 10 → tier:medium (lowest achievable medium)', () => {
    // age:4 + location:3 + symptomMatch:3 = 10
    const input: LeadScoreInput = {
      symptomMatch: true,
      durationMeetsThreshold: false,
      age: 45,
      withinServiceArea: true,
      diagnosisConfirmed: false,
      availabilityConfirmed: false,
    }
    const result = calculateLeadScore(input, defaultConfig)
    expect(result.score).toBe(10)
    expect(result.tier).toBe('medium')
  })

  test('score 7 → tier:waitlist (gates only, confirmed from gates-only case)', () => {
    const result = calculateLeadScore(gatesOnly, defaultConfig)
    expect(result.score).toBe(7)
    expect(result.tier).toBe('waitlist')
  })
})

describe('calculateLeadScore — result shape', () => {
  test('signals object has all 6 keys with correct per-signal values', () => {
    const result = calculateLeadScore(allTrue, defaultConfig)
    expect(result.signals).toEqual({
      symptomMatch: 3,
      duration: 3,
      age: 4,
      location: 3,
      diagnosis: 4,
      availability: 3,
    })
  })

  test('failReason is absent when hardFail is false', () => {
    const result = calculateLeadScore(allTrue, defaultConfig)
    expect(result.hardFail).toBe(false)
    expect(result).not.toHaveProperty('failReason')
  })
})
