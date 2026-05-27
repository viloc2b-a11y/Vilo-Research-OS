import { createHash } from 'crypto'

function stableSerialize(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map(stableSerialize).join(',')}]`

  const object = value as Record<string, unknown>
  return `{${Object.keys(object)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableSerialize(object[key])}`)
    .join(',')}}`
}

export function computeOperationalArtifactHash(value: unknown): string {
  return createHash('sha256').update(stableSerialize(value)).digest('hex')
}
