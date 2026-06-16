export type LeadScoreSignals = {
  symptomMatch: number   // 0 or 3
  duration: number       // 0 or 3
  age: number            // 0 or 4
  location: number       // 0 or 3
  diagnosis: number      // 0 or 4
  availability: number   // 0 or 3
}

export type HardFailReason = 'age_out_of_range' | 'outside_service_area'

export type LeadTier = 'high' | 'medium' | 'waitlist'

export type LeadScoreResult = {
  score: number
  tier: LeadTier
  hardFail: boolean
  failReason?: HardFailReason
  signals: LeadScoreSignals
}

export type LeadScoreInput = {
  symptomMatch: boolean
  durationMeetsThreshold: boolean
  age: number
  withinServiceArea: boolean
  diagnosisConfirmed: boolean
  availabilityConfirmed: boolean
}

export type OrgScoreConfig = {
  minAge: number
  maxAge: number
}

const ZERO_SIGNALS: LeadScoreSignals = {
  symptomMatch: 0,
  duration: 0,
  age: 0,
  location: 0,
  diagnosis: 0,
  availability: 0,
}

export function calculateLeadScore(
  input: LeadScoreInput,
  config: OrgScoreConfig
): LeadScoreResult {
  // Hard fail: age gate (checked first — takes priority over location gate)
  if (input.age < config.minAge || input.age > config.maxAge) {
    return {
      score: 0,
      tier: 'waitlist',
      hardFail: true,
      failReason: 'age_out_of_range',
      signals: { ...ZERO_SIGNALS },
    }
  }

  // Hard fail: location gate
  if (!input.withinServiceArea) {
    return {
      score: 0,
      tier: 'waitlist',
      hardFail: true,
      failReason: 'outside_service_area',
      signals: { ...ZERO_SIGNALS },
    }
  }

  // Signal scoring — age and location are always awarded after passing their gates
  const signals: LeadScoreSignals = {
    symptomMatch: input.symptomMatch ? 3 : 0,
    duration: input.durationMeetsThreshold ? 3 : 0,
    age: 4,
    location: 3,
    diagnosis: input.diagnosisConfirmed ? 4 : 0,
    availability: input.availabilityConfirmed ? 3 : 0,
  }

  const score = Object.values(signals).reduce((a, b) => a + b, 0)

  // Tier thresholds (DECISION 0.1): achievable scores are 7,10,11,13,14,16,17,20
  // high >= 16, medium >= 10, waitlist < 10
  const tier: LeadTier = score >= 16 ? 'high' : score >= 10 ? 'medium' : 'waitlist'

  return { score, tier, hardFail: false, signals }
}
