import assert from 'node:assert/strict'
import {
  DEFAULT_PROTOCOL_ALIAS_MAP,
  EXPORT_BLOCKED_UNSAFE_PROTOCOL_IDENTIFIER,
  FORBIDDEN_PROTOCOL_TOKENS,
  PUBLISH_BLOCKED_UNSAFE_PROTOCOL_IDENTIFIER,
} from '@/lib/sanitization/forbidden-protocol-tokens'
import {
  assertNoForbiddenProtocolTokens,
  detectForbiddenProtocolTokens,
  sanitizeObjectDeep,
  sanitizeProtocolText,
} from '@/lib/sanitization/protocol-sanitizer'

function tokenByAlias(alias: string) {
  const entry = Object.entries(DEFAULT_PROTOCOL_ALIAS_MAP).find(([, value]) => value === alias)
  assert.ok(entry)
  return entry[0]
}

function smokeSanitizerReplacesKnownTokens() {
  const unsafe = [
    tokenByAlias('STUDY-KOA-001'),
    tokenByAlias('STUDY-INF-001'),
    tokenByAlias('Sponsor-A'),
    tokenByAlias('Sponsor-B'),
    tokenByAlias('Compound-X'),
    tokenByAlias('Compound-Y'),
  ].join(' | ')

  const sanitized = sanitizeProtocolText(unsafe)
  assert.equal(detectForbiddenProtocolTokens(sanitized).length, 0)
  assert.match(sanitized, /STUDY-KOA-001/)
  assert.match(sanitized, /STUDY-INF-001/)
  assert.match(sanitized, /Sponsor-A/)
  assert.match(sanitized, /Sponsor-B/)
  assert.match(sanitized, /Compound-X/)
  assert.match(sanitized, /Compound-Y/)
}

function smokePublishBlockerBlocksUnsafePayload() {
  const unsafePayload = { protocol: tokenByAlias('STUDY-KOA-001') }
  assert.throws(
    () => assertNoForbiddenProtocolTokens(unsafePayload, 'smoke publish payload'),
    (error) => error instanceof Error && error.message === PUBLISH_BLOCKED_UNSAFE_PROTOCOL_IDENTIFIER,
  )
}

function smokeExportBlockerBlocksUnsafeContent() {
  const unsafeContent = `Export content: ${tokenByAlias('Compound-Y')}`
  const hits = detectForbiddenProtocolTokens(unsafeContent)
  assert.ok(hits.length > 0)
  const blocked = hits.length > 0 ? EXPORT_BLOCKED_UNSAFE_PROTOCOL_IDENTIFIER : null
  assert.equal(blocked, EXPORT_BLOCKED_UNSAFE_PROTOCOL_IDENTIFIER)
}

function smokeSanitizedPayloadPasses() {
  const unsafePayload = {
    study: tokenByAlias('STUDY-KOA-001'),
    sponsor: tokenByAlias('Sponsor-A'),
    nested: [{ compound: tokenByAlias('Compound-X') }],
  }

  const sanitized = sanitizeObjectDeep(unsafePayload)
  assert.equal(detectForbiddenProtocolTokens(sanitized).length, 0)
  assert.doesNotThrow(() => assertNoForbiddenProtocolTokens(sanitized, 'smoke sanitized payload'))
}

function main() {
  assert.ok(FORBIDDEN_PROTOCOL_TOKENS.length >= 9)
  smokeSanitizerReplacesKnownTokens()
  smokePublishBlockerBlocksUnsafePayload()
  smokeExportBlockerBlocksUnsafeContent()
  smokeSanitizedPayloadPasses()
  console.log('Protocol safety smoke: PASS')
}

main()
