import { describe, expect, it } from 'vitest'
import { evaluatePharmacyReadiness, type PharmacyReadinessInput } from './pharmacy-readiness'

function makeInput(over: Partial<PharmacyReadinessInput> = {}): PharmacyReadinessInput {
  return {
    requiresIP: true,
    hasActiveBlueprint: true,
    blueprintStatus: 'active',
    crcReviewCompleted: true,
    requiresBlinding: false,
    blindingConfigured: false,
    receiptConfigComplete: true,
    dispensingRulesConfigured: true,
    accountabilityConfigured: true,
    hasPharmacyBlockers: false,
    pharmacyBlockerCount: 0,
    pharmacyBlockerMessages: [],
    storageConfigComplete: true,
    ...over,
  }
}

describe('evaluatePharmacyReadiness', () => {
  it('returns ready when all pharmacy setup is complete', () => {
    const result = evaluatePharmacyReadiness(makeInput())
    expect(result.status).toBe('ready')
    expect(result.score).toBe(100)
    expect(result.blockers).toHaveLength(0)
  })

  it('returns ready with info when no IP requirement detected', () => {
    const result = evaluatePharmacyReadiness(makeInput({ requiresIP: false }))
    expect(result.status).toBe('ready')
    expect(result.score).toBe(100)
    expect(result.blockers.some((b) => b.message.includes('investigational product'))).toBe(true)
  })

  it('returns blocked when IP required but no blueprint', () => {
    const result = evaluatePharmacyReadiness(makeInput({
      hasActiveBlueprint: false,
      blueprintStatus: null,
    }))
    expect(result.status).toBe('blocked')
    expect(result.score).toBeLessThan(50)
    expect(result.blockers.some((b) => b.message.includes('no pharmacy blueprint'))).toBe(true)
  })

  it('returns blocked when critical pharmacy blockers exist', () => {
    const result = evaluatePharmacyReadiness(makeInput({
      hasPharmacyBlockers: true,
      pharmacyBlockerCount: 2,
      pharmacyBlockerMessages: ['Temperature excursion detected', 'IP shipment overdue'],
    }))
    expect(result.status).toBe('blocked')
    expect(result.score).toBeLessThan(50)
    expect(result.blockers.some((b) => b.message.includes('Temperature'))).toBe(true)
    expect(result.blockers.some((b) => b.message.includes('IP shipment'))).toBe(true)
  })

  it('returns blocked when blueprint exists but not active', () => {
    const result = evaluatePharmacyReadiness(makeInput({
      blueprintStatus: 'draft',
      crcReviewCompleted: false,
    }))
    expect(result.status).toBe('blocked')
    expect(result.blockers.some((b) => b.message.includes('blueprint status'))).toBe(true)
  })

  it('returns warning when CRC review not completed', () => {
    const result = evaluatePharmacyReadiness(makeInput({ crcReviewCompleted: false }))
    expect(result.status).toBe('warning')
    expect(result.score).toBeGreaterThanOrEqual(50)
    expect(result.score).toBeLessThan(80)
    expect(result.blockers.some((b) => b.message.includes('CRC review'))).toBe(true)
  })

  it('returns warning when receipt config incomplete', () => {
    const result = evaluatePharmacyReadiness(makeInput({ receiptConfigComplete: false }))
    expect(result.status).toBe('warning')
    expect(result.blockers.some((b) => b.message.includes('receipt/storage'))).toBe(true)
  })

  it('returns warning when dispensing rules not configured', () => {
    const result = evaluatePharmacyReadiness(makeInput({ dispensingRulesConfigured: false }))
    expect(result.status).toBe('warning')
    expect(result.blockers.some((b) => b.message.includes('Dispensing rules'))).toBe(true)
  })

  it('returns warning when accountability not configured', () => {
    const result = evaluatePharmacyReadiness(makeInput({ accountabilityConfigured: false }))
    expect(result.status).toBe('warning')
    expect(result.blockers.some((b) => b.message.includes('accountability'))).toBe(true)
  })

  it('returns warning when blinding required but not configured', () => {
    const result = evaluatePharmacyReadiness(makeInput({
      requiresBlinding: true,
      blindingConfigured: false,
    }))
    expect(result.status).toBe('warning')
    expect(result.blockers.some((b) => b.message.includes('Blinding'))).toBe(true)
  })

  it('returns warning when storage config incomplete', () => {
    const result = evaluatePharmacyReadiness(makeInput({ storageConfigComplete: false }))
    expect(result.status).toBe('warning')
    expect(result.blockers.some((b) => b.message.includes('storage'))).toBe(true)
  })

  it('score is clamped between 0 and 100', () => {
    const result = evaluatePharmacyReadiness(makeInput({
      hasActiveBlueprint: false,
      hasPharmacyBlockers: true,
      pharmacyBlockerMessages: ['Critical issue'],
    }))
    expect(result.score).toBeGreaterThanOrEqual(0)
    expect(result.score).toBeLessThanOrEqual(100)
  })
})
