/**
 * Phase 5.4B — Post-submit addendum shell E2E.
 *
 *   npm run db:validate-phase54b-addendum-shell-e2e
 *   npm run db:validate-phase54b-addendum-shell-e2e:live -- --organization-id ...
 *
 * Report: tmp/runtime-e2e/phase54b-addendum-shell-e2e-report.json
 */

import { mkdirSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadEnvFiles, requireEnv } from './lib/env.mjs'
import {
  apiFetch,
  assertApiEnvelope,
  isUuid,
  responseValueSnapshot,
  signInForCookieHeader,
  SYNTHETIC,
  stepRecord,
  valueForWidget,
} from './lib/source-api-e2e.mjs'
import { prepareCaptureFixture, WRITE_RPC } from './lib/capture-shell-e2e.mjs'
import { loadAddendumModules } from './lib/addendum-shell-import.mjs'
import { assertReadApiEnvelope, readRoutePath, stableFingerprint } from './lib/read-contract-e2e.mjs'
import {
  ADDENDUM_RPC,
  addendumValueForWidget,
  assertPostAddendumReadState,
  countAddendumEligibleFields,
  expectedDisplayForAddendum,
  historyHasAddendumEvent,
  historyHasSubmitEvent,
  isPostSubmitResponseSet,
  manifestAddendaCount,
  pickAddendumEligibleField,
  resolveAllowAddenda,
  runAddendumUnitValidations,
} from './lib/addendum-shell-e2e.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const REPORT_DIR = join(ROOT, 'tmp/runtime-e2e')
const REPORT_PATH = join(REPORT_DIR, 'phase54b-addendum-shell-e2e-report.json')

const LIVE_STEPS = [
  { id: 'fixture_discover', title: 'Discover fresh procedure_execution' },
  { id: 'fixture_submit', title: 'Open, save required-only fields, submit' },
  { id: 'fixture_post_submit_confirm', title: 'Confirm post-submit lane and addendum eligibility' },
  { id: 'auth_unauthenticated_addendum', title: 'Unauthenticated POST /addendum rejected' },
  { id: 'auth_wrong_org_addendum', title: 'Cross-org POST /addendum rejected' },
  { id: 'neg_addendum_wrong_org_id', title: 'Wrong organization_id in body rejected' },
  { id: 'neg_addendum_no_reason', title: 'Addendum without reason rejected' },
  { id: 'neg_addendum_no_field', title: 'Missing source_field_id rejected' },
  { id: 'addendum_baseline_read', title: 'Baseline manifest addenda count' },
  { id: 'addendum_post', title: 'POST /api/source/response-set/addendum' },
  { id: 'addendum_canonical_read', title: 'Canonical read assertions after addendum' },
  { id: 'addendum_submitted_immutable', title: 'Prior submitted response rows unchanged' },
  { id: 'addendum_determinism', title: 'Repeated read bundle stable; GET does not mutate counts' },
  { id: 'addendum_review_route', title: 'Review page route returns 200' },
]

function parseArgs(argv) {
  const args = {
    live: false,
    baseUrl: process.env.E2E_API_BASE_URL?.trim() || 'http://localhost:3000',
    organizationId: null,
    orgBId: null,
    fresh: true,
  }

  for (let i = 2; i < argv.length; i++) {
    const a = argv[i]
    const next = () => argv[++i]
    if (a === '--live') args.live = true
    else if (a === '--fresh') args.fresh = true
    else if (a === '--no-fresh') args.fresh = false
    else if (a === '--base-url') args.baseUrl = next()
    else if (a === '--organization-id') args.organizationId = next()
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
  console.log(`Phase 5.4B Addendum shell E2E

Options:
  --live                         HTTP flow (requires npm run dev)
  --base-url <url>
  --organization-id <uuid>       Required for live
  --org-b-id <uuid>              Cross-tenant probe
  --fresh                        Insert new visit + procedure_execution (default)
  --no-fresh                     Reuse discovered mutable PE when available
`)
}

async function connectPostgres() {
  const postgres = (await import('postgres')).default
  const url = process.env.DATABASE_URL_DIRECT || process.env.DATABASE_URL
  if (!url) return null
  return postgres(url, {
    ssl: 'require',
    max: 1,
    prepare: url.includes('pooler') ? false : undefined,
  })
}

async function discoverOrgB(sql) {
  const rows = await sql`
    select id from public.organizations
    where name ilike '%Synthetic Site Beta%'
    limit 1
  `
  return rows[0]?.id ?? null
}

function runUnitSuite(report) {
  const loaded = loadAddendumModules()
  const results = runAddendumUnitValidations(loaded.capture, loaded)
  for (const r of results) {
    report.steps.push(
      stepRecord(`unit_${r.id}`, r.ok ? 'pass' : 'fail', {
        detail: r.ok ? 'ok' : r.issues.join('; '),
        errors: r.ok ? null : r.issues,
      }),
    )
    if (r.ok) report.summary.passed++
    else report.summary.failed++
  }
  return results.every((r) => r.ok)
}

async function liveRun(args, report, sql, cookieHeader) {
  const base = args.baseUrl
  const orgId = args.organizationId
  const modules = loadAddendumModules().capture

  const fixture = await prepareCaptureFixture(sql, orgId, { fresh: args.fresh })
  if (!fixture?.procedureExecutionId || !fixture.studyVersionId) {
    report.steps.push(
      stepRecord('fixture_discover', 'blocked', {
        detail: 'no mutable procedure_execution — use --fresh or bind SDV',
      }),
    )
    report.summary.blocked++
    report.ok = false
    return
  }

  report.steps.push(
    stepRecord('fixture_discover', 'pass', {
      detail: `pe=${fixture.procedureExecutionId}`,
      key_ids: { procedure_execution_id: fixture.procedureExecutionId },
    }),
  )
  report.summary.passed++

  const addendumText = `e2e-54b-addendum-${Date.now()}`
  const ctx = {
    responseSetId: fixture.existingResponseSetId,
    addendumFieldId: null,
    addendumWidgetHint: 'text',
    addendumReason: 'phase54b addendum shell e2e',
    expectedAddendumDisplay: null,
    baselineAddendaCount: 0,
    eligibleBefore: 0,
    submittedSnapshots: null,
  }

  async function readBundle(responseSetId) {
    const [detailRes, manifestRes, historyRes] = await Promise.all([
      apiFetch(base, readRoutePath(responseSetId, 'detail', orgId), { cookieHeader }),
      apiFetch(base, readRoutePath(responseSetId, 'manifest', orgId), { cookieHeader }),
      apiFetch(base, readRoutePath(responseSetId, 'history', orgId), { cookieHeader }),
    ])
    return {
      detail: { body: detailRes.json, httpStatus: detailRes.httpStatus },
      manifest: { body: manifestRes.json, httpStatus: manifestRes.httpStatus },
      history: { body: historyRes.json, httpStatus: historyRes.httpStatus },
    }
  }

  {
    const { json, httpStatus } = await apiFetch(base, '/api/source/response-set/open', {
      method: 'POST',
      cookieHeader,
      body: {
        organization_id: orgId,
        study_id: fixture.studyId,
        study_version_id: fixture.studyVersionId,
        study_subject_id: fixture.studySubjectId,
        visit_id: fixture.visitId,
        procedure_execution_id: fixture.procedureExecutionId,
        source_definition_version_id: fixture.sourceDefinitionVersionId,
      },
    })
    const env = assertApiEnvelope(json, { expectedRpc: WRITE_RPC.OPEN_RPC, requireOk: true })
    ctx.responseSetId = json?.data?.source_response_set_id ?? ctx.responseSetId
    const ok = env.ok && httpStatus === 200 && isUuid(ctx.responseSetId)
    if (!ok) {
      report.steps.push(
        stepRecord('fixture_submit', 'fail', { detail: env.issues.join('; '), http_status: httpStatus }),
      )
      report.summary.failed++
      report.ok = false
      return
    }
  }

  let envelopes = await readBundle(ctx.responseSetId)
  const detailData = envelopes.detail.body.data

  const requiredOnlyPayload = (detailData.fields ?? [])
    .filter((f) => f.is_required)
    .map((f) => ({
      source_field_id: f.source_field_id,
      ...valueForWidget(f.widget_hint ?? 'text'),
    }))

  if (requiredOnlyPayload.length === 0) {
    report.steps.push(
      stepRecord('fixture_submit', 'blocked', {
        detail: 'no required fields in SDV — cannot leave optional field empty for addendum',
      }),
    )
    report.summary.blocked++
    report.ok = false
    return
  }

  {
    const { json, httpStatus } = await apiFetch(base, '/api/source/response-set/save-draft', {
      method: 'POST',
      cookieHeader,
      body: {
        organization_id: orgId,
        source_response_set_id: ctx.responseSetId,
        responses: requiredOnlyPayload,
      },
    })
    const env = assertApiEnvelope(json, { expectedRpc: WRITE_RPC.SAVE_RPC, requireOk: true })
    if (!env.ok || httpStatus !== 200) {
      report.steps.push(
        stepRecord('fixture_submit', 'fail', { detail: 'save-draft failed', http_status: httpStatus }),
      )
      report.summary.failed++
      report.ok = false
      return
    }
  }

  envelopes = await readBundle(ctx.responseSetId)
  const addendumField = pickAddendumEligibleField(envelopes.detail.body.data)
  if (!addendumField) {
    report.steps.push(
      stepRecord('fixture_submit', 'blocked', {
        detail: 'no field without current_effective after required-only save',
      }),
    )
    report.summary.blocked++
    report.ok = false
    return
  }

  ctx.addendumFieldId = addendumField.source_field_id
  ctx.addendumWidgetHint = addendumField.widget_hint ?? 'text'
  ctx.expectedAddendumDisplay = expectedDisplayForAddendum(ctx.addendumWidgetHint, addendumText)

  {
    const { json, httpStatus } = await apiFetch(base, '/api/source/response-set/submit', {
      method: 'POST',
      cookieHeader,
      body: {
        organization_id: orgId,
        source_response_set_id: ctx.responseSetId,
        submit_reason: 'phase54b addendum shell e2e',
      },
    })
    const env = assertApiEnvelope(json, { expectedRpc: WRITE_RPC.SUBMIT_RPC, requireOk: true })
    const ok = env.ok && httpStatus === 200
    report.steps.push(
      stepRecord('fixture_submit', ok ? 'pass' : 'fail', {
        detail: ok
          ? `submitted; addendumField=${addendumField.field_key}; requiredSaved=${requiredOnlyPayload.length}`
          : env.issues.join('; '),
        key_ids: { response_set_id: ctx.responseSetId, addendum_field_id: ctx.addendumFieldId },
      }),
    )
    ok ? report.summary.passed++ : report.summary.failed++
    if (!ok) {
      report.ok = false
      return
    }
  }

  envelopes = await readBundle(ctx.responseSetId)

  const submittedRows = await sql`
    select id, value_text, value_number, value_boolean, value_date, value_datetime, is_submitted
    from public.source_responses
    where response_set_id = ${ctx.responseSetId}::uuid and is_submitted = true
  `
  ctx.submittedSnapshots = new Map(
    submittedRows.map((r) => [r.id, responseValueSnapshot(r)]),
  )

  {
    const manifestPanel = modules.normalizeEnvelopeToPanelResult(
      envelopes.manifest.body,
      modules.normalizeManifest,
      'Manifest',
    )
    const detailPanel = modules.normalizeEnvelopeToPanelResult(
      envelopes.detail.body,
      modules.normalizeResponseSetDetail,
      'Detail',
    )
    const allow = resolveAllowAddenda(manifestPanel)
    ctx.eligibleBefore = countAddendumEligibleFields(detailPanel, allow)
    const postSubmit = isPostSubmitResponseSet(
      envelopes.detail.body.data,
      envelopes.manifest.body,
    )
    const ok =
      allow &&
      postSubmit &&
      ctx.eligibleBefore >= 1 &&
      historyHasSubmitEvent(envelopes.history.body?.data) &&
      submittedRows.length > 0
    report.steps.push(
      stepRecord('fixture_post_submit_confirm', ok ? 'pass' : 'fail', {
        detail: ok
          ? `post-submit; addendumEligible=${ctx.eligibleBefore}; submittedRows=${submittedRows.length}`
          : `allow=${allow} eligible=${ctx.eligibleBefore} postSubmit=${postSubmit}`,
        actual: { status: envelopes.detail.body?.data?.response_set?.status },
      }),
    )
    ok ? report.summary.passed++ : report.summary.failed++
    if (!ok) {
      report.ok = false
      return
    }
  }

  const addendumPayload = addendumValueForWidget(ctx.addendumWidgetHint, addendumText)

  {
    const { json, httpStatus } = await apiFetch(base, '/api/source/response-set/addendum', {
      method: 'POST',
      body: {
        organization_id: orgId,
        source_response_set_id: ctx.responseSetId,
        source_field_id: ctx.addendumFieldId,
        ...addendumPayload,
        reason: 'no auth',
      },
    })
    const rejected = httpStatus === 401 && json?.ok === false
    report.steps.push(
      stepRecord('auth_unauthenticated_addendum', rejected ? 'pass' : 'fail', {
        detail: rejected ? `HTTP ${httpStatus}` : `expected 401 got ${httpStatus}`,
        http_status: httpStatus,
      }),
    )
    rejected ? report.summary.passed++ : report.summary.failed++
  }

  let orgB = args.orgBId
  if (!orgB) orgB = await discoverOrgB(sql)
  if (orgB && orgB !== orgId) {
    const cookieB = (
      await signInForCookieHeader(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
        SYNTHETIC.userB,
      )
    ).cookieHeader
    const { json, httpStatus } = await apiFetch(base, '/api/source/response-set/addendum', {
      method: 'POST',
      cookieHeader: cookieB,
      body: {
        organization_id: orgId,
        source_response_set_id: ctx.responseSetId,
        source_field_id: ctx.addendumFieldId,
        addendum_text: addendumText,
        reason: 'wrong org cookie',
      },
    })
    const denied = (httpStatus === 403 || httpStatus === 401) && json?.ok === false
    report.steps.push(
      stepRecord('auth_wrong_org_addendum', denied ? 'pass' : 'fail', {
        detail: denied ? `forbidden http=${httpStatus}` : `expected 403/401 got ${httpStatus}`,
        http_status: httpStatus,
      }),
    )
    denied ? report.summary.passed++ : report.summary.failed++
  } else {
    report.steps.push(stepRecord('auth_wrong_org_addendum', 'skip', { detail: 'org B not available' }))
    report.summary.skipped++
  }

  if (orgB && orgB !== orgId) {
    const { json, httpStatus } = await apiFetch(base, '/api/source/response-set/addendum', {
      method: 'POST',
      cookieHeader,
      body: {
        organization_id: orgB,
        source_response_set_id: ctx.responseSetId,
        source_field_id: ctx.addendumFieldId,
        addendum_text: addendumText,
        reason: 'wrong org id in body',
      },
    })
    const rejected =
      json?.ok === false && (httpStatus === 403 || httpStatus === 404 || httpStatus === 400)
    report.steps.push(
      stepRecord('neg_addendum_wrong_org_id', rejected ? 'pass' : 'fail', {
        detail: rejected ? `rejected http=${httpStatus} code=${json?.code}` : 'expected rejection',
        http_status: httpStatus,
        actual: json?.code,
      }),
    )
    rejected ? report.summary.passed++ : report.summary.failed++
  } else {
    report.steps.push(stepRecord('neg_addendum_wrong_org_id', 'skip', { detail: 'org B not available' }))
    report.summary.skipped++
  }

  {
    const { json, httpStatus } = await apiFetch(base, '/api/source/response-set/addendum', {
      method: 'POST',
      cookieHeader,
      body: {
        organization_id: orgId,
        source_response_set_id: ctx.responseSetId,
        source_field_id: ctx.addendumFieldId,
        addendum_text: addendumText,
        reason: '   ',
      },
    })
    const rejected = httpStatus === 400 && json?.ok === false && json?.code === 'INVALID_REQUEST'
    report.steps.push(
      stepRecord('neg_addendum_no_reason', rejected ? 'pass' : 'fail', {
        detail: rejected ? 'INVALID_REQUEST' : JSON.stringify(json?.code),
        http_status: httpStatus,
      }),
    )
    rejected ? report.summary.passed++ : report.summary.failed++
  }

  {
    const { json, httpStatus } = await apiFetch(base, '/api/source/response-set/addendum', {
      method: 'POST',
      cookieHeader,
      body: {
        organization_id: orgId,
        source_response_set_id: ctx.responseSetId,
        addendum_text: addendumText,
        reason: 'missing field',
      },
    })
    const rejected = httpStatus === 400 && json?.ok === false && json?.code === 'INVALID_REQUEST'
    report.steps.push(
      stepRecord('neg_addendum_no_field', rejected ? 'pass' : 'fail', {
        detail: rejected ? 'INVALID_REQUEST (source_field_id required)' : JSON.stringify(json?.code),
        http_status: httpStatus,
      }),
    )
    rejected ? report.summary.passed++ : report.summary.failed++
  }

  ctx.baselineAddendaCount = manifestAddendaCount(envelopes.manifest.body)
  report.steps.push(
    stepRecord('addendum_baseline_read', 'pass', {
      detail: `baseline addenda=${ctx.baselineAddendaCount}`,
      actual: { addenda: ctx.baselineAddendaCount },
    }),
  )
  report.summary.passed++

  {
    const { json, httpStatus } = await apiFetch(base, '/api/source/response-set/addendum', {
      method: 'POST',
      cookieHeader,
      body: {
        organization_id: orgId,
        source_response_set_id: ctx.responseSetId,
        source_field_id: ctx.addendumFieldId,
        addendum_text: addendumText,
        reason: ctx.addendumReason,
      },
    })
    const env = assertApiEnvelope(json, { expectedRpc: ADDENDUM_RPC, requireOk: true })
    const ok = env.ok && json.ok && httpStatus === 200
    report.steps.push(
      stepRecord('addendum_post', ok ? 'pass' : 'fail', {
        detail: ok ? `addendum field=${ctx.addendumFieldId}` : env.issues.join('; '),
        route: 'POST /api/source/response-set/addendum',
        rpc: ADDENDUM_RPC,
        http_status: httpStatus,
        key_ids: { addendum_field_id: ctx.addendumFieldId },
      }),
    )
    ok ? report.summary.passed++ : report.summary.failed++
    if (!ok) {
      report.ok = false
      return
    }
  }

  const afterEnvelopes = await readBundle(ctx.responseSetId)

  {
    const result = assertPostAddendumReadState({
      beforeManifestCount: ctx.baselineAddendaCount,
      afterEnvelopes,
      modules,
      ctx,
    })
    report.steps.push(
      stepRecord('addendum_canonical_read', result.ok ? 'pass' : 'fail', {
        detail: result.ok
          ? `addenda=${result.afterCount} effective=${result.actualDisplay}`
          : result.issues.join('; '),
        errors: result.ok ? null : result.issues,
        actual: {
          afterCount: result.afterCount,
          historyHasAddendum: historyHasAddendumEvent(afterEnvelopes.history.body?.data),
        },
      }),
    )
    result.ok ? report.summary.passed++ : report.summary.failed++
  }

  {
    const afterRows = await sql`
      select id, value_text, value_number, value_boolean, value_date, value_datetime, is_submitted
      from public.source_responses
      where response_set_id = ${ctx.responseSetId}::uuid and is_submitted = true
    `
    let preserved = true
    for (const row of afterRows) {
      const prior = ctx.submittedSnapshots?.get(row.id)
      if (prior && prior !== responseValueSnapshot(row)) preserved = false
    }
    const priorCount = ctx.submittedSnapshots?.size ?? 0
    const ok = preserved && afterRows.length >= priorCount
    report.steps.push(
      stepRecord('addendum_submitted_immutable', ok ? 'pass' : 'fail', {
        detail: ok
          ? `${priorCount} prior submitted rows unchanged`
          : 'submitted row mutation detected',
        actual: { priorCount, afterSubmittedCount: afterRows.length },
      }),
    )
    ok ? report.summary.passed++ : report.summary.failed++
  }

  {
    const a = await readBundle(ctx.responseSetId)
    const b = await readBundle(ctx.responseSetId)
    const fpA = stableFingerprint(
      modules.normalizeResponseSetDetail(a.detail.body.data),
    )
    const fpB = stableFingerprint(
      modules.normalizeResponseSetDetail(b.detail.body.data),
    )
    const countA = manifestAddendaCount(a.manifest.body)
    const countB = manifestAddendaCount(b.manifest.body)
    const histA = a.history.body?.data?.event_count ?? a.history.body?.data?.events?.length
    const histB = b.history.body?.data?.event_count ?? b.history.body?.data?.events?.length
    const ok =
      fpA === fpB &&
      countA === countB &&
      histA === histB &&
      assertReadApiEnvelope(a.detail.body, 'detail', { requireOk: true }).ok
    report.steps.push(
      stepRecord('addendum_determinism', ok ? 'pass' : 'fail', {
        detail: ok
          ? `stable fingerprint; addenda=${countA}; events=${histA}`
          : `fpMatch=${fpA === fpB} addenda ${countA}/${countB} events ${histA}/${histB}`,
        actual: { fpMatch: fpA === fpB, countA, countB, histA, histB },
      }),
    )
    ok ? report.summary.passed++ : report.summary.failed++
  }

  {
    const href = `/source/response-set/${ctx.responseSetId}?organization_id=${orgId}`
    const { httpStatus } = await apiFetch(base, href, { cookieHeader })
    const ok = httpStatus === 200
    report.steps.push(
      stepRecord('addendum_review_route', ok ? 'pass' : 'fail', {
        detail: ok ? `GET ${href} HTTP 200` : `HTTP ${httpStatus}`,
        route: href,
        http_status: httpStatus,
      }),
    )
    ok ? report.summary.passed++ : report.summary.failed++
  }

  report.ok = report.summary.failed === 0 && report.summary.blocked === 0
}

async function main() {
  loadEnvFiles()
  const args = parseArgs(process.argv)

  const report = {
    phase: '5.4B',
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
          detail: 'planning — run with --live --organization-id <uuid>',
        }),
      )
      report.summary.planned++
    }
    finish(report)
    return
  }

  requireEnv(['NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY', 'DATABASE_URL'])

  if (!args.organizationId || !isUuid(args.organizationId)) {
    report.gaps.push('missing or invalid --organization-id for live mode')
    report.ok = false
    finish(report)
    return
  }

  const sql = await connectPostgres()
  if (!sql) {
    report.gaps.push('DATABASE_URL unavailable')
    report.ok = false
    finish(report)
    return
  }

  let cookieHeader
  try {
    cookieHeader = (
      await signInForCookieHeader(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
        SYNTHETIC.userA,
      )
    ).cookieHeader
  } catch (e) {
    report.gaps.push(`auth failed: ${e.message}`)
    report.ok = false
    finish(report)
    await sql.end()
    return
  }

  const health = await fetch(args.baseUrl, { redirect: 'manual' }).catch(() => null)
  if (!health) {
    report.gaps.push(`Next.js not reachable at ${args.baseUrl}`)
  }

  try {
    await liveRun(args, report, sql, cookieHeader)
  } finally {
    await sql.end()
  }

  if (!unitOk) report.ok = false
  finish(report)
}

function finish(report) {
  report.finished_at = new Date().toISOString()
  mkdirSync(REPORT_DIR, { recursive: true })
  writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2))
  const { passed, failed, skipped, blocked, planned } = report.summary
  console.log(
    `Phase 5.4B addendum shell E2E [${report.mode}]: pass=${passed} fail=${failed} skip=${skipped} blocked=${blocked} planned=${planned}`,
  )
  console.log(`Report: ${REPORT_PATH}`)
  if (report.gaps.length) console.log('Gaps:', report.gaps.join('; '))
  process.exit(report.ok ? 0 : 1)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
