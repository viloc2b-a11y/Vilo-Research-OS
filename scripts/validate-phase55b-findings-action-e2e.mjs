/**
 * Phase 5.5B — Findings action UI E2E.
 *
 *   npm run db:validate-phase55b-findings-action-e2e
 *   npm run db:validate-phase55b-findings-action-e2e:live -- --organization-id ...
 *
 * Report: tmp/runtime-e2e/phase55b-findings-action-e2e-report.json
 */

import { mkdirSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadEnvFiles, requireEnv } from './lib/env.mjs'
import {
  apiFetch,
  assertApiEnvelope,
  isUuid,
  signInForCookieHeader,
  SYNTHETIC,
  stepRecord,
  valueForWidget,
} from './lib/source-api-e2e.mjs'
import { prepareCaptureFixture, WRITE_RPC, pickPrimaryField } from './lib/capture-shell-e2e.mjs'
import { loadFindingsActionModules } from './lib/findings-action-import.mjs'
import { assertReadApiEnvelope, readRoutePath, stableFingerprint } from './lib/read-contract-e2e.mjs'
import {
  ACK_FINDING_RPC,
  CREATE_FINDING_RPC,
  RESOLVE_FINDING_RPC,
  WAIVE_FINDING_RPC,
  assertPostFindingActionRead,
  historyHasSubmitEvent,
  isPostSubmitResponseSet,
  manifestFindingCounts,
  runFindingsActionUnitValidations,
} from './lib/findings-action-e2e.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const REPORT_DIR = join(ROOT, 'tmp/runtime-e2e')
const REPORT_PATH = join(REPORT_DIR, 'phase55b-findings-action-e2e-report.json')

const LIVE_STEPS = [
  { id: 'fixture_discover', title: 'Discover fresh procedure_execution' },
  { id: 'fixture_submit', title: 'Open, save required fields, submit' },
  { id: 'fixture_create_findings', title: 'Create findings A (resolve path) and B (waive path)' },
  { id: 'fixture_post_submit_confirm', title: 'Confirm post-submit lane' },
  { id: 'auth_unauthenticated_ack', title: 'Unauthenticated acknowledge rejected' },
  { id: 'auth_wrong_org_ack', title: 'Cross-org acknowledge rejected' },
  { id: 'neg_wrong_org_id', title: 'Wrong organization_id rejected' },
  { id: 'neg_resolve_no_text', title: 'Resolve without text rejected' },
  { id: 'neg_waive_no_reason', title: 'Waive without reason rejected' },
  { id: 'neg_fake_finding_id', title: 'Fake finding_id rejected' },
  { id: 'finding_acknowledge', title: 'Acknowledge finding A' },
  { id: 'finding_acknowledge_read', title: 'Canonical read after acknowledge' },
  { id: 'finding_resolve', title: 'Resolve finding A' },
  { id: 'finding_resolve_read', title: 'Canonical read after resolve' },
  { id: 'neg_invalid_transition', title: 'Acknowledge resolved finding rejected' },
  { id: 'finding_waive', title: 'Waive finding B' },
  { id: 'finding_waive_read', title: 'Canonical read after waive' },
  { id: 'findings_determinism', title: 'Stable findings fingerprint; GET does not mutate counts' },
  { id: 'findings_review_route', title: 'Review page route returns 200' },
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
  console.log(`Phase 5.5B Findings action E2E

Options:
  --live                         HTTP flow (requires npm run dev)
  --base-url <url>
  --organization-id <uuid>       Required for live
  --org-b-id <uuid>              Cross-tenant probe
  --fresh                        Insert new visit + procedure_execution (default)
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
  const loaded = loadFindingsActionModules()
  const results = runFindingsActionUnitValidations(loaded.capture, loaded.findingActionEligibility)
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
  const modules = loadFindingsActionModules().capture

  const fixture = await prepareCaptureFixture(sql, orgId, { fresh: args.fresh })
  if (!fixture?.procedureExecutionId || !fixture.studyVersionId) {
    report.steps.push(
      stepRecord('fixture_discover', 'blocked', {
        detail: 'no mutable procedure_execution — use --fresh',
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
    responseId: null,
    findingAId: null,
    findingBId: null,
    baselineManifestCounts: null,
  }

  async function readBundle(responseSetId) {
    const [detailRes, manifestRes, historyRes, findingsRes] = await Promise.all([
      apiFetch(base, readRoutePath(responseSetId, 'detail', orgId), { cookieHeader }),
      apiFetch(base, readRoutePath(responseSetId, 'manifest', orgId), { cookieHeader }),
      apiFetch(base, readRoutePath(responseSetId, 'history', orgId), { cookieHeader }),
      apiFetch(base, readRoutePath(responseSetId, 'findings', orgId), { cookieHeader }),
    ])
    return {
      detail: { body: detailRes.json, httpStatus: detailRes.httpStatus },
      manifest: { body: manifestRes.json, httpStatus: manifestRes.httpStatus },
      history: { body: historyRes.json, httpStatus: historyRes.httpStatus },
      findings: { body: findingsRes.json, httpStatus: findingsRes.httpStatus },
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
    if (!env.ok || httpStatus !== 200 || !isUuid(ctx.responseSetId)) {
      report.steps.push(stepRecord('fixture_submit', 'fail', { detail: 'open failed' }))
      report.summary.failed++
      report.ok = false
      return
    }
  }

  let envelopes = await readBundle(ctx.responseSetId)
  const primary = pickPrimaryField(envelopes.detail.body.data)
  ctx.fieldId = primary?.source_field_id

  const requiredPayload = (envelopes.detail.body.data.fields ?? [])
    .filter((f) => f.is_required)
    .map((f) => ({
      source_field_id: f.source_field_id,
      ...valueForWidget(f.widget_hint ?? 'text'),
    }))

  {
    const { json, httpStatus } = await apiFetch(base, '/api/source/response-set/save-draft', {
      method: 'POST',
      cookieHeader,
      body: {
        organization_id: orgId,
        source_response_set_id: ctx.responseSetId,
        responses: requiredPayload,
      },
    })
    const env = assertApiEnvelope(json, { expectedRpc: WRITE_RPC.SAVE_RPC, requireOk: true })
    if (!env.ok || httpStatus !== 200) {
      report.steps.push(stepRecord('fixture_submit', 'fail', { detail: 'save-draft failed' }))
      report.summary.failed++
      report.ok = false
      return
    }
  }

  envelopes = await readBundle(ctx.responseSetId)
  const current = envelopes.detail.body.data?.fields?.find(
    (f) => f.source_field_id === ctx.fieldId,
  )
  ctx.responseId = current?.current_effective?.response_id ?? null

  {
    const { json, httpStatus } = await apiFetch(base, '/api/source/response-set/submit', {
      method: 'POST',
      cookieHeader,
      body: {
        organization_id: orgId,
        source_response_set_id: ctx.responseSetId,
        submit_reason: 'phase55b findings action e2e',
      },
    })
    const env = assertApiEnvelope(json, { expectedRpc: WRITE_RPC.SUBMIT_RPC, requireOk: true })
    const ok = env.ok && httpStatus === 200
    report.steps.push(
      stepRecord('fixture_submit', ok ? 'pass' : 'fail', {
        detail: ok ? `submitted set=${ctx.responseSetId}` : 'submit failed',
        key_ids: { response_set_id: ctx.responseSetId, response_id: ctx.responseId },
      }),
    )
    ok ? report.summary.passed++ : report.summary.failed++
    if (!ok) {
      report.ok = false
      return
    }
  }

  envelopes = await readBundle(ctx.responseSetId)

  {
    const createA = await apiFetch(base, '/api/source/findings/create', {
      method: 'POST',
      cookieHeader,
      body: {
        organization_id: orgId,
        source_response_set_id: ctx.responseSetId,
        finding_type: 'required',
        severity: 'warning',
        finding_text: 'phase55b e2e finding A resolve path',
        rule_reference: 'E2E_55B_RESOLVE',
      },
    })
    const envA = assertApiEnvelope(createA.json, {
      expectedRpc: CREATE_FINDING_RPC,
      requireOk: true,
    })
    ctx.findingAId = createA.json?.data?.finding_id

    const createB = await apiFetch(base, '/api/source/findings/create', {
      method: 'POST',
      cookieHeader,
      body: {
        organization_id: orgId,
        source_response_set_id: ctx.responseSetId,
        finding_type: 'range',
        severity: 'info',
        finding_text: 'phase55b e2e finding B waive path',
        rule_reference: 'E2E_55B_WAIVE',
      },
    })
    const envB = assertApiEnvelope(createB.json, {
      expectedRpc: CREATE_FINDING_RPC,
      requireOk: true,
    })
    ctx.findingBId = createB.json?.data?.finding_id

    const ok =
      envA.ok &&
      createA.json.ok &&
      envB.ok &&
      createB.json.ok &&
      isUuid(ctx.findingAId) &&
      isUuid(ctx.findingBId)
    report.steps.push(
      stepRecord('fixture_create_findings', ok ? 'pass' : 'fail', {
        detail: ok ? `A=${ctx.findingAId} B=${ctx.findingBId}` : 'create findings failed',
        key_ids: { finding_a_id: ctx.findingAId, finding_b_id: ctx.findingBId },
      }),
    )
    ok ? report.summary.passed++ : report.summary.failed++
    if (!ok) {
      report.ok = false
      return
    }
  }

  const actor = await sql`
    select id from auth.users where email = ${SYNTHETIC.userA.email} limit 1
  `
  if (actor[0]?.id && fixture.studyId) {
    await sql`
      insert into public.study_members (study_id, user_id, role)
      values (${fixture.studyId}::uuid, ${actor[0].id}::uuid, 'coordinator')
      on conflict (study_id, user_id) do update set role = excluded.role
    `
  }

  envelopes = await readBundle(ctx.responseSetId)
  ctx.baselineManifestCounts = manifestFindingCounts(envelopes.manifest.body)

  {
    const postSubmit = isPostSubmitResponseSet(
      envelopes.detail.body.data,
      envelopes.manifest.body,
    )
    const ok =
      postSubmit &&
      historyHasSubmitEvent(envelopes.history.body?.data) &&
      ctx.baselineManifestCounts.total >= 2
    report.steps.push(
      stepRecord('fixture_post_submit_confirm', ok ? 'pass' : 'fail', {
        detail: ok
          ? `post-submit; findings_total=${ctx.baselineManifestCounts.total}`
          : 'post-submit or findings count check failed',
      }),
    )
    ok ? report.summary.passed++ : report.summary.failed++
    if (!ok) {
      report.ok = false
      return
    }
  }

  {
    const { json, httpStatus } = await apiFetch(base, '/api/source/findings/acknowledge', {
      method: 'POST',
      body: {
        organization_id: orgId,
        finding_id: ctx.findingAId,
        comment: 'no auth',
      },
    })
    const rejected = httpStatus === 401 && json?.ok === false
    report.steps.push(
      stepRecord('auth_unauthenticated_ack', rejected ? 'pass' : 'fail', {
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
    const { json, httpStatus } = await apiFetch(base, '/api/source/findings/acknowledge', {
      method: 'POST',
      cookieHeader: cookieB,
      body: {
        organization_id: orgId,
        finding_id: ctx.findingAId,
        comment: 'wrong org cookie',
      },
    })
    const denied = (httpStatus === 403 || httpStatus === 401) && json?.ok === false
    report.steps.push(
      stepRecord('auth_wrong_org_ack', denied ? 'pass' : 'fail', {
        detail: denied ? `forbidden http=${httpStatus}` : `expected 403/401 got ${httpStatus}`,
        http_status: httpStatus,
      }),
    )
    denied ? report.summary.passed++ : report.summary.failed++
  } else {
    report.steps.push(stepRecord('auth_wrong_org_ack', 'skip', { detail: 'org B not available' }))
    report.summary.skipped++
  }

  if (orgB && orgB !== orgId) {
    const { json, httpStatus } = await apiFetch(base, '/api/source/findings/acknowledge', {
      method: 'POST',
      cookieHeader,
      body: {
        organization_id: orgB,
        finding_id: ctx.findingAId,
        comment: 'wrong org in body',
      },
    })
    const rejected =
      json?.ok === false && (httpStatus === 403 || httpStatus === 404 || httpStatus === 400)
    report.steps.push(
      stepRecord('neg_wrong_org_id', rejected ? 'pass' : 'fail', {
        detail: rejected ? `rejected http=${httpStatus}` : 'expected rejection',
        http_status: httpStatus,
        actual: json?.code,
      }),
    )
    rejected ? report.summary.passed++ : report.summary.failed++
  } else {
    report.steps.push(stepRecord('neg_wrong_org_id', 'skip', { detail: 'org B not available' }))
    report.summary.skipped++
  }

  {
    const { json, httpStatus } = await apiFetch(base, '/api/source/findings/resolve', {
      method: 'POST',
      cookieHeader,
      body: {
        organization_id: orgId,
        finding_id: ctx.findingAId,
        resolution_text: '   ',
      },
    })
    const rejected = httpStatus === 400 && json?.ok === false && json?.code === 'INVALID_REQUEST'
    report.steps.push(
      stepRecord('neg_resolve_no_text', rejected ? 'pass' : 'fail', {
        detail: rejected ? 'INVALID_REQUEST' : JSON.stringify(json?.code),
        http_status: httpStatus,
      }),
    )
    rejected ? report.summary.passed++ : report.summary.failed++
  }

  {
    const { json, httpStatus } = await apiFetch(base, '/api/source/findings/waive', {
      method: 'POST',
      cookieHeader,
      body: {
        organization_id: orgId,
        finding_id: ctx.findingBId,
        waiver_reason: '   ',
      },
    })
    const rejected = httpStatus === 400 && json?.ok === false && json?.code === 'INVALID_REQUEST'
    report.steps.push(
      stepRecord('neg_waive_no_reason', rejected ? 'pass' : 'fail', {
        detail: rejected ? 'INVALID_REQUEST' : JSON.stringify(json?.code),
        http_status: httpStatus,
      }),
    )
    rejected ? report.summary.passed++ : report.summary.failed++
  }

  {
    const fakeId = '00000000-0000-4000-8000-000000000099'
    const { json, httpStatus } = await apiFetch(base, '/api/source/findings/acknowledge', {
      method: 'POST',
      cookieHeader,
      body: {
        organization_id: orgId,
        finding_id: fakeId,
        comment: 'fake',
      },
    })
    const rejected = json?.ok === false && httpStatus >= 400
    report.steps.push(
      stepRecord('neg_fake_finding_id', rejected ? 'pass' : 'fail', {
        detail: rejected ? `rejected http=${httpStatus} code=${json?.code}` : 'expected failure',
        http_status: httpStatus,
      }),
    )
    rejected ? report.summary.passed++ : report.summary.failed++
  }

  {
    const { json, httpStatus } = await apiFetch(base, '/api/source/findings/acknowledge', {
      method: 'POST',
      cookieHeader,
      body: {
        organization_id: orgId,
        finding_id: ctx.findingAId,
        comment: 'phase55b e2e acknowledge',
      },
    })
    const env = assertApiEnvelope(json, { expectedRpc: ACK_FINDING_RPC, requireOk: true })
    const ok = env.ok && json.ok && httpStatus === 200
    report.steps.push(
      stepRecord('finding_acknowledge', ok ? 'pass' : 'fail', {
        detail: ok ? 'acknowledged finding A' : env.issues.join('; '),
        rpc: ACK_FINDING_RPC,
        http_status: httpStatus,
      }),
    )
    ok ? report.summary.passed++ : report.summary.failed++
    if (!ok) {
      report.ok = false
      return
    }
  }

  envelopes = await readBundle(ctx.responseSetId)
  {
    const result = assertPostFindingActionRead({
      envelopes,
      modules,
      findingId: ctx.findingAId,
      expectedStatus: 'acknowledged',
      expectedEligibility: { canAcknowledge: false, canResolve: true, canWaive: true },
    })
    report.steps.push(
      stepRecord('finding_acknowledge_read', result.ok ? 'pass' : 'fail', {
        detail: result.ok ? 'acknowledged read contract ok' : result.issues.join('; '),
        errors: result.ok ? null : result.issues,
      }),
    )
    result.ok ? report.summary.passed++ : report.summary.failed++
    if (!result.ok) {
      report.ok = false
      return
    }
  }

  {
    const { json, httpStatus } = await apiFetch(base, '/api/source/findings/resolve', {
      method: 'POST',
      cookieHeader,
      body: {
        organization_id: orgId,
        finding_id: ctx.findingAId,
        resolution_text: 'phase55b e2e resolved',
      },
    })
    const env = assertApiEnvelope(json, { expectedRpc: RESOLVE_FINDING_RPC, requireOk: true })
    const ok = env.ok && json.ok && httpStatus === 200
    report.steps.push(
      stepRecord('finding_resolve', ok ? 'pass' : 'fail', {
        detail: ok
          ? 'resolved finding A'
          : `${env.issues.join('; ') || json?.code} ${json?.errors?.[0]?.message ?? ''}`.trim(),
        rpc: RESOLVE_FINDING_RPC,
        http_status: httpStatus,
        actual: json,
      }),
    )
    ok ? report.summary.passed++ : report.summary.failed++
    if (!ok) {
      report.ok = false
      return
    }
  }

  envelopes = await readBundle(ctx.responseSetId)
  {
    const result = assertPostFindingActionRead({
      envelopes,
      modules,
      findingId: ctx.findingAId,
      expectedStatus: 'resolved',
      expectedEligibility: { canAcknowledge: false, canResolve: false, canWaive: false },
    })
    report.steps.push(
      stepRecord('finding_resolve_read', result.ok ? 'pass' : 'fail', {
        detail: result.ok ? 'resolved read contract ok' : result.issues.join('; '),
        errors: result.ok ? null : result.issues,
      }),
    )
    result.ok ? report.summary.passed++ : report.summary.failed++
  }

  {
    const { json, httpStatus } = await apiFetch(base, '/api/source/findings/acknowledge', {
      method: 'POST',
      cookieHeader,
      body: {
        organization_id: orgId,
        finding_id: ctx.findingAId,
        comment: 'should not ack resolved',
      },
    })
    const rejected = json?.ok === false && httpStatus >= 400
    report.steps.push(
      stepRecord('neg_invalid_transition', rejected ? 'pass' : 'fail', {
        detail: rejected
          ? `invalid transition rejected http=${httpStatus} code=${json?.code}`
          : 'expected RPC rejection on resolved finding',
        http_status: httpStatus,
        actual: json?.code,
      }),
    )
    rejected ? report.summary.passed++ : report.summary.failed++
  }

  {
    const { json, httpStatus } = await apiFetch(base, '/api/source/findings/waive', {
      method: 'POST',
      cookieHeader,
      body: {
        organization_id: orgId,
        finding_id: ctx.findingBId,
        waiver_reason: 'phase55b e2e waiver — documented exception',
      },
    })
    const env = assertApiEnvelope(json, { expectedRpc: WAIVE_FINDING_RPC, requireOk: true })
    const ok = env.ok && json.ok && httpStatus === 200
    report.steps.push(
      stepRecord('finding_waive', ok ? 'pass' : 'fail', {
        detail: ok ? 'waived finding B' : env.issues.join('; '),
        rpc: WAIVE_FINDING_RPC,
        http_status: httpStatus,
      }),
    )
    ok ? report.summary.passed++ : report.summary.failed++
    if (!ok) {
      report.ok = false
      return
    }
  }

  envelopes = await readBundle(ctx.responseSetId)
  {
    const result = assertPostFindingActionRead({
      envelopes,
      modules,
      findingId: ctx.findingBId,
      expectedStatus: 'waived',
      expectedEligibility: { canAcknowledge: false, canResolve: false, canWaive: false },
    })
    report.steps.push(
      stepRecord('finding_waive_read', result.ok ? 'pass' : 'fail', {
        detail: result.ok ? 'waived read contract ok' : result.issues.join('; '),
        errors: result.ok ? null : result.issues,
      }),
    )
    result.ok ? report.summary.passed++ : report.summary.failed++
  }

  {
    const a = await readBundle(ctx.responseSetId)
    const b = await readBundle(ctx.responseSetId)
    const fpA = stableFingerprint(
      modules.normalizeFindingsPanel(
        a.findings.body.data,
        ctx.responseSetId,
        orgId,
        a.findings.body.data?.filters_applied ?? {},
      ),
    )
    const fpB = stableFingerprint(
      modules.normalizeFindingsPanel(
        b.findings.body.data,
        ctx.responseSetId,
        orgId,
        b.findings.body.data?.filters_applied ?? {},
      ),
    )
    const countsA = manifestFindingCounts(a.manifest.body)
    const countsB = manifestFindingCounts(b.manifest.body)
    const histA = a.history.body?.data?.event_count ?? a.history.body?.data?.events?.length
    const histB = b.history.body?.data?.event_count ?? b.history.body?.data?.events?.length
    const ok =
      fpA === fpB &&
      countsA.total === countsB.total &&
      countsA.open === countsB.open &&
      histA === histB &&
      assertReadApiEnvelope(a.findings.body, 'findings', { requireOk: true }).ok
    report.steps.push(
      stepRecord('findings_determinism', ok ? 'pass' : 'fail', {
        detail: ok
          ? `stable findings fp; total=${countsA.total}; events=${histA}`
          : `fp=${fpA === fpB} counts/open ${countsA.total}/${countsB.total} events ${histA}/${histB}`,
        actual: { fpMatch: fpA === fpB, countsA, countsB, histA, histB },
      }),
    )
    ok ? report.summary.passed++ : report.summary.failed++
  }

  {
    const href = `/source/response-set/${ctx.responseSetId}?organization_id=${orgId}`
    const { httpStatus } = await apiFetch(base, href, { cookieHeader })
    const ok = httpStatus === 200
    report.steps.push(
      stepRecord('findings_review_route', ok ? 'pass' : 'fail', {
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
    phase: '5.5B',
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
    `Phase 5.5B findings action E2E [${report.mode}]: pass=${passed} fail=${failed} skip=${skipped} blocked=${blocked} planned=${planned}`,
  )
  console.log(`Report: ${REPORT_PATH}`)
  if (report.gaps.length) console.log('Gaps:', report.gaps.join('; '))
  process.exit(report.ok ? 0 : 1)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
