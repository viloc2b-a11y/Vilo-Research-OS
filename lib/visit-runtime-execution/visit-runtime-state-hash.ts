import { createHash } from 'crypto'
import type { VisitRuntimeStateSnapshot } from './visit-runtime-types'

function stableSerialize(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value)
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableSerialize(item)).join(',')}]`
  }
  const record = value as Record<string, unknown>
  const keys = Object.keys(record).sort()
  return `{${keys.map((key) => `${JSON.stringify(key)}:${stableSerialize(record[key])}`).join(',')}}`
}

export function normalizeVisitRuntimeState(
  snapshot: VisitRuntimeStateSnapshot,
): VisitRuntimeStateSnapshot {
  const procedures = [...snapshot.procedures]
    .sort((a, b) => a.procedure_instance_id.localeCompare(b.procedure_instance_id))
    .map((procedure) => ({
      procedure_instance_id: procedure.procedure_instance_id,
      procedure_status: procedure.procedure_status,
      field_values: procedure.field_values ?? {},
    }))

  return {
    visit_instance_id: snapshot.visit_instance_id,
    visit_status: snapshot.visit_status,
    progress_percent: snapshot.progress_percent,
    procedures,
  }
}

export function computeVisitRuntimeStateHash(snapshot: VisitRuntimeStateSnapshot): string {
  const normalized = normalizeVisitRuntimeState(snapshot)
  const serialized = stableSerialize(normalized)
  return createHash('sha256').update(serialized).digest('hex')
}
