import { createHash } from 'crypto'
import type { VisitSnapshotJson } from './visit-locking-types'

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

export function normalizeVisitSnapshotJson(snapshot: VisitSnapshotJson): VisitSnapshotJson {
  const procedures = [...snapshot.procedures]
    .sort(
      (a, b) =>
        a.procedure_code.localeCompare(b.procedure_code)
        || a.procedure_instance_id.localeCompare(b.procedure_instance_id),
    )
    .map((procedure) => ({
      ...procedure,
      field_values: sortFieldValues(procedure.field_values),
    }))

  const events = [...snapshot.events].sort(
    (a, b) =>
      a.event_timestamp.localeCompare(b.event_timestamp) || a.event_type.localeCompare(b.event_type),
  )

  return {
    visit_instance: { ...snapshot.visit_instance },
    procedures,
    events,
    source_context: { ...snapshot.source_context },
  }
}

function sortFieldValues(values: Record<string, unknown>): Record<string, unknown> {
  const sorted: Record<string, unknown> = {}
  for (const key of Object.keys(values).sort()) {
    sorted[key] = values[key]
  }
  return sorted
}

export function computeVisitSnapshotHash(snapshot: VisitSnapshotJson): string {
  const normalized = normalizeVisitSnapshotJson(snapshot)
  return createHash('sha256').update(stableSerialize(normalized)).digest('hex')
}
