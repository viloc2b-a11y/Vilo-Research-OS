/**
 * Phase 5.2E — CRC capture shell E2E (open → save → submit → canonical read refresh).
 *
 *   npm run db:validate-phase52e-capture-shell-e2e
 *   npm run db:validate-phase52e-capture-shell-e2e:live -- --organization-id ... (optional PE ids)
 *
 * Report: tmp/runtime-e2e/phase52e-capture-shell-e2e-report.json
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
  responseValueSnapshot,
} from './lib/source-api-e2e.mjs'
import { loadCaptureModules } from './lib/capture-shell-import.mjs'
import { loadReadContract } from './lib/read-contract-import.mjs'
import {
  assertReadApiEnvelope,
  readRoutePath,
  stableFingerprint,
  validateLivePayloads,
} from './lib/read-contract-e2e.mjs'
import {
  assertCaptureShellViewModel,
  buildCaptureShellViewModel,
  detailFieldDisplayValue,
  prepareCaptureFixture,
  historyHasSubmitEvent,
  expectedDisplayForSavedValue,
  pickPrimaryField,
  runCaptureUnitValidations,
  WRITE_RPC,
} from './lib/capture-shell-e2e.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const REPORT_DIR = join(ROOT, 'tmp/runtime-e2e')
const REPORT_PATH = join(REPORT_DIR, 'phase52e-capture-shell-e2e-report.json')

const LIVE_STEPS = [
  { id: 'fixture_discover', title: 'Discover mutable procedure_execution for capture' },
  { id: 'auth_unauthenticated', title: 'Unauthenticated write rejected' },
  { id: 'auth_wrong_org', title: 'Cross-org open rejected' },
  { id: 'capture_open', title: 'POST /api/source/response-set/open' },
  { id: 'capture_shell_before_submit', title: 'CaptureShellViewModel editable before submit' },
  { id: 'capture_save_draft', title: 'POST /api/source/response-set/save-draft' },
  { id: 'capture_read_after_save', title: 'GET detail reflects saved value' },
  { id: 'capture_submit', title: 'POST /api/source/response-set/submit' },
  { id: 'capture_shell_after_submit', title: 'CaptureShellViewModel read-only after submit' },
  { id: 'capture_canonical_read', title: 'Canonical read bundle after submit' },
  { id: 'capture_history_submit', title: 'History includes submit chronology' },
  { id: 'capture_submitted_immutable', title: 'Submitted response rows immutable' },
  { id: 'capture_determinism', title: 'Repeated read fingerprints stable' },
  { id: 'capture_save_after_submit_denied', title: 'Save-draft denied after submit' },
  { id: 'capture_review_route', title: 'Review href route returns 200' },
]

function parseArgs(argv) {
  const args = {
    live: false,
    baseUrl: process.env.E2E_API_BASE_URL?.trim() || 'http://localhost:3000',
    organizationId: null,
    studyId: null,
    studyVersionId: null,
    studySubjectId: null,
    visitId: null,
    procedureExecutionId: null,
    orgBId: null,
    fresh: false,
  }

  for (let i = 2; i < argv.length; i++) {
    const a = argv[i]
    const next = () => argv[++i]
    if (a === '--live') args.live = true
    else if (a === '--fresh') args.fresh = true
    else if (a === '--base-url') args.baseUrl = next()
    else if (a === '--organization-id') args.organizationId = next()
    else if (a === '--study-id') args.studyId = next()
    else if (a === '--study-version-id') args.studyVersionId = next()
    else if (a === '--study-subject-id') args.studySubjectId = next()
    else if (a === '--visit-id') args.visitId = next()
    else if (a === '--procedure-execution-id') args.procedureExecutionId = next()
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
  console.log(`Phase 5.2E Capture shell E2E

Options:
  --live                         HTTP capture flow (requires npm run dev)
  --base-url <url>
  --organization-id <uuid>
  --study-id / --study-version-id / --study-subject-id / --visit-id
  --procedure-execution-id <uuid>   Skip discovery when provided
  --org-b-id <uuid>                 Cross-tenant probe
  --fresh                           Insert new visit + procedure_execution (no prior response set)

Live discovers a mutable procedure_execution when IDs omitted; use --fresh for a clean capture path.
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

function runUnitSuite(report) {
  const modules = loadCaptureModules()
  const results = runCaptureUnitValidations(modules)
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

async function discoverOrgB(sql) {
  const rows = await sql`
    select id from public.organizations
    where name ilike '%Synthetic Site Beta%'
    limit 1
  `
  return rows[0]?.id ?? null
}

async function liveRun(args, report, sql, cookieHeader) {
  const base = args.baseUrl
  const orgId = args.organizationId

  let fixture = null
  if (
    args.procedureExecutionId &&
    args.studyId &&
    args.studyVersionId &&
    args.studySubjectId &&
    args.visitId
  ) {
    fixture = {
      procedureExecutionId: args.procedureExecutionId,
      studyId: args.studyId,
      studyVersionId: args.studyVersionId,
      studySubjectId: args.studySubjectId,
      visitId: args.visitId,
      sourceDefinitionVersionId: null,
    }
    const pe = await sql`
      select source_definition_version_id from public.procedure_executions
      where id = ${args.procedureExecutionId}::uuid
    `
    fixture.sourceDefinitionVersionId = pe[0]?.source_definition_version_id
    if (!fixture.sourceDefinitionVersionId) {
      report.steps.push(
        stepRecord('fixture_discover', 'blocked', {
          detail: 'procedure_execution has no source_definition_version_id',
        }),
      )
      report.summary.blocked++
      report.ok = false
      return
    }
  } else {
    fixture = await prepareCaptureFixture(sql, orgId, { fresh: args.fresh })
  }

  if (!fixture?.procedureExecutionId || !fixture.studyVersionId) {
    report.steps.push(
      stepRecord('fixture_discover', 'blocked', {
        detail: 'no mutable procedure_execution with SDV — bind SDV or pass --procedure-execution-id',
      }),
    )
    report.summary.blocked++
    report.ok = false
    return
  }

  report.steps.push(
    stepRecord('fixture_discover', 'pass', {
      detail: `pe=${fixture.procedureExecutionId} sdv=${fixture.sourceDefinitionVersionId}`,
      key_ids: {
        procedure_execution_id: fixture.procedureExecutionId,
        source_definition_version_id: fixture.sourceDefinitionVersionId,
      },
    }),
  )
  report.summary.passed++

  const ctx = {
    responseSetId: fixture.existingResponseSetId,
    fieldId: null,
    widgetHint: 'text',
    savedValue: `e2e-52e-capture-${Date.now()}`,
    submittedSnapshot: null,
  }

  const modules = loadCaptureModules()
  const rc = loadReadContract()

  async function readBundle(responseSetId) {
    const detailPath = readRoutePath(responseSetId, 'detail', orgId)
    const manifestPath = readRoutePath(responseSetId, 'manifest', orgId)
    const historyPath = readRoutePath(responseSetId, 'history', orgId)
    const [detailRes, manifestRes, historyRes] = await Promise.all([
      apiFetch(base, detailPath, { cookieHeader }),
      apiFetch(base, manifestPath, { cookieHeader }),
      apiFetch(base, historyPath, { cookieHeader }),
    ])
    return {
      detail: { body: detailRes.json, httpStatus: detailRes.httpStatus },
      manifest: { body: manifestRes.json, httpStatus: manifestRes.httpStatus },
      history: { body: historyRes.json, httpStatus: historyRes.httpStatus },
    }
  }

  function buildShell(responseSetId, envelopes) {
    const detailPanel = modules.normalizeEnvelopeToPanelResult(
      envelopes.detail.body,
      modules.normalizeResponseSetDetail,
      'Detail',
    )
    const manifestPanel = modules.normalizeEnvelopeToPanelResult(
      envelopes.manifest.body,
      modules.normalizeManifest,
      'Manifest',
    )
    const captureFields = envelopes.detail.body.ok
      ? modules.normalizeCaptureFields(envelopes.detail.body.data, {})
      : []
    return buildCaptureShellViewModel({
      procedureExecutionId: fixture.procedureExecutionId,
      organizationId: orgId,
      responseSetId,
      detailData: envelopes.detail.body.data,
      manifestPanel,
      detailPanel,
      captureFields,
    })
  }

  // Unauthenticated
  {
    const { json, httpStatus } = await apiFetch(base, '/api/source/response-set/open', {
      method: 'POST',
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
    const ok = httpStatus === 401 && json?.ok === false
    report.steps.push(
      stepRecord('auth_unauthenticated', ok ? 'pass' : 'fail', {
        detail: ok ? `HTTP ${httpStatus}` : `expected 401, got ${httpStatus}`,
        http_status: httpStatus,
      }),
    )
    ok ? report.summary.passed++ : report.summary.failed++
  }

  // Wrong org (user B)
  let orgB = args.orgBId
  if (!orgB) orgB = await discoverOrgB(sql)
  if (orgB && orgB !== orgId) {
    const cookieB = (await signInForCookieHeader(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      SYNTHETIC.userB,
    )).cookieHeader
    const { json, httpStatus } = await apiFetch(base, '/api/source/response-set/open', {
      method: 'POST',
      cookieHeader: cookieB,
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
    const ok = (httpStatus === 403 || httpStatus === 401) && json?.ok === false
    report.steps.push(
      stepRecord('auth_wrong_org', ok ? 'pass' : 'fail', {
        detail: ok ? `forbidden http=${httpStatus}` : `expected 403/401 got ${httpStatus}`,
        http_status: httpStatus,
      }),
    )
    ok ? report.summary.passed++ : report.summary.failed++
  } else {
    report.steps.push(
      stepRecord('auth_wrong_org', 'skip', { detail: 'org B not available' }),
    )
    report.summary.skipped++
  }

  // Open
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
    ctx.responseSetId =
      json?.data?.source_response_set_id ??
      fixture.existingResponseSetId ??
      ctx.responseSetId
    const ok = env.ok && httpStatus === 200 && isUuid(ctx.responseSetId)
    report.steps.push(
      stepRecord('capture_open', ok ? 'pass' : 'fail', {
        detail: ok ? `response_set_id=${ctx.responseSetId}` : env.issues.join('; '),
        http_status: httpStatus,
        rpc: WRITE_RPC.OPEN_RPC,
        key_ids: { response_set_id: ctx.responseSetId },
      }),
    )
    ok ? report.summary.passed++ : report.summary.failed++
    if (!ok) {
      report.ok = false
      return
    }
  }

  let envelopes = await readBundle(ctx.responseSetId)

  const assertMutable = (stepId) => {
    const rsStatus = envelopes.detail.body?.data?.response_set?.status
    if (rsStatus === 'submitted' || rsStatus === 'locked') {
      report.steps.push(
        stepRecord(stepId, 'blocked', {
          detail: `response set ${ctx.responseSetId} already ${rsStatus} — use --fresh or another procedure_execution_id`,
        }),
      )
      report.summary.blocked++
      report.ok = false
      return false
    }
    return true
  }

  // Shell before submit
  {
    if (!assertMutable('capture_shell_before_submit')) return

    const shell = buildShell(ctx.responseSetId, envelopes)
    const primary = pickPrimaryField(envelopes.detail.body.data)
    ctx.fieldId = primary?.source_field_id
    ctx.widgetHint = primary?.widget_hint ?? 'text'
    const issues = assertCaptureShellViewModel(shell, {
      canEdit: true,
      isSubmitted: false,
      minFields: 1,
    })
    report.steps.push(
      stepRecord('capture_shell_before_submit', issues.length === 0 ? 'pass' : 'fail', {
        detail: issues.length ? issues.join('; ') : `fields=${shell.fields.length} canEdit=true`,
        errors: issues.length ? issues : null,
      }),
    )
    issues.length === 0 ? report.summary.passed++ : report.summary.failed++
  }

  // Save draft (all required fields + primary field override for traceability)
  {
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
        payload.push({
          source_field_id: field.source_field_id,
          ...valueForWidget(hint),
        })
      }
    }
    if (payload.length === 0 && ctx.fieldId) {
      payload.push({
        source_field_id: ctx.fieldId,
        ...valueForWidgetWithOverride(ctx.widgetHint, ctx.savedValue),
      })
    }
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
    const ok = env.ok && httpStatus === 200
    report.steps.push(
      stepRecord('capture_save_draft', ok ? 'pass' : 'fail', {
        detail: ok ? 'draft saved' : env.issues.join('; '),
        http_status: httpStatus,
        rpc: WRITE_RPC.SAVE_RPC,
      }),
    )
    ok ? report.summary.passed++ : report.summary.failed++
  }

  envelopes = await readBundle(ctx.responseSetId)

  // Read after save
  {
    const display = ctx.fieldId
      ? detailFieldDisplayValue(envelopes.detail.body.data, ctx.fieldId)
      : null
    const expected = expectedDisplayForSavedValue(ctx.widgetHint, ctx.savedValue)
    const ok =
      assertReadApiEnvelope(envelopes.detail.body, 'detail', { requireOk: true }).ok &&
      display === expected
    report.steps.push(
      stepRecord('capture_read_after_save', ok ? 'pass' : 'fail', {
        detail: ok ? `value=${display}` : `expected ${expected}, got ${display}`,
        actual: display,
      }),
    )
    ok ? report.summary.passed++ : report.summary.failed++
  }

  // Snapshot current rows after save (pre-submit)
  const afterSaveRows = await sql`
    select id, source_field_id, is_submitted, value_text, value_number, value_boolean, value_date
    from public.source_responses
    where response_set_id = ${ctx.responseSetId}::uuid and is_current = true
  `
  ctx.afterSaveSnapshot = new Map(
    afterSaveRows.map((r) => [r.id, responseValueSnapshot(r)]),
  )

  // Submit
  {
    const { json, httpStatus } = await apiFetch(base, '/api/source/response-set/submit', {
      method: 'POST',
      cookieHeader,
      body: {
        organization_id: orgId,
        source_response_set_id: ctx.responseSetId,
        submit_reason: 'phase52e capture shell e2e',
      },
    })
    const env = assertApiEnvelope(json, { expectedRpc: WRITE_RPC.SUBMIT_RPC, requireOk: true })
    const ok = env.ok && httpStatus === 200
    report.steps.push(
      stepRecord('capture_submit', ok ? 'pass' : 'fail', {
        detail: ok ? 'submitted' : env.issues.join('; '),
        http_status: httpStatus,
        rpc: WRITE_RPC.SUBMIT_RPC,
      }),
    )
    ok ? report.summary.passed++ : report.summary.failed++
    if (!ok) {
      report.ok = false
      return
    }
  }

  envelopes = await readBundle(ctx.responseSetId)

  // Shell after submit
  {
    const shell = buildShell(ctx.responseSetId, envelopes)
    const issues = assertCaptureShellViewModel(shell, {
      canEdit: false,
      isSubmitted: true,
    })
    report.steps.push(
      stepRecord('capture_shell_after_submit', issues.length === 0 ? 'pass' : 'fail', {
        detail: issues.length ? issues.join('; ') : 'canEdit=false isSubmitted=true',
        errors: issues.length ? issues : null,
      }),
    )
    issues.length === 0 ? report.summary.passed++ : report.summary.failed++
  }

  // Canonical read
  {
    const findingsPath = readRoutePath(ctx.responseSetId, 'findings', orgId)
    const findingsRes = await apiFetch(base, findingsPath, { cookieHeader })
    const liveResults = validateLivePayloads(
      rc,
      {
        detail: envelopes.detail,
        manifest: envelopes.manifest,
        history: envelopes.history,
        findings: { body: findingsRes.json, httpStatus: findingsRes.httpStatus },
      },
      ctx.responseSetId,
      orgId,
    )
    const manifestSubmitted =
      envelopes.manifest.body?.data?.completeness?.is_submitted === true ||
      envelopes.manifest.body?.data?.status === 'submitted'
    const contractOk =
      liveResults.every((r) => r.ok) &&
      manifestSubmitted &&
      envelopes.detail.body?.data?.response_set?.status === 'submitted'
    report.steps.push(
      stepRecord('capture_canonical_read', contractOk ? 'pass' : 'fail', {
        detail: contractOk
          ? 'detail/manifest submitted; read contract checks pass'
          : liveResults
              .filter((r) => !r.ok)
              .map((r) => r.id)
              .join(', '),
      }),
    )
    contractOk ? report.summary.passed++ : report.summary.failed++
  }

  // History submit
  {
    const ok =
      assertReadApiEnvelope(envelopes.history.body, 'history', { requireOk: true }).ok &&
      historyHasSubmitEvent(envelopes.history.body.data)
    report.steps.push(
      stepRecord('capture_history_submit', ok ? 'pass' : 'fail', {
        detail: ok ? 'submit event present' : 'missing submit chronology event',
      }),
    )
    ok ? report.summary.passed++ : report.summary.failed++
  }

  // Immutable submitted rows (pre-submit current values frozen at submit)
  {
    const afterRows = await sql`
      select id, source_field_id, is_submitted, value_text, value_number, value_boolean, value_date
      from public.source_responses
      where response_set_id = ${ctx.responseSetId}::uuid and is_submitted = true
    `
    let valuesMatch = true
    for (const row of afterRows) {
      const prior = ctx.afterSaveSnapshot?.get(row.id)
      if (prior && prior !== responseValueSnapshot(row)) valuesMatch = false
    }
    const display = ctx.fieldId
      ? detailFieldDisplayValue(envelopes.detail.body.data, ctx.fieldId)
      : null
    const expected = expectedDisplayForSavedValue(ctx.widgetHint, ctx.savedValue)
    const ok =
      afterRows.length > 0 &&
      valuesMatch &&
      display === expected
    report.steps.push(
      stepRecord('capture_submitted_immutable', ok ? 'pass' : 'fail', {
        detail: ok
          ? `${afterRows.length} submitted rows; values match pre-submit snapshot`
          : 'submitted row values diverged or missing',
        actual: { display, submittedCount: afterRows.length },
      }),
    )
    ok ? report.summary.passed++ : report.summary.failed++
  }

  // Determinism
  {
    const a = await readBundle(ctx.responseSetId)
    const b = await readBundle(ctx.responseSetId)
    const fpA = stableFingerprint(
      modules.normalizeResponseSetDetail(a.detail.body.data),
    )
    const fpB = stableFingerprint(
      modules.normalizeResponseSetDetail(b.detail.body.data),
    )
    const openAgain = await apiFetch(base, '/api/source/response-set/open', {
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
    const sameSet =
      openAgain.json?.data?.source_response_set_id === ctx.responseSetId
    const ok = fpA === fpB && sameSet
    report.steps.push(
      stepRecord('capture_determinism', ok ? 'pass' : 'fail', {
        detail: ok ? 'stable detail fingerprint; idempotent open' : 'fingerprint or open id mismatch',
        actual: { sameSet, fpMatch: fpA === fpB },
      }),
    )
    ok ? report.summary.passed++ : report.summary.failed++
  }

  // Save after submit denied
  {
    const { json, httpStatus } = await apiFetch(base, '/api/source/response-set/save-draft', {
      method: 'POST',
      cookieHeader,
      body: {
        organization_id: orgId,
        source_response_set_id: ctx.responseSetId,
        responses: ctx.fieldId
          ? [{ source_field_id: ctx.fieldId, value_text: 'should-not-save' }]
          : [],
      },
    })
    const ok = json?.ok === false && (httpStatus === 409 || httpStatus === 422)
    report.steps.push(
      stepRecord('capture_save_after_submit_denied', ok ? 'pass' : 'fail', {
        detail: ok ? `denied http=${httpStatus}` : `expected failure got ${httpStatus} ok=${json?.ok}`,
        http_status: httpStatus,
        actual: json?.code,
      }),
    )
    ok ? report.summary.passed++ : report.summary.failed++
  }

  // Review route
  {
    const shell = buildShell(ctx.responseSetId, envelopes)
    const { httpStatus } = await apiFetch(base, shell.reviewHref, {
      cookieHeader,
    })
    const ok = httpStatus === 200
    report.steps.push(
      stepRecord('capture_review_route', ok ? 'pass' : 'fail', {
        detail: ok ? `GET review HTTP ${httpStatus}` : `review route HTTP ${httpStatus}`,
        route: shell.reviewHref,
        http_status: httpStatus,
      }),
    )
    ok ? report.summary.passed++ : report.summary.failed++
  }

  report.ok = report.summary.failed === 0 && report.summary.blocked === 0
}

function valueForWidgetWithOverride(widgetHint, textOverride) {
  const base = valueForWidget(widgetHint)
  if (base.value_text !== undefined) return { value_text: textOverride }
  return base
}

async function main() {
  loadEnvFiles()
  const args = parseArgs(process.argv)

  const report = {
    phase: '5.2E',
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
          detail: 'planning — run with --live (and staging IDs or discovery)',
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
    `Phase 5.2E capture shell E2E [${report.mode}]: pass=${passed} fail=${failed} skip=${skipped} blocked=${blocked} planned=${planned}`,
  )
  console.log(`Report: ${REPORT_PATH}`)
  if (report.gaps.length) console.log('Gaps:', report.gaps.join('; '))
  process.exit(report.ok ? 0 : 1)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
