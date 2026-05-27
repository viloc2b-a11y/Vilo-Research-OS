import { createHash } from 'crypto'
import type { QueryStateSnapshot } from './operational-review-types'

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

export function buildQueryStateSnapshot(query: {
  id: string
  queryStatus: QueryStateSnapshot['query_status']
  priority: QueryStateSnapshot['priority']
  metadata: Record<string, unknown>
  resolutionText: string | null
}): QueryStateSnapshot {
  const answerText =
    typeof query.metadata.answer_text === 'string' ? query.metadata.answer_text : null
  return {
    query_id: query.id,
    query_status: query.queryStatus,
    priority: query.priority,
    answer_text: answerText,
    resolution_text: query.resolutionText,
  }
}

export function computeQueryStateHash(snapshot: QueryStateSnapshot): string {
  return createHash('sha256').update(stableSerialize(snapshot)).digest('hex')
}
