/**
 * Deterministic canonical serialization for source integrity hashing.
 */

export type CanonicalSerializeOptions = {
  /** When true, omit keys whose value is undefined (distinct from explicit null). */
  omitUndefinedKeys?: boolean
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== 'object') return false
  if (Array.isArray(value)) return false
  const proto = Object.getPrototypeOf(value)
  return proto === Object.prototype || proto === null
}

function serializePrimitive(value: string | number | boolean | null): string {
  if (value === null) return 'null'
  if (typeof value === 'boolean') return value ? 'true' : 'false'
  if (typeof value === 'number') {
    if (Number.isNaN(value)) return 'number:NaN'
    if (!Number.isFinite(value)) return value > 0 ? 'number:Infinity' : 'number:-Infinity'
    return `number:${value}`
  }
  return `string:${value}`
}

function canonicalSerializeValue(
  value: unknown,
  options: CanonicalSerializeOptions,
): string {
  if (value === undefined) return 'undefined'
  if (value === null) return 'null'

  if (typeof value === 'boolean' || typeof value === 'number' || typeof value === 'string') {
    return serializePrimitive(value)
  }

  if (Array.isArray(value)) {
    const items = value.map((item) => canonicalSerializeValue(item, options))
    return `[${items.join(',')}]`
  }

  if (isPlainObject(value)) {
    const keys = Object.keys(value).sort()
    const parts: string[] = []
    for (const key of keys) {
      const fieldValue = value[key]
      if (fieldValue === undefined && options.omitUndefinedKeys) continue
      parts.push(`${key}:${canonicalSerializeValue(fieldValue, options)}`)
    }
    return `{${parts.join(',')}}`
  }

  return `opaque:${String(value)}`
}

/**
 * Deterministic serialization for hash inputs — stable key order, explicit nulls, array order preserved.
 */
export function canonicalSerialize(
  value: unknown,
  options: CanonicalSerializeOptions = {},
): string {
  return canonicalSerializeValue(value, options)
}
