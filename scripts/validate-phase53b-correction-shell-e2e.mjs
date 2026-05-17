/**
 * Phase 5.3B — Post-submit correction shell E2E.
 *
 *   npm run db:validate-phase53b-correction-shell-e2e
 *   npm run db:validate-phase53b-correction-shell-e2e:live -- --organization-id ...
 *
 * Report: tmp/runtime-e2e/phase53b-correction-shell-e2e-report.json
 */

import { mkdirSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadEnvFiles, requireEnv } from './lib/env.mjs'
import {
  apiFetch,
  assertApiEnvelope,
  correctionValueForWidget,
  isUuid,
  responseValueSnapshot,
  signInForCookieHeader,
  SYNTHETIC,
  stepRecord,
  valueForWidget,
} from './lib/source-api-e2e.mjs'
import {
  prepareCaptureFixture,
  WRITE_RPC,
  detailFieldDisplayValue,
  expectedDisplayForSavedValue,
  pickPrimaryField,
} from './lib/capture-shell-e2e.mjs'
import { loadCorrectionModules } from './lib/correction-shell-import.mjs'
import { assertReadApiEnvelope, readRoutePath, stableFingerprint } from './lib/read-contract-e2e.mjs'
import {
  CORRECT_RPC,
  assertPostCorrectionReadState,
  countCorrectionEligibleFields,
  expectedDisplayForCorrection,
  historyHasCorrectionEvent,
  historyHasSubmitEvent,
  manifestCorrectionCount,
  resolveAllowCorrections,
  runCorrectionUnitValidations,
} from './lib/correction-shell-e2e.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const REPORT_DIR = join(ROOT, 'tmp/runtime-e2e')
const REPORT_PATH = join(REPORT_DIR, 'phase53b-correction-shell-e2e-report.json')

const LIVE_STEPS = [
  { id: 'fixture_discover', title: 'Discover fresh procedure_execution for capture' },
  { id: 'fixture_submit', title: 'Open, save required fields, submit response set' },
  { id: 'fixture_submitted_confirm', title: 'Confirm submitted state and correction eligibility' },
  { id: 'auth_unauthenticated_correct', title: 'Unauthenticated POST /correct rejected' },
  { id: 'auth_wrong_org_correct', title: 'Cross-org POST /correct rejected' },
  { id: 'neg_correction_wrong_org_id', title: 'Wrong organization_id in body rejected' },
  { id: 'neg_correction_no_reason', title: 'Correction without reason rejected' },
  { id: 'neg_correction_missing_response', title: 'Missing source_response_id rejected' },
  { id: 'correction_baseline_read', title: 'Baseline manifest correction count' },
  { id: 'correction_post', title: 'POST /api/source/response/correct' },
  { id: 'correction_canonical_read', title: 'Canonical read assertions after correction' },
  { id: 'correction_lineage_immutable', title: 'Prior source_response row not overwritten' },
  { id: 'correction_determinism', title: 'Repeated read bundle stable; GET does not mutate counts' },
  { id: 'correction_review_route', title: 'Review page route returns 200' },
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
  console.log(`Phase 5.3B Correction shell E2E

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

function valueForWidgetWithOverride(widgetHint, textOverride) {
  const base = valueForWidget(widgetHint)
  if (base.value_text !== undefined) return { value_text: textOverride }
  return base
}

function runUnitSuite(report) {
  const loaded = loadCorrectionModules()
  const results = runCorrectionUnitValidations(loaded.capture, loaded)
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
  const modules = loadCorrectionModules().capture

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

  const ctx = {
    responseSetId: fixture.existingResponseSetId,
    fieldId: null,
    widgetHint: 'text',
    savedValue: `e2e-53b-${Date.now()}`,
    priorResponseId: null,
    priorSnapshot: null,
    submittedDisplay: null,
    correctionReason: 'phase53b correction shell e2e',
    baselineCorrectionCount: 0,
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

  // --- Submit fixture (open → save → submit) ---
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
  const primary = pickPrimaryField(envelopes.detail.body.data)
  ctx.fieldId = primary?.source_field_id
  ctx.widgetHint = primary?.widget_hint ?? 'text'

  const detailData = envelopes.detail.body.data
  const payload = []
  for (const field of detailData.fields ?? []) {
    if (!field.is_required) continue
    const hint = field.widget_hint ?? 'text'
    if (field.source_field_id === ctx.fieldId) {
      payload.push({
        source_field_id: field.source_field_id,
        ...valueForWidgetWithOverride(hint, ctx.savedValue),
      })
    } else {
      payload.push({ source_field_id: field.source_field_id, ...valueForWidget(hint) })
    }
  }
  if (payload.length === 0 && ctx.fieldId) {
    payload.push({
      source_field_id: ctx.fieldId,
      ...valueForWidgetWithOverride(ctx.widgetHint, ctx.savedValue),
    })
  }

  {
    const { json, httpStatus } = await apiFetch(base, '/api/source/response-set/save-draft', {
      method: 'POST',
      cookieHeader,
      body: {
        organization_id: orgId,
        source_response_set_id: ctx.responseSetId,
        responses: payload,
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
  const currentRow = envelopes.detail.body.data?.fields?.find(
    (f) => f.source_field_id === ctx.fieldId,
  )
  ctx.priorResponseId = currentRow?.current_effective?.response_id ?? null
  ctx.submittedDisplay = expectedDisplayForSavedValue(ctx.widgetHint, ctx.savedValue)

  if (ctx.priorResponseId) {
    const prior = await sql`
      select value_text, value_number, value_boolean, value_date, value_datetime, is_submitted
      from public.source_responses where id = ${ctx.priorResponseId}::uuid
    `
    ctx.priorSnapshot = responseValueSnapshot(prior[0])
  }

  {
    const { json, httpStatus } = await apiFetch(base, '/api/source/response-set/submit', {
      method: 'POST',
      cookieHeader,
      body: {
        organization_id: orgId,
        source_response_set_id: ctx.responseSetId,
        submit_reason: 'phase53b correction shell e2e',
      },
    })
    const env = assertApiEnvelope(json, { expectedRpc: WRITE_RPC.SUBMIT_RPC, requireOk: true })
    const ok = env.ok && httpStatus === 200
    report.steps.push(
      stepRecord('fixture_submit', ok ? 'pass' : 'fail', {
        detail: ok ? `submitted response_set_id=${ctx.responseSetId}` : env.issues.join('; '),
        key_ids: { response_set_id: ctx.responseSetId, source_response_id: ctx.priorResponseId },
      }),
    )
    ok ? report.summary.passed++ : report.summary.failed++
    if (!ok) {
      report.ok = false
      return
    }
  }

  envelopes = await readBundle(ctx.responseSetId)

  // Confirm submitted + UI contract
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
    const allow = resolveAllowCorrections(manifestPanel)
    const eligible = countCorrectionEligibleFields(detailPanel, allow)
    const display = detailFieldDisplayValue(envelopes.detail.body.data, ctx.fieldId)
    const ok =
      allow &&
      eligible >= 1 &&
      envelopes.detail.body?.data?.response_set?.status === 'submitted' &&
      historyHasSubmitEvent(envelopes.history.body?.data) &&
      display === ctx.submittedDisplay &&
      isUuid(ctx.priorResponseId)
    report.steps.push(
      stepRecord('fixture_submitted_confirm', ok ? 'pass' : 'fail', {
        detail: ok
          ? `isSubmitted=true eligibleFields=${eligible} display=${display}`
          : `allow=${allow} eligible=${eligible} status=${envelopes.detail.body?.data?.response_set?.status}`,
        actual: { display, priorResponseId: ctx.priorResponseId },
      }),
    )
    ok ? report.summary.passed++ : report.summary.failed++
    if (!ok) {
      report.ok = false
      return
    }
  }

  const correctionPayload = correctionValueForWidget(ctx.widgetHint)

  // Unauthenticated correct
  {
    const { json, httpStatus } = await apiFetch(base, '/api/source/response/correct', {
      method: 'POST',
      body: {
        organization_id: orgId,
        source_response_id: ctx.priorResponseId,
        corrected_value: correctionPayload,
        correction_reason: 'no auth',
      },
    })
    const rejected = httpStatus === 401 && json?.ok === false
    report.steps.push(
      stepRecord('auth_unauthenticated_correct', rejected ? 'pass' : 'fail', {
        detail: rejected ? `HTTP ${httpStatus}` : `expected 401 got ${httpStatus}`,
        http_status: httpStatus,
      }),
    )
    rejected ? report.summary.passed++ : report.summary.failed++
  }

  // Wrong org
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
    const { json, httpStatus } = await apiFetch(base, '/api/source/response/correct', {
      method: 'POST',
      cookieHeader: cookieB,
      body: {
        organization_id: orgId,
        source_response_id: ctx.priorResponseId,
        corrected_value: correctionPayload,
        correction_reason: 'wrong org',
      },
    })
    const denied =
      (httpStatus === 403 || httpStatus === 401) && json?.ok === false
    report.steps.push(
      stepRecord('auth_wrong_org_correct', denied ? 'pass' : 'fail', {
        detail: denied ? `forbidden http=${httpStatus}` : `expected 403/401 got ${httpStatus}`,
        http_status: httpStatus,
      }),
    )
    denied ? report.summary.passed++ : report.summary.failed++
  } else {
    report.steps.push(stepRecord('auth_wrong_org_correct', 'skip', { detail: 'org B not available' }))
    report.summary.skipped++
  }

  if (orgB && orgB !== orgId) {
    const { json, httpStatus } = await apiFetch(base, '/api/source/response/correct', {
      method: 'POST',
      cookieHeader,
      body: {
        organization_id: orgB,
        source_response_id: ctx.priorResponseId,
        corrected_value: correctionPayload,
        correction_reason: 'wrong org id in body',
      },
    })
    const rejected =
      json?.ok === false &&
      (httpStatus === 403 || httpStatus === 404 || httpStatus === 400)
    report.steps.push(
      stepRecord('neg_correction_wrong_org_id', rejected ? 'pass' : 'fail', {
        detail: rejected ? `rejected http=${httpStatus} code=${json?.code}` : 'expected rejection',
        http_status: httpStatus,
        actual: json?.code,
      }),
    )
    rejected ? report.summary.passed++ : report.summary.failed++
  } else {
    report.steps.push(stepRecord('neg_correction_wrong_org_id', 'skip', { detail: 'org B not available' }))
    report.summary.skipped++
  }

  // No reason
  {
    const { json, httpStatus } = await apiFetch(base, '/api/source/response/correct', {
      method: 'POST',
      cookieHeader,
      body: {
        organization_id: orgId,
        source_response_id: ctx.priorResponseId,
        corrected_value: correctionPayload,
        correction_reason: '   ',
      },
    })
    const rejected = httpStatus === 400 && json?.ok === false && json?.code === 'INVALID_REQUEST'
    report.steps.push(
      stepRecord('neg_correction_no_reason', rejected ? 'pass' : 'fail', {
        detail: rejected ? 'INVALID_REQUEST' : JSON.stringify(json?.code),
        http_status: httpStatus,
      }),
    )
    rejected ? report.summary.passed++ : report.summary.failed++
  }

  // Missing response id
  {
    const fakeId = '00000000-0000-4000-8000-000000000099'
    const { json, httpStatus } = await apiFetch(base, '/api/source/response/correct', {
      method: 'POST',
      cookieHeader,
      body: {
        organization_id: orgId,
        source_response_id: fakeId,
        corrected_value: correctionPayload,
        correction_reason: 'missing row',
      },
    })
    const rejected = json?.ok === false && httpStatus >= 400
    report.steps.push(
      stepRecord('neg_correction_missing_response', rejected ? 'pass' : 'fail', {
        detail: rejected ? `rejected http=${httpStatus} code=${json?.code}` : 'expected failure',
        http_status: httpStatus,
        actual: json?.code,
      }),
    )
    rejected ? report.summary.passed++ : report.summary.failed++
  }

  ctx.baselineCorrectionCount = manifestCorrectionCount(envelopes.manifest.body)
  report.steps.push(
    stepRecord('correction_baseline_read', 'pass', {
      detail: `baseline corrections=${ctx.baselineCorrectionCount}`,
      actual: { corrections: ctx.baselineCorrectionCount },
    }),
  )
  report.summary.passed++

  // POST correct
  {
    const { json, httpStatus } = await apiFetch(base, '/api/source/response/correct', {
      method: 'POST',
      cookieHeader,
      body: {
        organization_id: orgId,
        source_response_id: ctx.priorResponseId,
        corrected_value: correctionPayload,
        correction_reason: ctx.correctionReason,
      },
    })
    const env = assertApiEnvelope(json, { expectedRpc: CORRECT_RPC, requireOk: true })
    const newId = json?.data?.replacement_response_id ?? json?.data?.response_id
    const ok = env.ok && json.ok && httpStatus === 200
    if (newId) ctx.currentResponseId = newId
    report.steps.push(
      stepRecord('correction_post', ok ? 'pass' : 'fail', {
        detail: ok ? `corrected replacement=${newId ?? 'n/a'}` : env.issues.join('; '),
        route: 'POST /api/source/response/correct',
        rpc: CORRECT_RPC,
        http_status: httpStatus,
        key_ids: { prior_response_id: ctx.priorResponseId, replacement_response_id: newId },
      }),
    )
    ok ? report.summary.passed++ : report.summary.failed++
    if (!ok) {
      report.ok = false
      return
    }
  }

  const afterEnvelopes = await readBundle(ctx.responseSetId)

  // Canonical read assertions
  {
    const result = assertPostCorrectionReadState({
      beforeManifestCount: ctx.baselineCorrectionCount,
      afterEnvelopes,
      modules,
      ctx,
      correctionReason: ctx.correctionReason,
    })
    report.steps.push(
      stepRecord('correction_canonical_read', result.ok ? 'pass' : 'fail', {
        detail: result.ok
          ? `corrections=${result.afterCount} effective=${result.actualDisplay}`
          : result.issues.join('; '),
        errors: result.ok ? null : result.issues,
        actual: {
          afterCount: result.afterCount,
          expectedDisplay: result.expectedDisplay,
          actualDisplay: result.actualDisplay,
          historyHasCorrection: historyHasCorrectionEvent(afterEnvelopes.history.body?.data),
        },
      }),
    )
    result.ok ? report.summary.passed++ : report.summary.failed++
  }

  // Lineage immutable
  {
    const afterPrior = await sql`
      select value_text, value_number, value_boolean, value_date, value_datetime, is_submitted
      from public.source_responses where id = ${ctx.priorResponseId}::uuid
    `
    const unchanged =
      responseValueSnapshot(afterPrior[0]) === ctx.priorSnapshot &&
      afterPrior[0]?.is_submitted === true
    const current = await sql`
      select id, is_current from public.source_responses
      where response_set_id = ${ctx.responseSetId}::uuid
        and source_field_id = ${ctx.fieldId}::uuid
        and is_current = true
    `
    const ok = unchanged && current[0]?.id !== ctx.priorResponseId
    report.steps.push(
      stepRecord('correction_lineage_immutable', ok ? 'pass' : 'fail', {
        detail: ok
          ? 'prior row immutable; new current response active'
          : 'lineage check failed',
        key_ids: {
          prior_response_id: ctx.priorResponseId,
          current_response_id: current[0]?.id,
        },
      }),
    )
    ok ? report.summary.passed++ : report.summary.failed++
  }

  // Determinism + read-only GET
  {
    const a = await readBundle(ctx.responseSetId)
    const b = await readBundle(ctx.responseSetId)
    const fpA = stableFingerprint(
      modules.normalizeResponseSetDetail(a.detail.body.data),
    )
    const fpB = stableFingerprint(
      modules.normalizeResponseSetDetail(b.detail.body.data),
    )
    const countA = manifestCorrectionCount(a.manifest.body)
    const countB = manifestCorrectionCount(b.manifest.body)
    const histA = a.history.body?.data?.event_count ?? a.history.body?.data?.events?.length
    const histB = b.history.body?.data?.event_count ?? b.history.body?.data?.events?.length
    const ok =
      fpA === fpB &&
      countA === countB &&
      histA === histB &&
      assertReadApiEnvelope(a.detail.body, 'detail', { requireOk: true }).ok
    report.steps.push(
      stepRecord('correction_determinism', ok ? 'pass' : 'fail', {
        detail: ok
          ? `stable fingerprint; corrections=${countA}; events=${histA}`
          : `fpMatch=${fpA === fpB} counts ${countA}/${countB} events ${histA}/${histB}`,
        actual: { fpMatch: fpA === fpB, countA, countB, histA, histB },
      }),
    )
    ok ? report.summary.passed++ : report.summary.failed++
  }

  // Review route
  {
    const href = `/source/response-set/${ctx.responseSetId}?organization_id=${orgId}`
    const { httpStatus } = await apiFetch(base, href, { cookieHeader })
    const ok = httpStatus === 200
    report.steps.push(
      stepRecord('correction_review_route', ok ? 'pass' : 'fail', {
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
    phase: '5.3B',
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
    `Phase 5.3B correction shell E2E [${report.mode}]: pass=${passed} fail=${failed} skip=${skipped} blocked=${blocked} planned=${planned}`,
  )
  console.log(`Report: ${REPORT_PATH}`)
  if (report.gaps.length) console.log('Gaps:', report.gaps.join('; '))
  process.exit(report.ok ? 0 : 1)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
