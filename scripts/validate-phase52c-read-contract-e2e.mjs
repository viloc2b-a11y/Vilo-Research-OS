/**
 * Phase 5.2C — Read contract E2E validation (canonical read APIs → view-models).
 *
 * Planning (default): unit validation of normalizers, determinism, errors, render safety.
 * Live: HTTP GET on four read routes + same validations on live payloads.
 *
 *   npm run db:validate-phase52c-read-contract-e2e
 *   npm run db:validate-phase52c-read-contract-e2e:live -- --organization-id ... --response-set-id ...
 *
 * Report: tmp/runtime-e2e/phase52c-read-contract-e2e-report.json
 */

import { mkdirSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadEnvFiles, requireEnv } from './lib/env.mjs'
import { apiFetch, isUuid, signInForCookieHeader, SYNTHETIC, stepRecord } from './lib/source-api-e2e.mjs'
import { loadReadContract } from './lib/read-contract-import.mjs'
import {
  readRoutePath,
  runUnitValidations,
  validateLivePayloads,
} from './lib/read-contract-e2e.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const REPORT_DIR = join(ROOT, 'tmp/runtime-e2e')
const REPORT_PATH = join(REPORT_DIR, 'phase52c-read-contract-e2e-report.json')

const LIVE_STEPS = [
  { id: 'live_read_detail', title: 'GET /api/source/response-set/[id]' },
  { id: 'live_read_manifest', title: 'GET /api/source/response-set/[id]/manifest' },
  { id: 'live_read_history', title: 'GET /api/source/response-set/[id]/history' },
  { id: 'live_read_findings', title: 'GET /api/source/response-set/[id]/findings' },
  { id: 'live_contract_validation', title: 'Live payload → view-model contract validation' },
  { id: 'live_forbidden_envelope', title: 'Cross-tenant read → ReadPanelError' },
]

function parseArgs(argv) {
  const args = {
    live: false,
    baseUrl: process.env.E2E_API_BASE_URL?.trim() || 'http://localhost:3000',
    organizationId: null,
    responseSetId: null,
    orgBId: null,
  }

  for (let i = 2; i < argv.length; i++) {
    const a = argv[i]
    const next = () => argv[++i]
    if (a === '--live') args.live = true
    else if (a === '--base-url') args.baseUrl = next()
    else if (a === '--organization-id') args.organizationId = next()
    else if (a === '--response-set-id') args.responseSetId = next()
    else if (a === '--org-b-id') args.orgBId = next()
    else if (a === '--help' || a === '-h') {
      printHelp()
      process.exit(0)
    } else {
      console.error('Unknown argument:', a)
      printHelp()
      process.exit(1)
    }
  }
  return args
}

function printHelp() {
  console.log(`Phase 5.2C Read contract E2E

Options:
  --live                      HTTP GET on read routes (requires npm run dev)
  --base-url <url>            Default: E2E_API_BASE_URL or http://localhost:3000
  --organization-id <uuid>    Tenant scope for read APIs
  --response-set-id <uuid>    Submitted response set (required for --live)
  --org-b-id <uuid>           Optional cross-tenant user B org for forbidden probe

Planning mode runs unit validations only (no HTTP).
Live mode requires --organization-id and --response-set-id.

Example:
  npm run db:validate-phase52c-read-contract-e2e:live -- \\
    --organization-id <org> --response-set-id <set>
`)
}

function validateLiveArgs(args) {
  const issues = []
  if (!args.organizationId) issues.push('missing --organization-id')
  else if (!isUuid(args.organizationId)) issues.push('--organization-id must be UUID')
  if (!args.responseSetId) issues.push('missing --response-set-id')
  else if (!isUuid(args.responseSetId)) issues.push('--response-set-id must be UUID')
  return issues
}

function runUnitSuite(report) {
  const rc = loadReadContract()
  const unitResults = runUnitValidations(rc)

  const idMap = {
    normalizer_detail: 'unit_normalizer_detail',
    normalizer_manifest: 'unit_normalizer_manifest',
    normalizer_history: 'unit_normalizer_history',
    normalizer_findings: 'unit_normalizer_findings',
    determinism_detail: 'unit_determinism_detail',
    determinism_history: 'unit_determinism_history',
    bundle_shape: 'unit_bundle_shape',
    error_forbidden_panel: 'unit_error_forbidden_panel',
    error_network_panel: 'unit_error_network_panel',
    render_format_safety: 'unit_render_format_safety',
  }

  for (const r of unitResults) {
    const stepId = idMap[r.id] ?? r.id
    report.steps.push(
      stepRecord(stepId, r.ok ? 'pass' : 'fail', {
        detail: r.ok ? 'ok' : r.issues.join('; '),
        errors: r.ok ? null : r.issues,
      }),
    )
    if (r.ok) report.summary.passed++
    else report.summary.failed++
  }

  return unitResults.every((r) => r.ok)
}

async function discoverOrgB(sql) {
  const rows = await sql`
    select id from public.organizations
    where name ilike '%Synthetic Site Beta%'
    limit 1
  `
  return rows[0]?.id ?? null
}

async function liveRun(args, report) {
  const issues = validateLiveArgs(args)
  if (issues.length) {
    for (const s of LIVE_STEPS) {
      report.steps.push(stepRecord(s.id, 'blocked', { detail: issues.join('; ') }))
      report.summary.blocked++
    }
    report.ok = false
    return
  }

  requireEnv(['NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY'])
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  let cookieA
  let cookieB
  try {
    cookieA = (await signInForCookieHeader(url, anon, SYNTHETIC.userA)).cookieHeader
    cookieB = (await signInForCookieHeader(url, anon, SYNTHETIC.userB)).cookieHeader
  } catch (e) {
    report.gaps.push(`auth sign-in failed: ${e.message}`)
    report.ok = false
    return
  }

  const health = await fetch(args.baseUrl, { redirect: 'manual' }).catch(() => null)
  if (!health) {
    report.gaps.push(`Next.js not reachable at ${args.baseUrl} — start npm run dev`)
  }

  const orgId = args.organizationId
  const rsId = args.responseSetId
  const base = args.baseUrl
  const rc = loadReadContract()

  const envelopes = {}

  for (const kind of ['detail', 'manifest', 'history', 'findings']) {
    const stepId = `live_read_${kind}`
    const path = readRoutePath(rsId, kind, orgId)
    const { json, httpStatus } = await apiFetch(base, path, { cookieHeader: cookieA })
    envelopes[kind] = { body: json, httpStatus, path }

    const ok = json?.ok === true && httpStatus === 200
    report.steps.push(
      stepRecord(stepId, ok ? 'pass' : 'fail', {
        detail: ok ? `HTTP ${httpStatus}` : `HTTP ${httpStatus} code=${json?.code}`,
        route: `GET ${path.split('?')[0]}`,
        rpc: json?.meta?.rpc ?? null,
        http_status: httpStatus,
        errors: ok ? null : JSON.stringify(json?.errors ?? []),
      }),
    )
    if (ok) report.summary.passed++
    else report.summary.failed++
  }

  const allOk = Object.values(envelopes).every((e) => e.body?.ok === true)
  if (allOk) {
    const liveResults = validateLivePayloads(rc, envelopes, rsId, orgId)
    const contractOk = liveResults.every((r) => r.ok)
    report.steps.push(
      stepRecord('live_contract_validation', contractOk ? 'pass' : 'fail', {
        detail: contractOk
          ? `${liveResults.length} contract checks passed`
          : liveResults
              .filter((r) => !r.ok)
              .map((r) => `${r.id}: ${r.issues.join(', ')}`)
              .join('; '),
        errors: contractOk ? null : liveResults.filter((r) => !r.ok),
      }),
    )
    if (contractOk) report.summary.passed++
    else report.summary.failed++
  } else {
    report.steps.push(
      stepRecord('live_contract_validation', 'skip', {
        detail: 'skipped — one or more read routes failed',
      }),
    )
    report.summary.skipped++
  }

  let orgB = args.orgBId
  if (!orgB && process.env.DATABASE_URL) {
    const postgres = (await import('postgres')).default
    const sql = postgres(process.env.DATABASE_URL, { max: 1 })
    try {
      orgB = await discoverOrgB(sql)
    } finally {
      await sql.end()
    }
  }

  if (orgB && isUuid(orgB) && orgB !== orgId) {
    const path = readRoutePath(rsId, 'detail', orgId)
    const { json, httpStatus } = await apiFetch(base, path, { cookieHeader: cookieB })
    const panel = rc.errors.normalizeEnvelopeToPanelResult(
      json,
      () => {
        throw new Error('normalize should not run on forbidden')
      },
      'Response set detail',
    )
    const ok =
      (httpStatus === 403 || json?.ok === false) &&
      panel.status === 'error' &&
      (panel.error?.isForbidden || panel.error?.isAuthError)
    report.steps.push(
      stepRecord('live_forbidden_envelope', ok ? 'pass' : 'fail', {
        detail: ok
          ? `HTTP ${httpStatus} → ReadPanelError`
          : `expected forbidden panel, got status=${panel.status} http=${httpStatus}`,
        route: 'GET detail (user B, org A resource)',
        http_status: httpStatus,
      }),
    )
    if (ok) report.summary.passed++
    else report.summary.failed++
  } else {
    report.steps.push(
      stepRecord('live_forbidden_envelope', 'skip', {
        detail: 'org B not available — pass --org-b-id for cross-tenant probe',
      }),
    )
    report.summary.skipped++
  }

  report.ok = report.summary.failed === 0 && report.summary.blocked === 0
}

function finish(report) {
  report.finished_at = new Date().toISOString()
  mkdirSync(REPORT_DIR, { recursive: true })
  writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2))
  const { passed, failed, skipped, blocked, planned } = report.summary
  console.log(
    `Phase 5.2C read contract E2E [${report.mode}]: pass=${passed} fail=${failed} skip=${skipped} blocked=${blocked} planned=${planned}`,
  )
  console.log(`Report: ${REPORT_PATH}`)
  if (report.gaps.length) console.log('Gaps:', report.gaps.join('; '))
  process.exit(report.ok ? 0 : 1)
}

async function main() {
  loadEnvFiles()
  const args = parseArgs(process.argv)

  const report = {
    phase: '5.2C',
    mode: args.live ? 'live' : 'planning',
    base_url: args.baseUrl,
    started_at: new Date().toISOString(),
    ok: true,
    summary: { passed: 0, failed: 0, skipped: 0, blocked: 0, planned: 0 },
    steps: [],
    gaps: [],
  }

  const unitOk = runUnitSuite(report)
  if (!unitOk) report.ok = false

  if (!args.live) {
    for (const s of LIVE_STEPS) {
      report.steps.push(
        stepRecord(s.id, 'planned', {
          detail: 'planning — run with --live --organization-id --response-set-id',
        }),
      )
      report.summary.planned++
    }
    finish(report)
    return
  }

  await liveRun(args, report)
  if (!unitOk) report.ok = false
  finish(report)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
