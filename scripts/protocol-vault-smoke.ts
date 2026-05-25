import assert from 'node:assert/strict'
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import {
  buildProtocolAliasMapFromRows,
  resolveSafeAlias,
} from '@/lib/protocol-vault/alias-map'
import {
  assertRuntimeObjectHasNoRawVaultFields,
  assertStudySafeDisplaySanitized,
  stripRawVaultFieldsForRuntime,
} from '@/lib/protocol-vault/runtime-boundary'
import {
  fetchRawDocumentForVault,
  registerRawDocument,
  readRawDocumentVaultFields,
  toRawDocumentRegistrySummary,
} from '@/lib/protocol-vault/raw-documents'
import {
  buildOperationalStudyDisplayFromParts,
  buildSanitizedStudyDisplayFromParts,
} from '@/lib/protocol-vault/study-display'
import { resolveDisplayModeForContext } from '@/lib/protocol-vault/display-policy'
import type { ProtocolRawDocumentRecord, StudyAliasMapRow } from '@/lib/protocol-vault/types'
import { createProtocolVaultReadScope } from '@/lib/protocol-vault/vault-scope'
import {
  DEFAULT_PROTOCOL_ALIAS_MAP,
  FORBIDDEN_PROTOCOL_TOKENS,
} from '@/lib/sanitization/forbidden-protocol-tokens'
import { detectForbiddenProtocolTokens } from '@/lib/sanitization/protocol-sanitizer'

const ROOT = process.cwd()
const SCAN_ROOTS = ['app', 'components', 'lib']

function smokeMigrationDefinesVaultTables() {
  const path = join(ROOT, 'supabase', 'migrations', '0092_phase3_protocol_raw_vault.sql')
  assert.equal(existsSync(path), true)
  const sql = readFileSync(path, 'utf8')
  assert.match(sql, /protocol_raw_documents/)
  assert.match(sql, /study_alias_maps/)
  assert.match(sql, /original_filename/)
  assert.match(sql, /safe_alias/)
}

function smokeAliasMapResolvesKnownTokens() {
  const rawToken = FORBIDDEN_PROTOCOL_TOKENS[0]
  const rows: StudyAliasMapRow[] = [
    {
      id: '00000000-0000-4000-8000-000000000001',
      study_id: '00000000-0000-4000-8000-000000000099',
      raw_token: rawToken,
      token_type: 'sponsor',
      safe_alias: 'Sponsor-B',
      source: 'manual',
      confidence: 1,
      approved_by: null,
      approved_at: null,
      created_at: new Date().toISOString(),
    },
  ]

  const alias = resolveSafeAlias(rawToken, 'sponsor', rows)
  assert.equal(alias, 'Sponsor-B')
  assert.equal(detectForbiddenProtocolTokens(alias).length, 0)

  const map = buildProtocolAliasMapFromRows(rows)
  assert.equal(map[rawToken], 'Sponsor-B')
}

function smokeSanitizedDisplayUsesAliasesOnly() {
  const display = buildSanitizedStudyDisplayFromParts({
    studyId: '00000000-0000-4000-8000-000000000099',
    studyName: 'Site Alpha Knee Study',
    studySlug: 'knee-001',
    protocolIdentifier: FORBIDDEN_PROTOCOL_TOKENS[4],
    sponsorRaw: FORBIDDEN_PROTOCOL_TOKENS[3],
    compoundRaw: FORBIDDEN_PROTOCOL_TOKENS[8],
    aliasRows: [],
  })

  assert.equal(display.displayMode, 'sanitized')
  assert.equal(display.protocolLabel, DEFAULT_PROTOCOL_ALIAS_MAP[FORBIDDEN_PROTOCOL_TOKENS[4]])
  assert.equal(display.sponsorLabel, DEFAULT_PROTOCOL_ALIAS_MAP[FORBIDDEN_PROTOCOL_TOKENS[3]])
  assert.equal(display.compoundLabel, DEFAULT_PROTOCOL_ALIAS_MAP[FORBIDDEN_PROTOCOL_TOKENS[8]])
  assert.equal(detectForbiddenProtocolTokens(display).length, 0)
  assertStudySafeDisplaySanitized(
    {
      internalStudyId: display.internalStudyId,
      protocolAlias: display.protocolLabel,
      sponsorAlias: display.sponsorLabel,
      compoundAlias: display.compoundLabel,
      coordinatorDisplayName: display.coordinatorDisplayName,
    },
    'smoke sanitized display',
  )
}

function smokeOperationalDisplayShowsRealIdentifiers() {
  const protocol = FORBIDDEN_PROTOCOL_TOKENS[4]
  const sponsor = FORBIDDEN_PROTOCOL_TOKENS[3]
  const display = buildOperationalStudyDisplayFromParts({
    studyId: '00000000-0000-4000-8000-000000000099',
    studyName: 'PARA Knee OA Trial',
    studySlug: 'knee-001',
    protocolIdentifier: protocol,
    sponsorRaw: sponsor,
    compoundRaw: FORBIDDEN_PROTOCOL_TOKENS[8],
    aliasRows: [],
  })

  assert.equal(display.displayMode, 'operational')
  assert.equal(display.protocolLabel, protocol)
  assert.equal(display.sponsorLabel, sponsor)
  assert.equal(display.studyTitle, 'PARA Knee OA Trial')
  assert.match(display.coordinatorDisplayName, new RegExp(protocol))
}

function smokeDisplayPolicyDefaults() {
  assert.equal(resolveDisplayModeForContext('coordinator_dashboard'), 'operational')
  assert.equal(resolveDisplayModeForContext('pi_dashboard'), 'operational')
  assert.equal(resolveDisplayModeForContext('ai_context'), 'sanitized')
  assert.equal(resolveDisplayModeForContext('logs'), 'sanitized')
  assert.equal(resolveDisplayModeForContext('exports'), 'sanitized')
}

function smokeForbiddenTokenCannotLeakFromVaultIntoRuntime() {
  const vaultRecord: ProtocolRawDocumentRecord = {
    id: '00000000-0000-4000-8000-000000000010',
    organization_id: '00000000-0000-4000-8000-000000000020',
    study_id: '00000000-0000-4000-8000-000000000099',
    original_filename: `${FORBIDDEN_PROTOCOL_TOKENS[4]}-protocol.pdf`,
    storage_path: `vault/${FORBIDDEN_PROTOCOL_TOKENS[4]}/protocol.pdf`,
    checksum: 'abc123',
    mime_type: 'application/pdf',
    status: 'registered',
    created_by: null,
    created_at: new Date().toISOString(),
  }

  const scope = createProtocolVaultReadScope()
  const vaultFields = readRawDocumentVaultFields(scope, vaultRecord)
  assert.ok(vaultFields.original_filename.includes(FORBIDDEN_PROTOCOL_TOKENS[4]))

  const summary = toRawDocumentRegistrySummary(vaultRecord)
  assertRuntimeObjectHasNoRawVaultFields(summary, 'registry summary')
  assert.equal('original_filename' in summary, false)
  assert.equal('storage_path' in summary, false)

  assert.throws(
    () => assertRuntimeObjectHasNoRawVaultFields({ original_filename: vaultRecord.original_filename }),
    /raw vault field "original_filename"/,
  )

  const stripped = stripRawVaultFieldsForRuntime({
    original_filename: vaultRecord.original_filename,
    storage_path: vaultRecord.storage_path,
    studyName: vaultRecord.original_filename,
  })
  assertRuntimeObjectHasNoRawVaultFields(stripped, 'stripped runtime object')
  assert.throws(
    () =>
      assertStudySafeDisplaySanitized({
        internalStudyId: vaultRecord.study_id!,
        protocolAlias: FORBIDDEN_PROTOCOL_TOKENS[4],
        sponsorAlias: 'Sponsor-A',
        compoundAlias: 'Compound-X',
        coordinatorDisplayName: vaultRecord.original_filename,
      }),
    /unsafe protocol identifier/,
  )
}

async function smokeRegisterRawDocumentReturnsSafeSummary() {
  const inserted = {
    id: '00000000-0000-4000-8000-000000000010',
    organization_id: '00000000-0000-4000-8000-000000000020',
    study_id: null,
    checksum: 'deadbeef',
    mime_type: 'application/pdf',
    status: 'registered',
    created_at: new Date().toISOString(),
  }

  const supabase = {
    from() {
      return {
        insert() {
          return {
            select() {
              return {
                async single() {
                  return { data: inserted, error: null }
                },
              }
            },
          }
        },
      }
    },
  }

  const summary = await registerRawDocument(supabase as never, {
    organizationId: inserted.organization_id,
    originalFilename: `${FORBIDDEN_PROTOCOL_TOKENS[0]}.pdf`,
    storagePath: `vault/${FORBIDDEN_PROTOCOL_TOKENS[0]}.pdf`,
    checksum: inserted.checksum,
    mimeType: inserted.mime_type,
  })

  assert.equal(summary.id, inserted.id)
  assert.equal(detectForbiddenProtocolTokens(summary).length, 0)
  assertRuntimeObjectHasNoRawVaultFields(summary, 'register summary')
}

function smokeVaultReadRequiresScope() {
  assert.throws(
    () =>
      readRawDocumentVaultFields(
        { __vaultReadScope: Symbol('invalid') } as import('@/lib/protocol-vault/vault-scope').ProtocolVaultReadScope,
        {} as ProtocolRawDocumentRecord,
      ),
    /Raw vault read rejected/,
  )
}

function walkTsFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    const stat = statSync(full)
    if (stat.isDirectory()) {
      if (entry === 'node_modules' || entry === '.next') continue
      walkTsFiles(full, out)
    } else if (/\.(ts|tsx)$/.test(entry)) {
      out.push(full)
    }
  }
  return out
}

function smokeRawDocumentReadScopedToVaultModules() {
  const allowedPrefixes = [
    join(ROOT, 'lib', 'protocol-vault'),
    join(ROOT, 'lib', 'protocol-intake'),
    join(ROOT, 'scripts'),
  ]

  const offenders: string[] = []
  for (const root of SCAN_ROOTS) {
    const absRoot = join(ROOT, root)
    if (!existsSync(absRoot)) continue
    for (const file of walkTsFiles(absRoot)) {
      const content = readFileSync(file, 'utf8')
      if (!content.includes('fetchRawDocumentForVault')) continue
      const allowed = allowedPrefixes.some((prefix) => file.startsWith(prefix))
      if (!allowed) offenders.push(file)
    }
  }

  assert.deepEqual(
    offenders,
    [],
    `fetchRawDocumentForVault imported outside vault/intake/scripts: ${offenders.join(', ')}`,
  )

  assert.doesNotThrow(() => {
    const scope = createProtocolVaultReadScope()
    void fetchRawDocumentForVault
    void scope
  })
}

async function main() {
  smokeMigrationDefinesVaultTables()
  smokeAliasMapResolvesKnownTokens()
  smokeSanitizedDisplayUsesAliasesOnly()
  smokeOperationalDisplayShowsRealIdentifiers()
  smokeDisplayPolicyDefaults()
  smokeForbiddenTokenCannotLeakFromVaultIntoRuntime()
  await smokeRegisterRawDocumentReturnsSafeSummary()
  smokeVaultReadRequiresScope()
  smokeRawDocumentReadScopedToVaultModules()
  console.log('Protocol vault smoke: PASS')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
