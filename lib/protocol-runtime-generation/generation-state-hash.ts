import { createHash } from 'crypto'

function stableSerialize(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map((item) => stableSerialize(item)).join(',')}]`
  const record = value as Record<string, unknown>
  const keys = Object.keys(record).sort()
  return `{${keys.map((key) => `${JSON.stringify(key)}:${stableSerialize(record[key])}`).join(',')}}`
}

export function computeGenerationStateHash(snapshot: Record<string, unknown>): string {
  return createHash('sha256').update(stableSerialize(snapshot)).digest('hex')
}

export function buildGenerationRunStateSnapshot(run: {
  id: string
  generationStatus: string
  studyId: string
  protocolVersionId: string
  generatedRuntimeSnapshotId: string | null
  validationErrors: Array<Record<string, unknown>>
}) {
  return {
    id: run.id,
    protocol_version_id: run.protocolVersionId,
    study_id: run.studyId,
    generation_status: run.generationStatus,
    generated_runtime_snapshot_id: run.generatedRuntimeSnapshotId,
    validation_errors: run.validationErrors,
  }
}

