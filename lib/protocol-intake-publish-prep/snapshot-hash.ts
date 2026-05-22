import { createHash } from 'node:crypto'

function stableSerialize(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value)
  }
  if (Array.isArray(value)) {
    return `[${value.map((v) => stableSerialize(v)).join(',')}]`
  }
  const obj = value as Record<string, unknown>
  const keys = Object.keys(obj).sort()
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableSerialize(obj[k])}`).join(',')}}`
}

export function snapshotContentChecksum(payload: Record<string, unknown>): string {
  return createHash('sha256').update(stableSerialize(payload)).digest('hex')
}

export function buildSnapshotId(draftKey: string, createdAt: string): string {
  const stamp = createdAt.replace(/[:.]/g, '').slice(0, 15)
  const slug = draftKey.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 32)
  return `12EC-${slug}-${stamp}`
}
