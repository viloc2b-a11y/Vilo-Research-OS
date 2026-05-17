/**
 * Phase 5.1B Step 3 — Runtime API E2E + contract hardening for Source change-control routes.
 *
 * Default: planning (no HTTP). Live: --live with Next.js running + E2E_API_BASE_URL.
 *
 *   npm run db:validate-phase51b-runtime-api-e2e
 *   npm run db:validate-phase51b-runtime-api-e2e:live -- --organization-id ... (see --help)
 *
 * Report: tmp/runtime-e2e/phase51b-runtime-api-e2e-report.json
 */

import { mkdirSync, writeFileSync, existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import postgres from 'postgres'
import { loadEnvFiles, projectRoot, requireEnv } from './lib/env.mjs'
import {
  SYNTHETIC,
  assertApiEnvelope,
  signInForCookieHeader,
  apiFetch,
  historyEvents,
  historyFingerprint,
  isChronological,
  responseValueSnapshot,
  valueForWidget,
  correctionValueForWidget,
  secondCorrectionValueForWidget,
  stepRecord,
  isUuid,
} from './lib/source-api-e2e.mjs'

const ROOT = projectRoot
const REPORT_DIR = join(ROOT, 'tmp/runtime-e2e')
const REPORT_PATH = join(REPORT_DIR, 'phase51b-runtime-api-e2e-report.json')

const STEP_DEFINITIONS = [
  { id: 'fixture_submitted_set', title: 'RPC fixture: publish/open/save/submit response set' },
  { id: 'auth_unauthenticated', title: 'Unauthenticated API calls rejected' },
  { id: 'auth_invalid_request', title: 'Malformed organization_id rejected' },
  { id: 'auth_wrong_tenant', title: 'Cross-org member denied' },
  { id: 'correction_api', title: 'POST /api/source/response/correct' },
  { id: 'correction_lineage', title: 'Prior response immutable; new current row' },
  { id: 'correction_repeat', title: 'Second correction preserves prior versions' },
  { id: 'addendum_api', title: 'POST /api/source/response-set/addendum' },
  { id: 'addendum_preserved', title: 'Submitted responses unchanged after addendum' },
  { id: 'finding_resolve_path', title: 'Finding open → acknowledged → resolved via API' },
  { id: 'finding_waive_path', title: 'Finding open → waived via API' },
  { id: 'history_chronology', title: 'GET history chronological + event kinds' },
  { id: 'history_replay', title: 'Repeated history reads deterministic' },
  { id: 'history_read_no_mutation', title: 'History GET does not mutate rows' },
  { id: 'pagination_placeholder', title: 'limit/cursor echoed in meta.pagination', profile: 'full' },
]

function parseArgs(argv) {
  const args = {
    live: false,
    profile: 'basic',
    baseUrl: process.env.E2E_API_BASE_URL?.trim() || 'http://localhost:3000',
    skipPublish: false,
    skipFixture: false,
    organizationId: null,
    orgBId: null,
    studyId: null,
    studyVersionId: null,
    studySubjectId: null,
    visitId: null,
    procedureExecutionId: null,
    actorUserId: null,
    responseSetId: null,
    publishPackage: join(ROOT, 'tmp/publish/source-publish-package.golden-basic.json'),
    sourceDefinitions: join(ROOT, 'tmp/compiled/source-definitions.golden-basic.json'),
    approval: join(ROOT, 'tmp/approvals/source-preview-approval.golden-basic.json'),
  }

  for (let i = 2; i < argv.length; i++) {
    const a = argv[i]
    const next = () => argv[++i]
    if (a === '--live') args.live = true
    else if (a === '--profile') args.profile = next()
    else if (a === '--base-url') args.baseUrl = next()
    else if (a === '--skip-publish') args.skipPublish = true
    else if (a === '--skip-fixture') args.skipFixture = true
    else if (a === '--organization-id') args.organizationId = next()
    else if (a === '--org-b-id') args.orgBId = next()
    else if (a === '--study-id') args.studyId = next()
    else if (a === '--study-version-id') args.studyVersionId = next()
    else if (a === '--study-subject-id') args.studySubjectId = next()
    else if (a === '--visit-id') args.visitId = next()
    else if (a === '--procedure-execution-id') args.procedureExecutionId = next()
    else if (a === '--actor-user-id') args.actorUserId = next()
    else if (a === '--response-set-id') args.responseSetId = next()
    else if (a === '--help' || a === '-h') {
      printHelp()
      process.exit(0)
    } else {
      console.error('Unknown argument:', a)
      printHelp()
      process.exit(1)
    }
  }

  if (args.profile !== 'basic' && args.profile !== 'full') {
    console.error('--profile must be basic or full')
    process.exit(1)
  }

  return args
}

function printHelp() {
  console.log(`Phase 5.1B Source API runtime E2E

Options:
  --live                    Execute HTTP + DB assertions (requires Next dev server)
  --profile basic|full      full adds pagination placeholder probe
  --base-url <url>          Default: E2E_API_BASE_URL or http://localhost:3000
  --skip-publish            Use existing published SDVs
  --skip-fixture            Use --response-set-id (must be submitted)
  --organization-id <uuid>  Synthetic Site Alpha org
  --org-b-id <uuid>         Synthetic Site Beta (cross-tenant); auto-discovered when omitted
  --study-id / --study-version-id / --study-subject-id / --visit-id / --procedure-execution-id
  --actor-user-id <uuid>
  --response-set-id <uuid>  Skip RPC fixture when submitted set already exists

Prerequisites (live):
  npm run dev
  node scripts/discover-e2e-staging-ids.mjs [--fresh]
  npm run db:validate-phase4b-runtime

See docs/PHASE5.1B-RUNTIME-API-E2E-HARNESS.md
`)
}

function stepApplies(step, profile) {
  if (step.profile && step.profile !== profile) return false
  return true
}

function pickDatabaseUrl() {
  return process.env.DATABASE_URL_DIRECT?.trim() || process.env.DATABASE_URL?.trim() || null
}

function isPooler(url) {
  try {
    const u = new URL(url)
    return u.hostname.includes('pooler.supabase.com') || u.port === '6543'
  } catch {
    return false
  }
}

async function connectPostgres() {
  const url = pickDatabaseUrl()
  if (!url) return null
  const sql = postgres(url, {
    ssl: 'require',
    max: 1,
    connect_timeout: 25,
    prepare: isPooler(url) ? false : undefined,
  })
  await sql`select 1`
  return sql
}

async function withActor(sql, actorUserId, fn) {
  return sql.begin(async (tx) => {
    await tx`select set_config('role', 'authenticated', true)`
    await tx`select set_config('request.jwt.claim.sub', ${actorUserId}, true)`
    return fn(tx)
  })
}

async function callRpc(tx, fnName, casts, values) {
  const placeholders = casts.map((c, i) => `$${i + 1}${c}`).join(', ')
  const query = `select public.${fnName}(${placeholders}) as result`
  const rows = await tx.unsafe(query, values)
  const raw = rows[0]?.result
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw)
    } catch {
      return raw
    }
  }
  return raw
}

function rpcOk(result) {
  return Boolean(result && typeof result === 'object' && result.ok === true)
}

function loadJson(path) {
  if (!existsSync(path)) return { error: `missing ${path}` }
  try {
    return { data: JSON.parse(readFileSync(path, 'utf8')) }
  } catch (e) {
    return { error: e.message }
  }
}

function firstSdvFromPublish(result) {
  const ids = result?.phase4a_source_definition_version_ids ?? result?.data?.phase4a_source_definition_version_ids
  if (Array.isArray(ids) && ids.length) return ids[0]
  if (ids && typeof ids === 'object') return Object.values(ids)[0]
  return null
}

async function discoverOrgB(sql) {
  const rows = await sql`
    select id from public.organizations
    where name ilike '%Synthetic Site Beta%'
    limit 1
  `
  return rows[0]?.id ?? null
}

async function loadFieldWidget(sql, fieldId) {
  const rows = await sql`select widget_hint from public.source_fields where id = ${fieldId}::uuid`
  return rows[0]?.widget_hint ?? 'text'
}

async function resolveAddendumField(sql, responseSetId, sdvId) {
  const rows = await sql`
    select sf.id, sf.widget_hint
    from public.source_fields sf
    where sf.source_definition_version_id = ${sdvId}::uuid
      and not exists (
        select 1 from public.source_responses sr
        where sr.response_set_id = ${responseSetId}::uuid
          and sr.source_field_id = sf.id
          and sr.is_current = true
      )
    order by sf.is_required asc, sf.field_key
    limit 1
  `
  return rows[0] ?? null
}

async function setupSubmittedFixture(sql, args, ctx) {
  if (args.skipFixture && args.responseSetId) {
    ctx.responseSetId = args.responseSetId
    const set = await sql`
      select id, status, source_definition_version_id
      from public.source_response_sets where id = ${args.responseSetId}::uuid
    `
    if (!set[0]) throw new Error('response set not found')
    if (set[0].status !== 'submitted') throw new Error('response set must be submitted for 5.1B API tests')
    ctx.sdvId = set[0].source_definition_version_id
    const resp = await sql`
      select id, source_field_id from public.source_responses
      where response_set_id = ${args.responseSetId}::uuid and is_current = true
      order by created_at limit 1
    `
    ctx.responseId = resp[0]?.id
    ctx.fieldId = resp[0]?.source_field_id
    return { detail: `reused response_set_id=${ctx.responseSetId}` }
  }

  let pkg
  let defs
  let approval
  if (!args.skipPublish) {
    const p = loadJson(args.publishPackage)
    const d = loadJson(args.sourceDefinitions)
    const a = loadJson(args.approval)
    if (p.error || d.error || a.error) throw new Error([p.error, d.error, a.error].filter(Boolean).join('; '))
    pkg = p.data
    defs = d.data
    approval = a.data
    const pub = await withActor(sql, args.actorUserId, (tx) =>
      callRpc(tx, 'publish_source_package', ['::uuid', '::uuid', '::uuid', '::jsonb', '::jsonb', '::jsonb'], [
        args.organizationId,
        args.studyId,
        args.studyVersionId,
        pkg,
        defs,
        approval,
      ]),
    )
    if (!rpcOk(pub)) throw new Error(`publish failed: ${JSON.stringify(pub)}`)
    ctx.sdvId = firstSdvFromPublish(pub)
  } else {
    const sdv = await sql`
      select id from public.source_definition_versions
      where study_id = ${args.studyId}::uuid and lifecycle_status = 'published'
      order by created_at desc limit 1
    `
    ctx.sdvId = sdv[0]?.id
  }

  if (!ctx.sdvId) throw new Error('no published SDV')

  await sql`
    update public.procedure_executions
    set source_definition_version_id = ${ctx.sdvId}::uuid
    where id = ${args.procedureExecutionId}::uuid
      and organization_id = ${args.organizationId}::uuid
  `

  const opened = await withActor(sql, args.actorUserId, (tx) =>
    callRpc(tx, 'open_source_response_set', [
      '::uuid', '::uuid', '::uuid', '::uuid', '::uuid', '::uuid', '::uuid',
    ], [
      args.organizationId,
      args.studyId,
      args.studyVersionId,
      args.studySubjectId,
      args.visitId,
      args.procedureExecutionId,
      ctx.sdvId,
    ]),
  )
  if (!rpcOk(opened)) throw new Error(`open failed: ${JSON.stringify(opened)}`)
  ctx.responseSetId = opened.data?.source_response_set_id ?? opened.data?.response_set_id

  const setRow = await sql`
    select status, source_definition_version_id
    from public.source_response_sets where id = ${ctx.responseSetId}::uuid
  `
  const status = setRow[0]?.status
  if (status === 'submitted') {
    ctx.sdvId = setRow[0].source_definition_version_id ?? ctx.sdvId
    const resp = await sql`
      select id, source_field_id from public.source_responses
      where response_set_id = ${ctx.responseSetId}::uuid and is_current = true
      order by created_at desc limit 1
    `
    ctx.responseId = resp[0]?.id
    ctx.fieldId = resp[0]?.source_field_id
    if (!ctx.responseId) throw new Error('submitted set has no current response')
    return {
      detail: `reused submitted set response_set_id=${ctx.responseSetId}`,
      key_ids: { response_set_id: ctx.responseSetId, response_id: ctx.responseId, sdv_id: ctx.sdvId },
    }
  }

  const field = await sql`
    select sf.id from public.source_fields sf
    where sf.source_definition_version_id = ${ctx.sdvId}::uuid
    order by sf.is_required desc, sf.field_key limit 1
  `
  ctx.fieldId = field[0]?.id
  if (!ctx.fieldId) throw new Error('no source field')

  const widget = await loadFieldWidget(sql, ctx.fieldId)
  const draft = await withActor(sql, args.actorUserId, (tx) =>
    callRpc(tx, 'save_source_draft', ['::uuid', '::uuid', '::jsonb'], [
      args.organizationId,
      ctx.responseSetId,
      [{ source_field_id: ctx.fieldId, ...valueForWidget(widget) }],
    ]),
  )
  if (!rpcOk(draft)) throw new Error(`save draft failed: ${JSON.stringify(draft)}`)

  const responses = await sql`
    select id from public.source_responses
    where response_set_id = ${ctx.responseSetId}::uuid and source_field_id = ${ctx.fieldId}::uuid and is_current = true
    limit 1
  `
  ctx.responseId = responses[0]?.id

  const submitted = await withActor(sql, args.actorUserId, (tx) =>
    callRpc(tx, 'submit_source_response_set', ['::uuid', '::uuid', '::text'], [
      args.organizationId,
      ctx.responseSetId,
      'phase51b api e2e fixture',
    ]),
  )
  if (!rpcOk(submitted)) throw new Error(`submit failed: ${JSON.stringify(submitted)}`)

  return {
    detail: `fixture response_set_id=${ctx.responseSetId} response_id=${ctx.responseId}`,
    key_ids: { response_set_id: ctx.responseSetId, response_id: ctx.responseId, sdv_id: ctx.sdvId },
  }
}

function validateLiveIds(args) {
  const issues = []
  const required = [
    ['organizationId', '--organization-id'],
    ['studyId', '--study-id'],
    ['studyVersionId', '--study-version-id'],
    ['studySubjectId', '--study-subject-id'],
    ['visitId', '--visit-id'],
    ['procedureExecutionId', '--procedure-execution-id'],
    ['actorUserId', '--actor-user-id'],
  ]
  if (args.skipFixture) {
    if (!args.responseSetId) issues.push('--response-set-id required with --skip-fixture')
    else if (!isUuid(args.responseSetId)) issues.push('--response-set-id must be UUID')
  } else {
    for (const [k, flag] of required) {
      if (!args[k]) issues.push(`missing ${flag}`)
      else if (!isUuid(args[k])) issues.push(`${flag} must be UUID`)
    }
  }
  if (args.organizationId && !isUuid(args.organizationId)) issues.push('--organization-id must be UUID')
  return issues
}

function planningRun(args, report) {
  for (const s of STEP_DEFINITIONS) {
    if (!stepApplies(s, args.profile)) continue
    const detail = args.live
      ? 'live mode — will execute when prerequisites met'
      : 'planning — run with --live (Next.js + staging IDs)'
    report.steps.push(stepRecord(s.id, 'planned', { detail }))
    report.summary.planned++
  }
  report.ok = true
}

async function liveRun(args, report, sql, sessions) {
  const ctx = {
    sdvId: null,
    responseSetId: null,
    responseId: null,
    priorResponseId: null,
    fieldId: null,
    findingResolveId: null,
    findingWaiveId: null,
    widgetHint: 'text',
    addendumApplied: false,
    correctionApplied: false,
    findingResolveDone: false,
    findingWaiveDone: false,
  }

  const issues = validateLiveIds(args)
  if (issues.length) {
    for (const s of STEP_DEFINITIONS) {
      if (!stepApplies(s, args.profile)) continue
      report.steps.push(stepRecord(s.id, 'blocked', { detail: issues.join('; ') }))
      report.summary.blocked++
    }
    report.ok = false
    return
  }

  if (!args.orgBId) args.orgBId = await discoverOrgB(sql)

  async function runStep(id, runner) {
    const def = STEP_DEFINITIONS.find((s) => s.id === id)
    if (!stepApplies(def ?? { id }, args.profile)) {
      report.steps.push(stepRecord(id, 'skip', { detail: 'profile skip' }))
      report.summary.skipped++
      return { status: 'skip' }
    }
    try {
      const outcome = await runner()
      report.steps.push(
        stepRecord(id, outcome.status, {
          detail: outcome.detail ?? '',
          route: outcome.route ?? null,
          rpc: outcome.rpc ?? null,
          http_status: outcome.http_status ?? null,
          expected: outcome.expected ?? null,
          actual: outcome.actual ?? null,
          key_ids: outcome.key_ids ?? {},
          errors: outcome.errors ?? null,
        }),
      )
      if (outcome.status === 'pass') report.summary.passed++
      else if (outcome.status === 'skip') report.summary.skipped++
      else report.summary.failed++
      return outcome
    } catch (e) {
      report.steps.push(stepRecord(id, 'fail', { detail: e.message, errors: e.message }))
      report.summary.failed++
      return { status: 'fail' }
    }
  }

  await runStep('fixture_submitted_set', async () => {
    const out = await setupSubmittedFixture(sql, args, ctx)
    ctx.widgetHint = await loadFieldWidget(sql, ctx.fieldId)
    return { status: 'pass', ...out }
  })

  const fixtureStep = report.steps.find((s) => s.id === 'fixture_submitted_set')
  if (!ctx.responseSetId || fixtureStep?.status !== 'pass') {
    report.ok = false
    report.gaps.push('fixture_submitted_set failed — downstream API steps skipped')
    return
  }

  const cookieA = sessions.a.cookieHeader
  const orgId = args.organizationId
  const base = args.baseUrl

  await runStep('auth_unauthenticated', async () => {
    const { res, json, httpStatus } = await apiFetch(base, '/api/source/response/correct', {
      method: 'POST',
      body: {
        organization_id: orgId,
        source_response_id: ctx.responseId,
        corrected_value: { value_text: 'x' },
        correction_reason: 'no auth',
      },
    })
    const env = assertApiEnvelope(json, { expectedRpc: 'correct_source_response' })
    const rejected =
      httpStatus === 401 ||
      (json?.ok === false && (json?.code === 'UNAUTHORIZED' || json?.errors?.[0]?.code === 'UNAUTHORIZED'))
    return {
      status: rejected && env.ok ? 'pass' : 'fail',
      detail: rejected ? `rejected http=${httpStatus}` : `expected 401 envelope, got ${httpStatus}`,
      route: 'POST /api/source/response/correct',
      http_status: httpStatus,
      actual: { httpStatus, envelope: env.issues.length ? env.issues : json?.code },
    }
  })

  await runStep('auth_invalid_request', async () => {
    const { json, httpStatus } = await apiFetch(base, '/api/source/findings/create', {
      method: 'POST',
      cookieHeader: cookieA,
      body: {
        organization_id: 'not-a-uuid',
        source_response_set_id: ctx.responseSetId,
        finding_type: 'required',
        severity: 'warning',
        finding_text: 'bad org',
      },
    })
    const env = assertApiEnvelope(json)
    const rejected = httpStatus === 400 && json?.ok === false && json?.code === 'INVALID_REQUEST'
    return {
      status: rejected && env.ok ? 'pass' : 'fail',
      detail: rejected ? 'INVALID_REQUEST' : JSON.stringify(json),
      route: 'POST /api/source/findings/create',
      http_status: httpStatus,
      actual: json,
    }
  })

  await runStep('auth_wrong_tenant', async () => {
    if (!args.orgBId) {
      return { status: 'skip', detail: 'org B not discovered' }
    }
    const { json: body, httpStatus: http2 } = await apiFetch(
      base,
      `/api/source/response-set/${ctx.responseSetId}/history?organization_id=${orgId}`,
      { cookieHeader: sessions.b.cookieHeader },
    )
    const env = assertApiEnvelope(body)
    const denied =
      http2 === 403 ||
      (body?.ok === false && (body?.code === 'FORBIDDEN' || body?.errors?.[0]?.code === 'FORBIDDEN'))
    return {
      status: denied && env.ok ? 'pass' : 'fail',
      detail: denied ? `forbidden http=${http2}` : JSON.stringify(body),
      route: 'GET /api/source/response-set/[id]/history',
      http_status: http2,
      actual: body,
    }
  })

  let priorHash = null
  let priorResponseId = ctx.responseId

  await runStep('correction_api', async () => {
    const prior = await sql`
      select value_text, value_number, value_boolean, value_date, value_datetime, is_submitted
      from public.source_responses where id = ${ctx.responseId}::uuid
    `
    priorHash = responseValueSnapshot(prior[0])
    const payload = correctionValueForWidget(ctx.widgetHint)
    const { json, httpStatus } = await apiFetch(base, '/api/source/response/correct', {
      method: 'POST',
      cookieHeader: cookieA,
      body: {
        organization_id: orgId,
        source_response_id: ctx.responseId,
        corrected_value: payload,
        correction_reason: 'phase51b e2e correction 1',
      },
    })
    const env = assertApiEnvelope(json, { expectedRpc: 'correct_source_response', requireOk: true })
    if (!env.ok || !json.ok) {
      return {
        status: 'fail',
        detail: env.issues.join('; ') || json?.code,
        route: 'POST /api/source/response/correct',
        http_status: httpStatus,
        actual: json,
      }
    }
    const newId = json.data?.replacement_response_id ?? json.data?.response_id
    if (newId) ctx.responseId = newId
    ctx.correctionApplied = true
    return {
      status: 'pass',
      detail: `corrected response_id=${ctx.responseId}`,
      route: 'POST /api/source/response/correct',
      rpc: 'correct_source_response',
      http_status: httpStatus,
      key_ids: { response_id: ctx.responseId },
      actual: { code: json.code, data_keys: Object.keys(json.data ?? {}) },
    }
  })

  await runStep('correction_lineage', async () => {
    if (!ctx.correctionApplied) {
      return { status: 'skip', detail: 'correction_api did not succeed' }
    }
    const afterPrior = await sql`
      select value_text, value_number, value_boolean, value_date, value_datetime, is_submitted
      from public.source_responses where id = ${priorResponseId}::uuid
    `
    const unchanged = responseValueSnapshot(afterPrior[0]) === priorHash && afterPrior[0]?.is_submitted === true
    const current = await sql`
      select id, is_current from public.source_responses
      where response_set_id = ${ctx.responseSetId}::uuid and source_field_id = ${ctx.fieldId}::uuid and is_current = true
    `
    return {
      status: unchanged && current[0]?.id === ctx.responseId ? 'pass' : 'fail',
      detail: unchanged
        ? 'prior row immutable; new current row active'
        : 'lineage check failed',
      key_ids: { prior_response_id: priorResponseId, current_response_id: current[0]?.id },
    }
  })

  await runStep('correction_repeat', async () => {
    if (!ctx.correctionApplied) {
      return { status: 'skip', detail: 'correction_api did not succeed' }
    }
    const beforeCount = await sql`
      select count(*)::int as c from public.source_response_corrections src
      join public.source_responses sr on sr.id = src.superseded_response_id
      where sr.response_set_id = ${ctx.responseSetId}::uuid
    `
    const payload = secondCorrectionValueForWidget(ctx.widgetHint)
    const { json, httpStatus } = await apiFetch(base, '/api/source/response/correct', {
      method: 'POST',
      cookieHeader: cookieA,
      body: {
        organization_id: orgId,
        source_response_id: ctx.responseId,
        corrected_value: payload,
        correction_reason: 'phase51b e2e correction 2',
      },
    })
    const env = assertApiEnvelope(json, { expectedRpc: 'correct_source_response', requireOk: true })
    const afterCount = await sql`
      select count(*)::int as c from public.source_response_corrections src
      join public.source_responses sr on sr.id = src.superseded_response_id
      where sr.response_set_id = ${ctx.responseSetId}::uuid
    `
    const priorStill = await sql`
      select is_submitted from public.source_responses where id = ${priorResponseId}::uuid
    `
    if (json.data?.replacement_response_id) ctx.responseId = json.data.replacement_response_id
    const ok =
      env.ok &&
      json.ok &&
      afterCount[0].c >= beforeCount[0].c + 1 &&
      priorStill[0]?.is_submitted === true
    return {
      status: ok ? 'pass' : 'fail',
      detail: `corrections ${beforeCount[0].c} -> ${afterCount[0].c}`,
      http_status: httpStatus,
      actual: json?.code,
    }
  })

  const submittedBefore = await sql`
    select id, source_field_id, value_text, value_number, value_boolean, value_date, is_submitted
    from public.source_responses
    where response_set_id = ${ctx.responseSetId}::uuid and is_submitted = true
  `

  await runStep('addendum_api', async () => {
    const field = await resolveAddendumField(sql, ctx.responseSetId, ctx.sdvId)
    if (!field?.id) {
      return { status: 'skip', detail: 'NO_ADDENDUM_ELIGIBLE_FIELD' }
    }
    ctx.addendumFieldId = field.id
    const { json, httpStatus } = await apiFetch(base, '/api/source/response-set/addendum', {
      method: 'POST',
      cookieHeader: cookieA,
      body: {
        organization_id: orgId,
        source_response_set_id: ctx.responseSetId,
        source_field_id: field.id,
        addendum_text: 'phase51b e2e addendum',
        reason: 'late entry e2e',
      },
    })
    const env = assertApiEnvelope(json, { expectedRpc: 'add_source_addendum', requireOk: true })
    if (env.ok && json.ok) ctx.addendumApplied = true
    return {
      status: env.ok && json.ok ? 'pass' : 'fail',
      detail: env.ok ? `addendum field=${field.id}` : env.issues.join('; '),
      route: 'POST /api/source/response-set/addendum',
      rpc: 'add_source_addendum',
      http_status: httpStatus,
      actual: json,
    }
  })

  await runStep('addendum_preserved', async () => {
    const after = await sql`
      select id, source_field_id, value_text, value_number, value_boolean, value_date, is_submitted
      from public.source_responses
      where response_set_id = ${ctx.responseSetId}::uuid and is_submitted = true
    `
    const preserved = submittedBefore.every((row) => {
      const match = after.find((r) => r.id === row.id)
      return match && JSON.stringify(match) === JSON.stringify(row)
    })
    return {
      status: preserved ? 'pass' : 'fail',
      detail: preserved ? 'submitted snapshot rows unchanged' : 'submitted row mutation detected',
    }
  })

  await runStep('finding_resolve_path', async () => {
    const create = await apiFetch(base, '/api/source/findings/create', {
      method: 'POST',
      cookieHeader: cookieA,
      body: {
        organization_id: orgId,
        source_response_set_id: ctx.responseSetId,
        finding_type: 'required',
        severity: 'warning',
        finding_text: 'phase51b e2e finding resolve path',
        source_response_id: ctx.responseId,
        source_field_id: ctx.fieldId,
        rule_reference: 'E2E_51B_RESOLVE',
      },
    })
    let env = assertApiEnvelope(create.json, {
      expectedRpc: 'create_source_validation_finding',
      requireOk: true,
    })
    if (!env.ok || !create.json.ok) {
      return { status: 'fail', detail: 'create failed', actual: create.json }
    }
    ctx.findingResolveId = create.json.data?.finding_id

    const ack = await apiFetch(base, '/api/source/findings/acknowledge', {
      method: 'POST',
      cookieHeader: cookieA,
      body: {
        organization_id: orgId,
        finding_id: ctx.findingResolveId,
        comment: 'e2e acknowledge',
      },
    })
    env = assertApiEnvelope(ack.json, {
      expectedRpc: 'acknowledge_source_validation_finding',
      requireOk: true,
    })
    if (!env.ok || !ack.json.ok) return { status: 'fail', detail: 'ack failed', actual: ack.json }

    const resolve = await apiFetch(base, '/api/source/findings/resolve', {
      method: 'POST',
      cookieHeader: cookieA,
      body: {
        organization_id: orgId,
        finding_id: ctx.findingResolveId,
        resolution_text: 'e2e resolved',
      },
    })
    env = assertApiEnvelope(resolve.json, {
      expectedRpc: 'resolve_source_validation_finding',
      requireOk: true,
    })
    const events = await sql`
      select new_status, actor_user_id from public.source_response_validation_finding_events
      where finding_id = ${ctx.findingResolveId}::uuid
      order by occurred_at
    `
    const kinds = events.map((e) => e.new_status)
    const ok =
      env.ok &&
      resolve.json.ok &&
      kinds.includes('acknowledged') &&
      kinds.includes('resolved')
    if (ok) ctx.findingResolveDone = true
    return {
      status: ok ? 'pass' : 'fail',
      detail: `lifecycle events: ${kinds.join(' -> ')}`,
      key_ids: { finding_id: ctx.findingResolveId },
    }
  })

  await runStep('finding_waive_path', async () => {
    const create = await apiFetch(base, '/api/source/findings/create', {
      method: 'POST',
      cookieHeader: cookieA,
      body: {
        organization_id: orgId,
        source_response_set_id: ctx.responseSetId,
        finding_type: 'range',
        severity: 'info',
        finding_text: 'phase51b e2e finding waive path',
        rule_reference: 'E2E_51B_WAIVE',
      },
    })
    const envCreate = assertApiEnvelope(create.json, {
      expectedRpc: 'create_source_validation_finding',
      requireOk: true,
    })
    if (!envCreate.ok) return { status: 'fail', detail: 'create failed', actual: create.json }
    ctx.findingWaiveId = create.json.data?.finding_id

    const waive = await apiFetch(base, '/api/source/findings/waive', {
      method: 'POST',
      cookieHeader: cookieA,
      body: {
        organization_id: orgId,
        finding_id: ctx.findingWaiveId,
        waiver_reason: 'e2e waiver — documented exception',
      },
    })
    const env = assertApiEnvelope(waive.json, {
      expectedRpc: 'waive_source_validation_finding',
      requireOk: true,
    })
    const events = await sql`
      select new_status, actor_user_id from public.source_response_validation_finding_events
      where finding_id = ${ctx.findingWaiveId}::uuid
      order by occurred_at
    `
    const kinds = events.map((e) => e.new_status)
    const ok = env.ok && waive.json.ok && kinds.includes('waived')
    if (ok) ctx.findingWaiveDone = true
    return {
      status: ok ? 'pass' : 'fail',
      detail: `events: ${kinds.join(', ')}`,
      key_ids: { finding_id: ctx.findingWaiveId },
    }
  })

  await runStep('history_chronology', async () => {
    if (!ctx.correctionApplied && !ctx.findingResolveDone && !ctx.findingWaiveDone) {
      return { status: 'skip', detail: 'no successful API mutations to verify in history' }
    }
    const path = `/api/source/response-set/${ctx.responseSetId}/history?organization_id=${orgId}`
    const { json, httpStatus } = await apiFetch(base, path, { cookieHeader: cookieA })
    const env = assertApiEnvelope(json, {
      expectedRpc: 'get_source_response_set_history',
      requireOk: true,
    })
    const events = historyEvents(json)
    const kinds = new Set(events.map((e) => e.event_kind))
    const hasCorrection = [...kinds].some((k) => String(k).includes('correct'))
    const hasAddendum = [...kinds].some((k) => String(k).includes('addendum'))
    const hasFinding = [...kinds].some((k) => String(k).includes('finding') || String(k).includes('validation'))
    const chrono = isChronological(events)
    const addendumOk = !ctx.addendumApplied || hasAddendum
    const ok = env.ok && json.ok && chrono && hasCorrection && hasFinding && addendumOk
    return {
      status: ok ? 'pass' : 'fail',
      detail: `events=${events.length} chrono=${chrono} correction=${hasCorrection} addendum=${hasAddendum} finding=${hasFinding}`,
      route: 'GET /api/source/response-set/[id]/history',
      http_status: httpStatus,
      actual: { event_count: events.length, sample_kinds: [...kinds].slice(0, 12) },
    }
  })

  await runStep('history_replay', async () => {
    const path = `/api/source/response-set/${ctx.responseSetId}/history?organization_id=${orgId}`
    const a = await apiFetch(base, path, { cookieHeader: cookieA })
    const b = await apiFetch(base, path, { cookieHeader: cookieA })
    const envA = assertApiEnvelope(a.json, { expectedRpc: 'get_source_response_set_history', requireOk: true })
    const envB = assertApiEnvelope(b.json, { expectedRpc: 'get_source_response_set_history', requireOk: true })
    const fpA = historyFingerprint(a.json)
    const fpB = historyFingerprint(b.json)
    const countA = a.json?.data?.event_count
    const countB = b.json?.data?.event_count
    const ok = envA.ok && envB.ok && fpA === fpB && countA === countB
    return {
      status: ok ? 'pass' : 'fail',
      detail: ok ? `deterministic fingerprint len=${fpA.length}` : 'history mismatch between reads',
      actual: { countA, countB, match: fpA === fpB },
    }
  })

  await runStep('history_read_no_mutation', async () => {
    const corrBefore = await sql`
      select count(*)::int as c from public.source_response_corrections src
      join public.source_responses sr on sr.id = src.superseded_response_id
      where sr.response_set_id = ${ctx.responseSetId}::uuid
    `
    const evtBefore = await sql`
      select count(*)::int as c from public.source_response_validation_finding_events
      where response_set_id = ${ctx.responseSetId}::uuid
    `
    const path = `/api/source/response-set/${ctx.responseSetId}/history?organization_id=${orgId}`
    await apiFetch(base, path, { cookieHeader: cookieA })
    await apiFetch(base, path, { cookieHeader: cookieA })
    const corrAfter = await sql`
      select count(*)::int as c from public.source_response_corrections src
      join public.source_responses sr on sr.id = src.superseded_response_id
      where sr.response_set_id = ${ctx.responseSetId}::uuid
    `
    const evtAfter = await sql`
      select count(*)::int as c from public.source_response_validation_finding_events
      where response_set_id = ${ctx.responseSetId}::uuid
    `
    const ok = corrBefore[0].c === corrAfter[0].c && evtBefore[0].c === evtAfter[0].c
    return {
      status: ok ? 'pass' : 'fail',
      detail: `corrections ${corrBefore[0].c}/${corrAfter[0].c} events ${evtBefore[0].c}/${evtAfter[0].c}`,
    }
  })

  await runStep('pagination_placeholder', async () => {
    const path = `/api/source/response-set/${ctx.responseSetId}/history?organization_id=${orgId}&limit=10&cursor=test-cursor`
    const { json, httpStatus } = await apiFetch(base, path, { cookieHeader: cookieA })
    const env = assertApiEnvelope(json, { expectedRpc: 'get_source_response_set_history', requireOk: true })
    const pag = json?.meta?.pagination
    const ok =
      env.ok &&
      pag &&
      pag.limit === 10 &&
      pag.cursor === 'test-cursor' &&
      pag.applied === false
    return {
      status: ok ? 'pass' : 'fail',
      detail: ok ? 'pagination placeholder present' : 'meta.pagination missing or wrong',
      http_status: httpStatus,
      actual: pag,
    }
  })

  report.ok = report.summary.failed === 0 && report.summary.blocked === 0
}

async function main() {
  loadEnvFiles()
  const args = parseArgs(process.argv)
  mkdirSync(REPORT_DIR, { recursive: true })

  const report = {
    phase: '5.1B',
    mode: args.live ? 'live' : 'planning',
    profile: args.profile,
    base_url: args.baseUrl,
    started_at: new Date().toISOString(),
    ok: true,
    summary: { passed: 0, failed: 0, skipped: 0, blocked: 0, planned: 0 },
    steps: [],
    gaps: [],
  }

  if (!args.live) {
    planningRun(args, report)
    finish(report)
    return
  }

  requireEnv(['NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY', 'DATABASE_URL'])
  const sql = await connectPostgres()
  if (!sql) {
    report.ok = false
    report.gaps.push('DATABASE_URL unavailable')
    finish(report)
    return
  }

  let sessions
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    sessions = {
      a: await signInForCookieHeader(url, anon, SYNTHETIC.userA),
      b: await signInForCookieHeader(url, anon, SYNTHETIC.userB),
    }
  } catch (e) {
    report.ok = false
    report.gaps.push(`auth sign-in failed: ${e.message}`)
    finish(report)
    await sql.end()
    return
  }

  try {
    const health = await fetch(args.baseUrl, { redirect: 'manual' }).catch(() => null)
    if (!health) {
      report.gaps.push(`Next.js not reachable at ${args.baseUrl} — start npm run dev`)
    }
    await liveRun(args, report, sql, sessions)
  } finally {
    await sql.end()
  }

  finish(report)
}

function finish(report) {
  report.finished_at = new Date().toISOString()
  writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2))
  const { passed, failed, skipped, blocked, planned } = report.summary
  console.log(
    `Phase 5.1B API E2E [${report.mode}/${report.profile}]: pass=${passed} fail=${failed} skip=${skipped} blocked=${blocked} planned=${planned}`,
  )
  console.log(`Report: ${REPORT_PATH}`)
  if (report.gaps.length) console.log('Gaps:', report.gaps.join('; '))
  process.exit(report.ok ? 0 : 1)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
