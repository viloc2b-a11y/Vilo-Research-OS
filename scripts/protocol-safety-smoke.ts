import assert from 'node:assert/strict'
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
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
  assertRuntimePayloadSanitized,
} from '@/lib/sanitization/protocol-sanitizer'
import { safeLogger } from '@/lib/sanitization/safe-logger'

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

function smokeLoggerStripsForbiddenTokens() {
  const originalInfo = console.info
  const captured: unknown[][] = []
  console.info = (...args: unknown[]) => {
    captured.push(args)
  }

  try {
    safeLogger.info('logger payload', {
      sponsor: tokenByAlias('Sponsor-B'),
      nested: { compound: tokenByAlias('Compound-Y') },
    })
  } finally {
    console.info = originalInfo
  }

  assert.equal(captured.length, 1)
  assert.equal(detectForbiddenProtocolTokens(captured).length, 0)
  assert.match(JSON.stringify(captured), /Sponsor-B/)
  assert.match(JSON.stringify(captured), /Compound-Y/)
}

function smokeMigrationSanitizesRows() {
  const migrationPath = join(process.cwd(), 'supabase', 'migrations', '0091_protocol_identifier_runtime_sanitization.sql')
  assert.equal(existsSync(migrationPath), true)
  const sql = readFileSync(migrationPath, 'utf8')
  assert.match(sql, /protocol_sanitize_runtime_text/)
  assert.match(sql, /protocol_sanitize_runtime_jsonb/)
  assert.match(sql, /source_responses/)
  assert.match(sql, /protocol_graph_publications/)
  assert.match(sql, /operational_events/)
  assert.equal(detectForbiddenProtocolTokens(sql).length, 0)
}

function smokeCiFailsOnUnsafeToken() {
  const workflowPath = join(process.cwd(), '.github', 'workflows', 'protocol-safety.yml')
  assert.equal(existsSync(workflowPath), true)
  assert.match(readFileSync(workflowPath, 'utf8'), /npm run scan:protocol-safety/)

  const tmpDir = join(process.cwd(), 'tmp')
  const tmpPath = join(tmpDir, 'protocol-safety-smoke-unsafe.txt')
  mkdirSync(tmpDir, { recursive: true })
  writeFileSync(tmpPath, tokenByAlias('STUDY-INF-001'), 'utf8')

  try {
    const result = process.platform === 'win32'
      ? spawnSync('cmd.exe', ['/d', '/s', '/c', 'npm run scan:protocol-safety'], {
          cwd: process.cwd(),
          encoding: 'utf8',
        })
      : spawnSync('npm', ['run', 'scan:protocol-safety'], {
          cwd: process.cwd(),
          encoding: 'utf8',
        })
    assert.notEqual(result.status, 0)
    assert.match(`${result.stdout ?? ''}\n${result.stderr ?? ''}`, /Forbidden protocol identifiers found/)
  } finally {
    rmSync(tmpPath, { force: true })
  }
}

function smokeRuntimeRejectsUnsafePayloads() {
  assert.throws(
    () => assertRuntimePayloadSanitized({ responses: [{ value_text: tokenByAlias('Sponsor-A') }] }),
    /Runtime rejected: unsafe protocol identifier detected\./,
  )
}

function main() {
  assert.ok(FORBIDDEN_PROTOCOL_TOKENS.length >= 9)
  smokeSanitizerReplacesKnownTokens()
  smokePublishBlockerBlocksUnsafePayload()
  smokeExportBlockerBlocksUnsafeContent()
  smokeSanitizedPayloadPasses()
  smokeLoggerStripsForbiddenTokens()
  smokeMigrationSanitizesRows()
  smokeCiFailsOnUnsafeToken()
  smokeRuntimeRejectsUnsafePayloads()
  console.log('Protocol safety smoke: PASS')
}

main()
