/**
 * Phase 4C.13 — Dry-run validator for publish_source_package artifacts (no DB by default).
 *
 * Reads golden-basic publish handoff files and validates shape/hash alignment before RPC.
 *
 * Usage:
 *   node scripts/dry-run-publish-source-package.mjs
 *   node scripts/dry-run-publish-source-package.mjs --call-rpc \
 *     --organization-id <uuid> --study-id <uuid> --study-version-id <uuid> --actor-user-id <uuid>
 *
 * --call-rpc requires DATABASE_URL_DIRECT or DATABASE_URL (see scripts/apply-migrations.mjs).
 * RPC uses auth.uid(); direct Postgres sets request.jwt.claim.sub from --actor-user-id for staging QA only.
 */
import { readFileSync, existsSync } from 'node:fs'
import { resolve, join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import postgres from 'postgres'
import { loadEnvFiles, projectRoot } from './lib/env.mjs'

const ROOT = projectRoot

const DEFAULT_PACKAGE = join(ROOT, 'tmp/publish/source-publish-package.golden-basic.json')
const DEFAULT_SOURCE_DEFINITIONS = join(ROOT, 'tmp/compiled/source-definitions.golden-basic.json')
const DEFAULT_APPROVAL = join(ROOT, 'tmp/approvals/source-preview-approval.golden-basic.json')

const COUNT_KEYS = [
  'source_definition_versions',
  'source_sections',
  'source_fields',
  'validation_rules',
  'conditional_rules',
  'workflow_requirements',
  'signature_requirements',
  'runtime_expectations',
  'external_source_requirements',
]

const SOURCE_ARRAY_KEYS = [
  'source_definition_versions',
  'source_sections',
  'source_fields',
  'validation_rules',
  'conditional_rules',
  'workflow_requirements',
  'signature_requirements',
  'external_source_requirements',
  'runtime_expectations',
]

const HASH_RE = /^sha256:[0-9a-f]{64}$/i

function parseArgs(argv) {
  const args = {
    packagePath: DEFAULT_PACKAGE,
    sourceDefinitionsPath: DEFAULT_SOURCE_DEFINITIONS,
    approvalPath: DEFAULT_APPROVAL,
    callRpc: false,
    organizationId: null,
    studyId: null,
    studyVersionId: null,
    actorUserId: null,
  }

  for (let i = 2; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--call-rpc') args.callRpc = true
    else if (a === '--package') args.packagePath = resolve(argv[++i])
    else if (a === '--source-definitions') args.sourceDefinitionsPath = resolve(argv[++i])
    else if (a === '--approval') args.approvalPath = resolve(argv[++i])
    else if (a === '--organization-id') args.organizationId = argv[++i]
    else if (a === '--study-id') args.studyId = argv[++i]
    else if (a === '--study-version-id') args.studyVersionId = argv[++i]
    else if (a === '--actor-user-id') args.actorUserId = argv[++i]
    else if (a === '--help' || a === '-h') {
      console.log(`Usage: node scripts/dry-run-publish-source-package.mjs [options]

Options:
  --package <path>
  --source-definitions <path>
  --approval <path>
  --call-rpc
  --organization-id <uuid>
  --study-id <uuid>
  --study-version-id <uuid>
  --actor-user-id <uuid>   (required with --call-rpc for auth.uid() simulation)
`)
      process.exit(0)
    } else {
      console.error('Unknown argument:', a)
      process.exit(1)
    }
  }

  return args
}

function loadJson(path, label) {
  if (!existsSync(path)) {
    throw new Error(`Missing ${label}: ${path}`)
  }
  return JSON.parse(readFileSync(path, 'utf8'))
}

function isUuid(value) {
  return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
}

function check(name, pass, detail) {
  return { name, pass, detail }
}

function assertHash(label, value, results) {
  if (!value || typeof value !== 'string') {
    results.push(check(label, false, 'missing'))
    return
  }
  results.push(check(label, HASH_RE.test(value), value))
}

function arrayLen(obj, key) {
  const v = obj?.[key]
  return Array.isArray(v) ? v.length : 0
}

function validateArtifacts(pkg, defs, approval) {
  const results = []

  results.push(check('package_id', Boolean(pkg?.package_id?.trim()), pkg?.package_id ?? 'missing'))
  results.push(check('publish_ready', pkg?.publish_ready === true, String(pkg?.publish_ready)))
  results.push(check('approval_id', Boolean(pkg?.approval_id?.trim()), pkg?.approval_id ?? 'missing'))
  results.push(check('graph_id', Boolean(pkg?.graph_id?.trim()), pkg?.graph_id ?? 'missing'))
  results.push(check('compiler_output_id', Boolean(pkg?.compiler_output_id?.trim()), pkg?.compiler_output_id ?? 'missing'))

  assertHash('package.source_definitions_hash', pkg?.source_definitions_hash, results)
  assertHash('package.preview_hash', pkg?.preview_hash, results)
  assertHash('package.approval_hash', pkg?.approval_hash, results)
  assertHash('package.input_hash', pkg?.input_hash, results)

  results.push(check('approval.decision', approval?.decision === 'approved', String(approval?.decision)))
  results.push(check('approval.publish_eligible', approval?.publish_eligible === true, String(approval?.publish_eligible)))
  results.push(
    check(
      'approval_id_match',
      pkg?.approval_id === approval?.approval_id,
      `package=${pkg?.approval_id} approval=${approval?.approval_id}`,
    ),
  )

  results.push(
    check(
      'source_definitions_hash_match',
      pkg?.source_definitions_hash === approval?.source_definitions_hash,
      `${pkg?.source_definitions_hash} vs ${approval?.source_definitions_hash}`,
    ),
  )

  if (defs?.source_definitions_hash) {
    results.push(
      check(
        'defs_embedded_hash',
        pkg?.source_definitions_hash === defs.source_definitions_hash,
        `${pkg?.source_definitions_hash} vs ${defs.source_definitions_hash}`,
      ),
    )
  }

  results.push(
    check(
      'preview_hash_match',
      pkg?.preview_hash === approval?.preview_hash,
      `${pkg?.preview_hash} vs ${approval?.preview_hash}`,
    ),
  )

  results.push(
    check(
      'graph_alignment',
      pkg?.graph_id === defs?.graph_id &&
        pkg?.input_hash === defs?.input_hash &&
        pkg?.compiler_output_id === defs?.compiler_output_id,
      'package graph metadata must match source-definitions',
    ),
  )

  if (approval?.graph_id) {
    results.push(check('approval_graph_id', pkg?.graph_id === approval.graph_id, `${pkg?.graph_id} vs ${approval.graph_id}`))
  }

  const pkgErrors = pkg?.validation_snapshot?.errors ?? []
  const defErrors = defs?.validation_report?.errors ?? []
  results.push(check('package.validation_snapshot.errors', Array.isArray(pkgErrors) && pkgErrors.length === 0, `count=${pkgErrors?.length ?? 'n/a'}`))
  results.push(check('defs.validation_report.errors', Array.isArray(defErrors) && defErrors.length === 0, `count=${defErrors?.length ?? 'n/a'}`))
  results.push(check('defs.validation_report.passed', defs?.validation_report?.passed === true, String(defs?.validation_report?.passed)))

  const status = defs?.validation_report?.validation_status ?? pkg?.validation_snapshot?.validation_status
  results.push(check('validation_status', status === 'valid' || status === 'warning', String(status)))

  for (const key of COUNT_KEYS) {
    const expected = pkg?.counts?.[key]
    const actual = arrayLen(defs, key)
    if (expected == null) {
      results.push(check(`counts.${key}`, false, 'missing in package.counts'))
    } else {
      results.push(check(`counts.${key}`, Number(expected) === actual, `expected=${expected} actual=${actual}`))
    }
  }

  for (const key of SOURCE_ARRAY_KEYS) {
    results.push(check(`defs.${key}`, Array.isArray(defs?.[key]), `len=${arrayLen(defs, key)}`))
  }

  return results
}

function pickDatabaseUrl() {
  loadEnvFiles()
  const direct = process.env.DATABASE_URL_DIRECT?.trim()
  const pooled = process.env.DATABASE_URL?.trim()
  return direct || pooled || null
}

async function callRpc(args, pkg, defs, approval) {
  const url = pickDatabaseUrl()
  if (!url) {
    console.log('\n--call-rpc skipped: set DATABASE_URL_DIRECT or DATABASE_URL in .env.local')
    return { skipped: true }
  }

  for (const [label, value] of [
    ['organization-id', args.organizationId],
    ['study-id', args.studyId],
    ['study-version-id', args.studyVersionId],
    ['actor-user-id', args.actorUserId],
  ]) {
    if (!isUuid(value)) {
      throw new Error(`--call-rpc requires --${label} <uuid>`)
    }
  }

  const sql = postgres(url, {
    prepare: url.includes('pooler.supabase.com') ? false : undefined,
    max: 1,
  })

  try {
    await sql`select set_config('role', 'authenticated', true)`
    await sql`select set_config('request.jwt.claim.sub', ${args.actorUserId}, true)`

    const rows = await sql`
      select public.publish_source_package(
        ${args.organizationId}::uuid,
        ${args.studyId}::uuid,
        ${args.studyVersionId}::uuid,
        ${sql.json(pkg)}::jsonb,
        ${sql.json(defs)}::jsonb,
        ${sql.json(approval)}::jsonb
      ) as result
    `

    return { skipped: false, result: rows[0]?.result }
  } finally {
    await sql.end({ timeout: 5 })
  }
}

async function main() {
  const args = parseArgs(process.argv)
  const pkg = loadJson(args.packagePath, 'publish package')
  const defs = loadJson(args.sourceDefinitionsPath, 'source definitions')
  const approval = loadJson(args.approvalPath, 'approval')

  const results = validateArtifacts(pkg, defs, approval)
  const failed = results.filter((r) => !r.pass)

  console.log('Phase 4C.13 dry-run — publish_source_package artifacts')
  console.log('  package:', args.packagePath)
  console.log('  source_definitions:', args.sourceDefinitionsPath)
  console.log('  approval:', args.approvalPath)
  console.log('')

  for (const r of results) {
    console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.name}${r.detail ? ` — ${r.detail}` : ''}`)
  }

  console.log('')
  console.log(`Summary: ${results.length - failed.length}/${results.length} checks passed`)

  if (failed.length) {
    process.exit(1)
  }

  if (args.callRpc) {
    const rpc = await callRpc(args, pkg, defs, approval)
    if (!rpc.skipped) {
      console.log('\nRPC result:')
      console.log(JSON.stringify(rpc.result, null, 2))
    }
  } else {
    console.log('\nDB: not connected (default). Use --call-rpc with tenant UUIDs + DATABASE_URL_* for staging RPC test.')
  }
}

main().catch((err) => {
  console.error(err.message || err)
  process.exit(1)
})
