import { describe, expect, it } from 'vitest'
import {
  computeStudyReadiness,
  evaluateRegulatoryReadiness,
  evaluateSourceReadiness,
  evaluatePharmacyReadiness,
  evaluateLabReadiness,
  evaluateSystemsReadiness,
  evaluateTrainingReadiness,
  evaluateContractReadiness,
  evaluateBudgetReadiness,
  type ReadinessDomain,
  type ReadinessEvaluator,
} from './study-readiness'

describe('individual domain evaluators', () => {
  it('regulatory readiness defaults to ready', () => {
    const result = evaluateRegulatoryReadiness('study-1')
    expect(result.domain).toBe('regulatory')
    expect(result.status).toBe('ready')
    expect(result.score).toBe(100)
    expect(result.blockers).toHaveLength(0)
  })

  it('source readiness defaults to ready', () => {
    const result = evaluateSourceReadiness('study-1')
    expect(result.status).toBe('ready')
    expect(result.score).toBe(100)
  })

  it('pharmacy readiness defaults to ready', () => {
    const result = evaluatePharmacyReadiness('study-1')
    expect(result.status).toBe('ready')
  })

  it('lab readiness defaults to ready', () => {
    const result = evaluateLabReadiness('study-1')
    expect(result.status).toBe('ready')
  })

  it('systems readiness defaults to ready', () => {
    const result = evaluateSystemsReadiness('study-1')
    expect(result.status).toBe('ready')
  })

  it('training readiness defaults to ready', () => {
    const result = evaluateTrainingReadiness('study-1')
    expect(result.status).toBe('ready')
  })

  it('contract readiness defaults to ready', () => {
    const result = evaluateContractReadiness('study-1')
    expect(result.status).toBe('ready')
  })

  it('budget readiness defaults to ready', () => {
    const result = evaluateBudgetReadiness('study-1')
    expect(result.status).toBe('ready')
  })
})

describe('computeStudyReadiness', () => {
  it('returns ready when all domains are ready', async () => {
    const result = await computeStudyReadiness('study-1')
    expect(result.overall).toBe('ready')
    expect(result.overallScore).toBe(100)
    expect(result.domainCount).toBe(8)
    expect(result.readyDomainCount).toBe(8)
    expect(result.blockedDomainCount).toBe(0)
    expect(result.allBlockers).toHaveLength(0)
  })

  it('returns warning when one domain has warnings', async () => {
    const evaluators: Record<string, ReadinessEvaluator> = {
      regulatory: () => ({
        domain: 'regulatory',
        status: 'warning',
        score: 60,
        blockers: [{ domain: 'regulatory', severity: 'warning', message: 'GCP expiring soon' }],
      }),
      source: () => ({ domain: 'source', status: 'ready', score: 100, blockers: [] }),
      pharmacy: () => ({ domain: 'pharmacy', status: 'ready', score: 100, blockers: [] }),
      lab: () => ({ domain: 'lab', status: 'ready', score: 100, blockers: [] }),
      systems: () => ({ domain: 'systems', status: 'ready', score: 100, blockers: [] }),
      training: () => ({ domain: 'training', status: 'ready', score: 100, blockers: [] }),
      contract: () => ({ domain: 'contract', status: 'ready', score: 100, blockers: [] }),
      budget: () => ({ domain: 'budget', status: 'ready', score: 100, blockers: [] }),
    }

    const result = await computeStudyReadiness('study-1', evaluators)
    expect(result.overall).toBe('warning')
    expect(result.overallScore).toBeLessThan(100)
    expect(result.readyDomainCount).toBe(7)
    expect(result.warningDomainCount).toBe(1)
    expect(result.warnings).toHaveLength(1)
  })

  it('returns blocked when one domain is blocked', async () => {
    const evaluators: Record<string, ReadinessEvaluator> = {
      regulatory: () => ({
        domain: 'regulatory',
        status: 'blocked',
        score: 30,
        blockers: [{ domain: 'regulatory', severity: 'critical', message: 'License expired' }],
      }),
      source: () => ({ domain: 'source', status: 'ready', score: 100, blockers: [] }),
      pharmacy: () => ({ domain: 'pharmacy', status: 'ready', score: 100, blockers: [] }),
      lab: () => ({ domain: 'lab', status: 'ready', score: 100, blockers: [] }),
      systems: () => ({ domain: 'systems', status: 'ready', score: 100, blockers: [] }),
      training: () => ({ domain: 'training', status: 'ready', score: 100, blockers: [] }),
      contract: () => ({ domain: 'contract', status: 'ready', score: 100, blockers: [] }),
      budget: () => ({ domain: 'budget', status: 'ready', score: 100, blockers: [] }),
    }

    const result = await computeStudyReadiness('study-1', evaluators)
    expect(result.overall).toBe('blocked')
    expect(result.overallScore).toBeLessThan(95)
    expect(result.blockedDomainCount).toBe(1)
    expect(result.criticalBlockers).toHaveLength(1)
  })

  it('computes overall score as weighted average', async () => {
    const evaluators: Record<string, ReadinessEvaluator> = {
      a: () => ({ domain: 'a', status: 'ready', score: 100, blockers: [] }),
      b: () => ({ domain: 'b', status: 'ready', score: 80, blockers: [] }),
    }
    const result = await computeStudyReadiness('study-1', evaluators)
    // (100 + 80) / 2 = 90
    expect(result.overallScore).toBe(90)
  })

  it('aggregates all blockers from all domains', async () => {
    const evaluators: Record<string, ReadinessEvaluator> = {
      a: () => ({
        domain: 'a',
        status: 'blocked',
        score: 30,
        blockers: [
          { domain: 'a', severity: 'critical', message: 'Critical issue' },
          { domain: 'a', severity: 'warning', message: 'Warning issue' },
          { domain: 'a', severity: 'info', message: 'Info message' },
        ],
      }),
      b: () => ({
        domain: 'b',
        status: 'ready',
        score: 100,
        blockers: [],
      }),
    }
    const result = await computeStudyReadiness('study-1', evaluators)
    expect(result.allBlockers).toHaveLength(3)
    expect(result.criticalBlockers).toHaveLength(1)
    expect(result.warnings).toHaveLength(1)
    expect(result.infoMessages).toHaveLength(1)
  })

  it('returns score 100 for no domains', async () => {
    const result = await computeStudyReadiness('study-1', {})
    expect(result.overall).toBe('ready')
    expect(result.overallScore).toBe(100)
    expect(result.domainCount).toBe(0)
  })

  it('supports async evaluators', async () => {
    const evaluators: Record<string, ReadinessEvaluator> = {
      asyncDomain: async () => ({
        domain: 'asyncDomain',
        status: 'ready',
        score: 95,
        blockers: [],
      }),
    }
    const result = await computeStudyReadiness('study-1', evaluators)
    expect(result.overallScore).toBe(95)
    expect(result.overall).toBe('ready')
  })

  it('overall status is blocked when any domain is blocked', async () => {
    const evaluators: Record<string, ReadinessEvaluator> = {
      // blocked + warning + ready → blocked wins
      blocked: () => ({ domain: 'blocked', status: 'blocked', score: 30, blockers: [
        { domain: 'blocked', severity: 'critical', message: 'Blocked' },
      ]}),
      warning: () => ({ domain: 'warning', status: 'warning', score: 60, blockers: [
        { domain: 'warning', severity: 'warning', message: 'Warning' },
      ]}),
      ready: () => ({ domain: 'ready', status: 'ready', score: 100, blockers: [] }),
    }
    const result = await computeStudyReadiness('study-1', evaluators)
    expect(result.overall).toBe('blocked')
    expect(result.blockedDomainCount).toBe(1)
    expect(result.warningDomainCount).toBe(1)
    expect(result.readyDomainCount).toBe(1)
  })
})
