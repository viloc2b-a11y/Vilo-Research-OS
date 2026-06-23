import { describe, expect, it } from 'vitest'
import { evaluateSourceReadiness, buildSourceReadinessInput, type SourceReadinessRawData } from './source-readiness'

function makeRaw(over: Partial<SourceReadinessRawData> = {}): SourceReadinessRawData {
  return {
    hasProtocolRuntime: true,
    hasPublishedSource: true,
    hasVisitDefinitions: true,
    hasSourceBindings: true,
    sourceGenerationErrors: 0,
    missingSourceCount: 0,
    publishReady: true,
    validationStatus: 'valid',
    packageConsistency: 'Pass',
    canExecuteRuntime: true,
    runtimeBlockers: [],
    runtimeWarnings: [],
    staleAfterAmendment: false,
    ...over,
  }
}

describe('evaluateSourceReadiness', () => {
  it('returns ready when all source data is healthy', () => {
    const input = buildSourceReadinessInput(makeRaw())
    const result = evaluateSourceReadiness(input)
    expect(result.status).toBe('ready')
    expect(result.score).toBe(100)
    expect(result.blockers).toHaveLength(0)
  })

  it('returns blocked when no protocol runtime exists', () => {
    const input = buildSourceReadinessInput(makeRaw({ hasProtocolRuntime: false }))
    const result = evaluateSourceReadiness(input)
    expect(result.status).toBe('blocked')
    expect(result.score).toBeLessThan(50)
    expect(result.blockers.some((b) => b.message.includes('protocol draft'))).toBe(true)
  })

  it('returns blocked when runtime execution is blocked', () => {
    const input = buildSourceReadinessInput(makeRaw({
      canExecuteRuntime: false,
      runtimeBlockers: ['Source bindings incomplete'],
    }))
    const result = evaluateSourceReadiness(input)
    expect(result.status).toBe('blocked')
    expect(result.blockers.some((b) => b.message.includes('Source bindings incomplete'))).toBe(true)
  })

  it('returns blocked when source generation errors exist', () => {
    const input = buildSourceReadinessInput(makeRaw({ sourceGenerationErrors: 3 }))
    const result = evaluateSourceReadiness(input)
    expect(result.status).toBe('blocked')
    expect(result.blockers.some((b) => b.message.includes('generation error'))).toBe(true)
  })

  it('returns blocked when source is stale after amendment', () => {
    const input = buildSourceReadinessInput(makeRaw({ staleAfterAmendment: true }))
    const result = evaluateSourceReadiness(input)
    expect(result.status).toBe('blocked')
    expect(result.blockers.some((b) => b.message.includes('stale after amendment'))).toBe(true)
  })

  it('returns blocked when required visits/procedures missing source', () => {
    const input = buildSourceReadinessInput(makeRaw({ missingSourceCount: 2 }))
    const result = evaluateSourceReadiness(input)
    expect(result.status).toBe('blocked')
    expect(result.blockers.some((b) => b.message.includes('missing source'))).toBe(true)
  })

  it('returns blocked when package consistency is Fail', () => {
    const input = buildSourceReadinessInput(makeRaw({ packageConsistency: 'Fail' }))
    const result = evaluateSourceReadiness(input)
    expect(result.status).toBe('blocked')
    expect(result.blockers.some((b) => b.message.includes('consistency check failed'))).toBe(true)
  })

  it('returns warning when no published source but protocol draft exists', () => {
    // hasProtocolRuntime=true but canExecuteRuntime=true means no runtime blockers
    // canExecuteRuntime is independent of hasPublishedSource in the input
    const input = buildSourceReadinessInput(makeRaw({
      hasPublishedSource: false,
      publishReady: null,
      validationStatus: null,
      packageConsistency: null,
      canExecuteRuntime: true, // runtime is fine but no published package yet
    }))
    const result = evaluateSourceReadiness(input)
    expect(result.status).toBe('warning')
    expect(result.score).toBeGreaterThanOrEqual(50)
    expect(result.score).toBeLessThan(80)
    expect(result.blockers.some((b) => b.message.includes('published source'))).toBe(true)
  })

  it('returns warning when no visit definitions exist', () => {
    const input = buildSourceReadinessInput(makeRaw({ hasVisitDefinitions: false }))
    const result = evaluateSourceReadiness(input)
    expect(result.status).toBe('warning')
    expect(result.blockers.some((b) => b.message.includes('visit definitions'))).toBe(true)
  })

  it('returns warning when no source bindings exist', () => {
    // Keep other fields healthy so we only test bindings
    const input = buildSourceReadinessInput(makeRaw({
      hasSourceBindings: false,
      missingSourceCount: 0,
      canExecuteRuntime: true,
    }))
    const result = evaluateSourceReadiness(input)
    expect(result.status).toBe('warning')
    expect(result.score).toBeGreaterThanOrEqual(50)
    expect(result.blockers.some((b) => b.message.includes('source bindings'))).toBe(true)
  })

  it('returns warning when not publish-ready', () => {
    const input = buildSourceReadinessInput(makeRaw({ publishReady: false }))
    const result = evaluateSourceReadiness(input)
    expect(result.status).toBe('warning')
    expect(result.blockers.some((b) => b.message.includes('publish-ready'))).toBe(true)
  })

  it('returns warning with runtime warnings', () => {
    const input = buildSourceReadinessInput(makeRaw({
      runtimeWarnings: ['Administrative study status is draft'],
    }))
    const result = evaluateSourceReadiness(input)
    expect(result.status).toBe('warning')
    expect(result.blockers.some((b) => b.message.includes('Administrative study status'))).toBe(true)
  })

  it('returns info when no source requirement detected along with protocol runtime block', () => {
    const input = buildSourceReadinessInput(makeRaw({
      hasProtocolRuntime: false,
      hasVisitDefinitions: false,
      hasPublishedSource: false,
      hasSourceBindings: false,
      canExecuteRuntime: true,
      missingSourceCount: 0,
      publishReady: null,
      validationStatus: null,
      packageConsistency: null,
    }))
    const result = evaluateSourceReadiness(input)
    // Blocked because no protocol runtime triggers critical blocker
    expect(result.status).toBe('blocked')
    expect(result.blockers.some((b) => b.message.includes('No source requirement'))).toBe(true)
  })

  it('score is clamped between 0 and 100', () => {
    const input = buildSourceReadinessInput(makeRaw({
      hasProtocolRuntime: false,
      canExecuteRuntime: false,
      runtimeBlockers: ['Blocker 1', 'Blocker 2'],
      sourceGenerationErrors: 5,
      staleAfterAmendment: true,
      hasPublishedSource: false,
      hasVisitDefinitions: false,
      hasSourceBindings: false,
      missingSourceCount: 3,
      packageConsistency: 'Fail',
    }))
    const result = evaluateSourceReadiness(input)
    expect(result.score).toBeGreaterThanOrEqual(0)
    expect(result.score).toBeLessThanOrEqual(100)
    expect(result.blockers.length).toBeGreaterThanOrEqual(5)
  })
})
