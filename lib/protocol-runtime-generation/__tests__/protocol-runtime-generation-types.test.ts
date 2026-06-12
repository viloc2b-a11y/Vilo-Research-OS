import { describe, expect, it } from 'vitest'
import { mapGenerationRunRow, mapGenerationEventRow } from '../protocol-runtime-generation-types'
import { coerceVisitType } from '../generate-study-runtime-from-reconciliation'

describe('coerceVisitType', () => {
  it('passes through valid visit types', () => {
    const valid = ['screening', 'baseline', 'treatment', 'follow_up', 'early_termination', 'unscheduled', 'phone', 'remote', 'other'] as const
    for (const t of valid) {
      expect(coerceVisitType(t)).toBe(t)
    }
  })

  it('is case insensitive', () => {
    expect(coerceVisitType('SCREENING')).toBe('screening')
    expect(coerceVisitType('Baseline')).toBe('baseline')
    expect(coerceVisitType('Follow_Up')).toBe('follow_up')
  })

  it('trims whitespace', () => {
    expect(coerceVisitType('  treatment  ')).toBe('treatment')
  })

  it('returns "other" for null', () => {
    expect(coerceVisitType(null)).toBe('other')
  })

  it('returns "other" for undefined', () => {
    expect(coerceVisitType(undefined as unknown as string | null)).toBe('other')
  })

  it('returns "other" for unknown type', () => {
    expect(coerceVisitType('random_value')).toBe('other')
  })

  it('returns "other" for empty string', () => {
    expect(coerceVisitType('')).toBe('other')
  })
})

describe('mapGenerationRunRow', () => {
  const raw = {
    id: 'abc-123',
    organization_id: 'org-1',
    protocol_version_id: 'vp-001',
    protocol_runtime_study_id: 'prs-1',
    study_id: 'study-1',
    generation_status: 'generated',
    generated_runtime_snapshot_id: 'snap-1',
    generated_by: 'user-1',
    generated_at: '2026-06-12T12:00:00Z',
    source_summary: { visits: 5 },
    result_summary: { procedures: 20 },
    validation_errors: [],
    metadata: { source: 'smoke' },
    created_at: '2026-06-12T10:00:00Z',
    updated_at: '2026-06-12T12:00:00Z',
  }

  it('maps all required fields from snake_case', () => {
    const result = mapGenerationRunRow(raw as Record<string, unknown>)
    expect(result.id).toBe('abc-123')
    expect(result.organizationId).toBe('org-1')
    expect(result.protocolVersionId).toBe('vp-001')
    expect(result.protocolRuntimeStudyId).toBe('prs-1')
    expect(result.studyId).toBe('study-1')
    expect(result.generationStatus).toBe('generated')
    expect(result.generatedRuntimeSnapshotId).toBe('snap-1')
    expect(result.generatedBy).toBe('user-1')
    expect(result.generatedAt).toBe('2026-06-12T12:00:00Z')
    expect(result.sourceSummary).toEqual({ visits: 5 })
    expect(result.resultSummary).toEqual({ procedures: 20 })
    expect(result.validationErrors).toEqual([])
    expect(result.metadata).toEqual({ source: 'smoke' })
    expect(result.createdAt).toBe('2026-06-12T10:00:00Z')
    expect(result.updatedAt).toBe('2026-06-12T12:00:00Z')
  })

  it('defaults nullable fields to null when missing', () => {
    const minimal = {
      id: 'x',
      organization_id: 'o',
      protocol_version_id: 'p',
      protocol_runtime_study_id: 'prs',
      study_id: 's',
      generation_status: 'draft',
      generated_by: 'u',
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    }
    const result = mapGenerationRunRow(minimal as Record<string, unknown>)
    expect(result.generatedRuntimeSnapshotId).toBeNull()
    expect(result.generatedAt).toBeNull()
    expect(result.sourceSummary).toEqual({})
    expect(result.resultSummary).toEqual({})
    expect(result.validationErrors).toEqual([])
    expect(result.metadata).toEqual({})
  })

  it('casts ids to string', () => {
    const numeric = {
      id: 1, organization_id: 2, protocol_version_id: 3, protocol_runtime_study_id: 4, study_id: 5,
      generation_status: 'draft',
      generated_by: 6,
      created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z',
    }
    const result = mapGenerationRunRow(numeric as unknown as Record<string, unknown>)
    expect(result.id).toBe('1')
    expect(result.organizationId).toBe('2')
    expect(result.protocolVersionId).toBe('3')
  })

  it('handles empty validation_errors', () => {
    const row = {
      ...raw, generated_runtime_snapshot_id: null, generated_at: null,
      validation_errors: undefined,
    }
    const result = mapGenerationRunRow(row as unknown as Record<string, unknown>)
    expect(result.validationErrors).toEqual([])
  })
})

describe('mapGenerationEventRow', () => {
  const raw = {
    id: 'evt-1',
    organization_id: 'org-1',
    generation_run_id: 'run-1',
    protocol_version_id: 'vp-001',
    event_type: 'generation_validated',
    actor_id: 'user-1',
    event_timestamp: '2026-06-12T12:00:00Z',
    event_payload: { step: 'validate' },
    state_hash: 'abc123def456',
    metadata: { env: 'test' },
  }

  it('maps all required fields from snake_case', () => {
    const result = mapGenerationEventRow(raw as Record<string, unknown>)
    expect(result.id).toBe('evt-1')
    expect(result.organizationId).toBe('org-1')
    expect(result.generationRunId).toBe('run-1')
    expect(result.protocolVersionId).toBe('vp-001')
    expect(result.eventType).toBe('generation_validated')
    expect(result.actorId).toBe('user-1')
    expect(result.eventTimestamp).toBe('2026-06-12T12:00:00Z')
    expect(result.eventPayload).toEqual({ step: 'validate' })
    expect(result.stateHash).toBe('abc123def456')
    expect(result.metadata).toEqual({ env: 'test' })
  })

  it('defaults actorId to null when missing', () => {
    const row = { ...raw, actor_id: undefined, event_payload: undefined, metadata: undefined }
    const result = mapGenerationEventRow(row as unknown as Record<string, unknown>)
    expect(result.actorId).toBeNull()
    expect(result.eventPayload).toEqual({})
    expect(result.metadata).toEqual({})
  })
})
