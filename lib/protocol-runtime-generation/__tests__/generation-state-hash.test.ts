import { describe, expect, it } from 'vitest'
import { computeGenerationStateHash, buildGenerationRunStateSnapshot } from '../generation-state-hash'

describe('generation state hash', () => {
  it('produces deterministic SHA-256 hex hash for same input', () => {
    const snapshot = { foo: 'bar', count: 42 }
    expect(computeGenerationStateHash(snapshot)).toBe(computeGenerationStateHash(snapshot))
  })

  it('produces 64-character hex string', () => {
    const hash = computeGenerationStateHash({ a: 1 })
    expect(hash).toHaveLength(64)
    expect(hash).toMatch(/^[a-f0-9]{64}$/)
  })

  it('changes when state value changes', () => {
    const a = computeGenerationStateHash({ status: 'draft' })
    const b = computeGenerationStateHash({ status: 'generated' })
    expect(a).not.toBe(b)
  })

  it('changes when key added to state', () => {
    const a = computeGenerationStateHash({ x: 1 })
    const b = computeGenerationStateHash({ x: 1, y: 2 })
    expect(a).not.toBe(b)
  })

  it('produces stable hash for equivalent serialized input (sorted keys)', () => {
    const a = computeGenerationStateHash({ b: 2, a: 1 })
    const b = computeGenerationStateHash({ a: 1, b: 2 })
    expect(a).toBe(b)
  })

  it('handles nested objects', () => {
    const snapshot = { nested: { deep: { value: true } } }
    expect(computeGenerationStateHash(snapshot)).toHaveLength(64)
  })

  it('handles arrays', () => {
    const a = computeGenerationStateHash({ items: [1, 2, 3] })
    const b = computeGenerationStateHash({ items: [3, 2, 1] })
    expect(a).not.toBe(b)
  })

  it('handles null values', () => {
    const hash = computeGenerationStateHash({ a: null, b: 'c' })
    expect(hash).toHaveLength(64)
  })
})

describe('buildGenerationRunStateSnapshot', () => {
  const run = {
    id: 'run-1',
    generationStatus: 'draft',
    studyId: 'study-1',
    protocolVersionId: 'vp-001',
    generatedRuntimeSnapshotId: null,
    validationErrors: [{ code: 'test', message: 'test error' }],
  }

  it('returns stable keys in expected shape', () => {
    const snapshot = buildGenerationRunStateSnapshot(run as Parameters<typeof buildGenerationRunStateSnapshot>[0])
    expect(snapshot).toEqual({
      id: 'run-1',
      protocol_version_id: 'vp-001',
      study_id: 'study-1',
      generation_status: 'draft',
      generated_runtime_snapshot_id: null,
      validation_errors: [{ code: 'test', message: 'test error' }],
    })
  })

  it('produces different hash when status changes', () => {
    const draft = buildGenerationRunStateSnapshot(run as Parameters<typeof buildGenerationRunStateSnapshot>[0])
    const generated = buildGenerationRunStateSnapshot({
      ...run,
      generationStatus: 'generated',
      generatedRuntimeSnapshotId: 'snap-1',
    } as Parameters<typeof buildGenerationRunStateSnapshot>[0])
    expect(computeGenerationStateHash(draft)).not.toBe(computeGenerationStateHash(generated))
  })

  it('produces same hash for identical inputs', () => {
    const a = buildGenerationRunStateSnapshot(run as Parameters<typeof buildGenerationRunStateSnapshot>[0])
    const b = buildGenerationRunStateSnapshot(run as Parameters<typeof buildGenerationRunStateSnapshot>[0])
    expect(computeGenerationStateHash(a)).toBe(computeGenerationStateHash(b))
  })
})
