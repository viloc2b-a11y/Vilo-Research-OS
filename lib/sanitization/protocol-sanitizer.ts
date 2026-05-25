import {
  DEFAULT_PROTOCOL_ALIAS_MAP,
  FORBIDDEN_PROTOCOL_TOKENS,
  PUBLISH_BLOCKED_UNSAFE_PROTOCOL_IDENTIFIER,
  RUNTIME_REJECTED_UNSAFE_PROTOCOL_IDENTIFIER,
  type ForbiddenProtocolToken,
} from '@/lib/sanitization/forbidden-protocol-tokens'

export type ProtocolAliasMap = Partial<Record<ForbiddenProtocolToken | string, string>>

export type ForbiddenProtocolTokenHit = {
  token: ForbiddenProtocolToken
  index: number
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function tokenPattern(token: string): RegExp {
  const escaped = escapeRegExp(token)
  if (/^[A-Za-z0-9]+$/.test(token)) {
    return new RegExp(`(?<![A-Za-z0-9_])${escaped}(?![A-Za-z0-9_])`, 'g')
  }
  return new RegExp(escaped, 'g')
}

const TOKEN_PATTERNS = FORBIDDEN_PROTOCOL_TOKENS.map((token) => ({
  token,
  pattern: tokenPattern(token),
}))

export function sanitizeProtocolText(input: string, aliasMap: ProtocolAliasMap = DEFAULT_PROTOCOL_ALIAS_MAP): string {
  let output = input
  for (const { token, pattern } of TOKEN_PATTERNS) {
    output = output.replace(pattern, aliasMap[token] ?? DEFAULT_PROTOCOL_ALIAS_MAP[token])
  }
  return output
}

export function detectForbiddenProtocolTokens(input: unknown): ForbiddenProtocolTokenHit[] {
  const text = typeof input === 'string' ? input : JSON.stringify(input)
  if (!text) return []

  const hits: ForbiddenProtocolTokenHit[] = []
  for (const { token, pattern } of TOKEN_PATTERNS) {
    pattern.lastIndex = 0
    for (const match of text.matchAll(pattern)) {
      hits.push({ token, index: match.index ?? -1 })
    }
  }
  return hits.sort((a, b) => a.index - b.index || a.token.localeCompare(b.token))
}

export function assertNoForbiddenProtocolTokens(input: unknown, context = 'protocol payload'): void {
  const hits = detectForbiddenProtocolTokens(input)
  if (hits.length === 0) return

  const error = new Error(PUBLISH_BLOCKED_UNSAFE_PROTOCOL_IDENTIFIER)
  error.name = 'UnsafeProtocolIdentifierError'
  Object.assign(error, {
    context,
    tokens: [...new Set(hits.map((hit) => hit.token))],
  })
  throw error
}

export function assertRuntimePayloadSanitized(input: unknown, context = 'runtime payload'): void {
  const hits = detectForbiddenProtocolTokens(input)
  if (hits.length === 0) return

  const error = new Error(RUNTIME_REJECTED_UNSAFE_PROTOCOL_IDENTIFIER)
  error.name = 'UnsafeRuntimeProtocolIdentifierError'
  Object.assign(error, {
    context,
    tokens: [...new Set(hits.map((hit) => hit.token))],
  })
  throw error
}

export function sanitizeProtocolRuntimeObject<T>(object: T, aliasMap: ProtocolAliasMap = DEFAULT_PROTOCOL_ALIAS_MAP): T {
  const sanitized = sanitizeObjectDeep(object, aliasMap)
  assertRuntimePayloadSanitized(sanitized, 'sanitized runtime object')
  return sanitized
}

export function sanitizeObjectDeep<T>(object: T, aliasMap: ProtocolAliasMap = DEFAULT_PROTOCOL_ALIAS_MAP): T {
  if (typeof object === 'string') {
    return sanitizeProtocolText(object, aliasMap) as T
  }

  if (Array.isArray(object)) {
    return object.map((item) => sanitizeObjectDeep(item, aliasMap)) as T
  }

  if (object && typeof object === 'object') {
    const output: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(object)) {
      output[sanitizeProtocolText(key, aliasMap)] = sanitizeObjectDeep(value, aliasMap)
    }
    return output as T
  }

  return object
}
