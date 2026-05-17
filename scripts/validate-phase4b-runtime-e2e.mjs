/**

 * Phase 4B.2 / 4B.2B — Runtime end-to-end QA harness (planning default; --mutating for live RPCs).

 *

 * Prerequisites:

 *   - Catalog validators PASS (db:validate-phase4b-runtime, phase4c, phase3c)

 *   - Golden publish artifacts built (see docs/PHASE4B2-RUNTIME-E2E-QA-HARNESS.md)

 *

 * Usage:

 *   npm run db:validate-phase4b-runtime-e2e

 *   npm run db:validate-phase4b-runtime-e2e:full -- --mutating --organization-id ... (see --help)

 *

 * Reports:

 *   basic: tmp/runtime-e2e/phase4b-runtime-e2e-report.json

 *   full:  tmp/runtime-e2e/phase4b-runtime-e2e-report-full.json

 */

import { readFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs'

import { resolve, join } from 'node:path'

import postgres from 'postgres'

import { loadEnvFiles, projectRoot } from './lib/env.mjs'



const ROOT = projectRoot

const REPORT_DIR = join(ROOT, 'tmp/runtime-e2e')



const DEFAULTS = {

  golden: 'golden-basic',

  publishPackage: join(ROOT, 'tmp/publish/source-publish-package.golden-basic.json'),

  sourceDefinitions: join(ROOT, 'tmp/compiled/source-definitions.golden-basic.json'),

  approval: join(ROOT, 'tmp/approvals/source-preview-approval.golden-basic.json'),

}



const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i



const CORE_STEP_IDS = new Set([

  'publish_package',

  'verify_phase4a',

  'bind_procedure_execution',

  'open_response_set',

  'save_draft',

  'submit_freeze',

  'save_after_submit_denied',

  'create_finding',

  'acknowledge_finding',

  'resolve_or_waive_finding',

  'correct_response',

])



const EXPANSION_STEP_IDS = new Set([

  'add_addendum',

  'complete_procedure_execution',

  'complete_visit',

  'lock_visit',

  'save_after_lock_denied',

  'correction_after_lock_allowed',

  'tenant_isolation',

])



const STEP_DEFINITIONS = [

  { id: 'publish_package', title: 'publish_source_package (golden package)' },

  { id: 'verify_phase4a', title: 'Verify Phase 4A SDV and source_fields' },

  { id: 'bind_procedure_execution', title: 'Bind procedure_execution to published SDV' },

  { id: 'open_response_set', title: 'open_source_response_set (idempotent)' },

  { id: 'save_draft', title: 'save_source_draft with valid values' },

  { id: 'submit_freeze', title: 'submit_source_response_set' },

  { id: 'save_after_submit_denied', title: 'save_source_draft after submit must fail' },

  { id: 'create_finding', title: 'create_source_validation_finding' },

  { id: 'acknowledge_finding', title: 'acknowledge_source_validation_finding' },

  { id: 'resolve_or_waive_finding', title: 'resolve or waive finding (terminal)' },

  { id: 'correct_response', title: 'correct_source_response (append-only)' },

  { id: 'add_addendum', title: 'add_source_addendum or skip with reason' },

  { id: 'complete_procedure_execution', title: 'complete_procedure_execution (Phase 3C)' },

  { id: 'complete_visit', title: 'complete_visit (Phase 3C)' },

  { id: 'lock_visit', title: 'lock_visit (Phase 3C)' },

  { id: 'save_after_lock_denied', title: 'save_source_draft after lock must fail' },

  { id: 'correction_after_lock_allowed', title: 'correct_source_response after lock when authorized' },

  { id: 'tenant_isolation', title: 'cross-org / cross-role denial checks' },

]



function parseArgs(argv) {

  const args = {

    mutating: false,

    mode: 'existing',

    profile: 'basic',

    skipPublish: false,

    publishPackage: DEFAULTS.publishPackage,

    sourceDefinitions: DEFAULTS.sourceDefinitions,

    approval: DEFAULTS.approval,

    organizationId: null,

    studyId: null,

    studyVersionId: null,

    studySubjectId: null,

    visitId: null,

    procedureExecutionId: null,

    actorUserId: null,

    monitorUserId: null,

    crossOrgUserId: null,

    deniedStudyUserId: null,

  }



  for (let i = 2; i < argv.length; i++) {

    const a = argv[i]

    const next = () => argv[++i]

    if (a === '--mutating') args.mutating = true

    else if (a === '--skip-publish') args.skipPublish = true

    else if (a === '--mode') args.mode = next()

    else if (a === '--profile') args.profile = next()

    else if (a === '--publish-package') args.publishPackage = resolve(next())

    else if (a === '--source-definitions') args.sourceDefinitions = resolve(next())

    else if (a === '--approval') args.approval = resolve(next())

    else if (a === '--organization-id') args.organizationId = next()

    else if (a === '--study-id') args.studyId = next()

    else if (a === '--study-version-id') args.studyVersionId = next()

    else if (a === '--study-subject-id') args.studySubjectId = next()

    else if (a === '--visit-id') args.visitId = next()

    else if (a === '--procedure-execution-id') args.procedureExecutionId = next()

    else if (a === '--actor-user-id') args.actorUserId = next()

    else if (a === '--monitor-user-id') args.monitorUserId = next()

    else if (a === '--cross-org-user-id') args.crossOrgUserId = next()

    else if (a === '--denied-study-user-id') args.deniedStudyUserId = next()

    else if (a === '--golden-biospecimen') {

      args.publishPackage = join(ROOT, 'tmp/publish/source-publish-package.golden-biospecimen.json')

      args.sourceDefinitions = join(ROOT, 'tmp/compiled/source-definitions.golden-biospecimen.json')

      args.approval = join(ROOT, 'tmp/approvals/source-preview-approval.golden-biospecimen.json')

    } else if (a === '--help' || a === '-h') {

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



function reportPathForProfile(profile) {

  return profile === 'full'

    ? join(REPORT_DIR, 'phase4b-runtime-e2e-report-full.json')

    : join(REPORT_DIR, 'phase4b-runtime-e2e-report.json')

}



function printHelp() {

  console.log(`Phase 4B.2 / 4B.2B runtime E2E harness



Default: planning/dry-run (no RPC mutations). Use --mutating for live staging RPCs.



Options:

  --mutating

  --profile basic|full          full = addendum, visit lock, isolation probes

  --mode existing|seeded          (seeded mutating not implemented)

  --skip-publish                  Skip publish_source_package (use existing SDVs)

  --publish-package <path>

  --source-definitions <path>

  --approval <path>

  --golden-biospecimen            Shortcut paths for biospecimen artifacts

  --organization-id <uuid>

  --study-id <uuid>

  --study-version-id <uuid>

  --study-subject-id <uuid>

  --visit-id <uuid>

  --procedure-execution-id <uuid>

  --actor-user-id <uuid>

  --monitor-user-id <uuid>        Optional isolation actor (monitor)

  --cross-org-user-id <uuid>      Optional — cross-org denial probes

  --denied-study-user-id <uuid>   Optional — org member without study access



See docs/PHASE4B2-RUNTIME-E2E-QA-HARNESS.md

`)

}



function isUuid(v) {

  return typeof v === 'string' && UUID_RE.test(v)

}



function loadJson(path, label) {

  if (!existsSync(path)) return { error: `missing ${label}: ${path}` }

  try {

    return { data: JSON.parse(readFileSync(path, 'utf8')) }

  } catch (e) {

    return { error: `invalid JSON ${label}: ${e.message}` }

  }

}



function pickDatabaseUrl() {

  const direct = process.env.DATABASE_URL_DIRECT?.trim()

  const pooled = process.env.DATABASE_URL?.trim()

  return direct || pooled || null

}



function isPooler(url) {

  try {

    const u = new URL(url)

    return u.hostname.includes('pooler.supabase.com') || u.port === '6543'

  } catch {

    return false

  }

}



function stepAppliesToProfile(stepId, profile) {

  if (CORE_STEP_IDS.has(stepId)) return true

  if (EXPANSION_STEP_IDS.has(stepId)) return profile === 'full'

  return true

}



function stepRecord(id, status, fields = {}) {

  const { detail, actor_user_id, rpc, expected, actual, key_ids, errors, ...rest } = fields

  return {

    step: id,

    id,

    status,

    detail: String(detail ?? ''),

    actor_user_id: actor_user_id ?? null,

    rpc: rpc ?? null,

    expected: expected ?? null,

    actual: actual ?? null,

    key_ids: key_ids ?? {},

    errors: errors ?? null,

    ...rest,

  }

}



function validateInputs(args, { requireTenantIds }) {

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



  if (requireTenantIds) {

    for (const [key, flag] of required) {

      if (!args[key]) issues.push(`missing ${flag}`)

      else if (!isUuid(args[key])) issues.push(`${flag} must be a UUID`)

    }

  } else {

    for (const [key, flag] of required) {

      if (args[key] && !isUuid(args[key])) issues.push(`${flag} must be a UUID when provided`)

    }

  }



  for (const [key, flag] of [

    ['monitorUserId', '--monitor-user-id'],

    ['crossOrgUserId', '--cross-org-user-id'],

    ['deniedStudyUserId', '--denied-study-user-id'],

  ]) {

    if (args[key] && !isUuid(args[key])) issues.push(`${flag} must be a UUID`)

  }



  if (args.mode === 'seeded' && args.mutating) {

    issues.push('seeded mutating mode is not implemented in v1 skeleton')

  }



  if (args.mode !== 'existing' && args.mode !== 'seeded') {

    issues.push('--mode must be existing or seeded')

  }



  const artifacts = []

  if (!args.skipPublish) {

    for (const [path, label] of [

      [args.publishPackage, 'publish package'],

      [args.sourceDefinitions, 'source definitions'],

      [args.approval, 'approval'],

    ]) {

      const loaded = loadJson(path, label)

      if (loaded.error) artifacts.push(loaded.error)

    }

  }



  return { issues, artifacts: artifacts.length ? artifacts : null }

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



function isPublishSuccess(result) {

  return Boolean(result && typeof result === 'object' && result.persisted_at && result.package_id)

}



function rpcOk(result) {

  if (!result || typeof result !== 'object') return false

  if (result.ok === true) return true

  if (isPublishSuccess(result)) return true

  return false

}



function firstSdvFromPublish(result) {

  const ids = result?.phase4a_source_definition_version_ids ?? result?.data?.phase4a_source_definition_version_ids

  if (Array.isArray(ids) && ids.length) return ids[0]

  if (ids && typeof ids === 'object') return Object.values(ids)[0]

  return null

}



function valueForWidget(widgetHint) {

  const hint = String(widgetHint ?? 'text').toLowerCase()

  if (hint.includes('integer') || hint === 'number') return { value_number: 42 }

  if (hint === 'boolean') return { value_boolean: true }

  if (hint === 'date') return { value_date: '2026-05-16' }

  if (hint.includes('datetime')) return { value_datetime: '2026-05-16T12:00:00Z' }

  return { value_text: 'e2e-staging-value' }

}



function correctionValueForWidget(widgetHint) {

  const base = valueForWidget(widgetHint)

  if (base.value_number !== undefined) return { value_number: 99 }

  if (base.value_boolean !== undefined) return { value_boolean: false }

  if (base.value_date !== undefined) return { value_date: '2026-06-01' }

  if (base.value_datetime !== undefined) return { value_datetime: '2026-06-01T15:00:00Z' }

  return { value_text: 'e2e-corrected-value' }

}



async function loadFieldWidget(sql, fieldId) {

  const rows = await sql`

    select widget_hint from public.source_fields where id = ${fieldId}::uuid

  `

  return rows[0]?.widget_hint ?? 'text'

}



function responseValueSnapshot(row) {

  return JSON.stringify({

    value_text: row?.value_text ?? null,

    value_number: row?.value_number ?? null,

    value_boolean: row?.value_boolean ?? null,

    value_date: row?.value_date ?? null,

    value_datetime: row?.value_datetime ?? null,

  })

}



async function resolveAddendumEligibleField(sql, responseSetId, sdvId) {

  const rows = await sql`

    select sf.id, sf.widget_hint, sf.field_key

    from public.source_fields sf

    where sf.source_definition_version_id = ${sdvId}::uuid

      and not exists (

        select 1

        from public.source_responses sr

        where sr.response_set_id = ${responseSetId}::uuid

          and sr.source_field_id = sf.id

          and sr.is_current = true

      )

    order by sf.is_required asc, sf.field_key

    limit 1

  `

  return rows[0] ?? null

}



async function snapshotSubmittedResponses(sql, responseSetId) {

  const rows = await sql`

    select id, source_field_id, value_text, value_number, value_boolean, value_date, is_submitted

    from public.source_responses

    where response_set_id = ${responseSetId}::uuid

      and is_submitted = true

    order by source_field_id, response_sequence

  `

  return rows

}



function submittedSnapshotUnchanged(beforeRows, afterRows) {

  return beforeRows.every((row) => {

    const after = afterRows.find((r) => r.id === row.id)

    return after && JSON.stringify(after) === JSON.stringify(row)

  })

}



async function expectRpcDenied(sql, actorUserId, rpcName, casts, values) {

  try {

    const result = await withActor(sql, actorUserId, (tx) => callRpc(tx, rpcName, casts, values))

    if (result?.ok === false) return { denied: true, actual: result }

    if (!rpcOk(result)) return { denied: true, actual: result }

    return { denied: false, actual: result }

  } catch (e) {

    return { denied: true, actual: { error: e.message || String(e) } }

  }

}



function isLockOrImmutableDenial(actual) {

  const blob = JSON.stringify(actual ?? {}).toLowerCase()

  return (

    blob.includes('visit_locked') ||

    blob.includes('locked') ||

    blob.includes('not_mutable') ||

    blob.includes('immutable') ||

    blob.includes('forbidden') ||

    blob.includes('denied')

  )

}



function planningRun(args, report) {

  const { issues, artifacts } = validateInputs(args, { requireTenantIds: false })

  const artifactIssues = artifacts ?? []



  if (issues.length) {

    for (const s of STEP_DEFINITIONS) {

      if (!stepAppliesToProfile(s.id, args.profile)) continue

      report.steps.push(stepRecord(s.id, 'blocked', { detail: issues.join('; ') }))

    }

    report.summary.blocked = report.steps.length

    report.ok = false

    return

  }



  if (artifactIssues.length && !args.skipPublish) {

    report.steps.push(

      stepRecord('artifacts', 'fail', { detail: artifactIssues.join('; ') }),

    )

    report.summary.failed++

  }



  for (const s of STEP_DEFINITIONS) {

    if (!stepAppliesToProfile(s.id, args.profile)) continue



    let detail = 'planned — run with --mutating to execute'

    if (args.skipPublish && s.id === 'publish_package') {

      detail = 'planned skip — --skip-publish'

    }

    if (s.id === 'tenant_isolation') {

      if (!args.crossOrgUserId && !args.deniedStudyUserId) {

        report.steps.push(stepRecord(s.id, 'skip', { detail: 'IDS_NOT_PROVIDED' }))

        report.summary.skipped++

        continue

      }

    }

    if (s.id === 'add_addendum') {

      detail = 'planned — resolve uncaptured field or skip NO_ADDENDUM_ELIGIBLE_FIELD'

    }

    if (args.mode === 'seeded') {

      detail = 'seeded mode — planning only in v1'

    }

    report.steps.push(stepRecord(s.id, 'planned', { detail }))

    report.summary.planned++

  }



  report.ok = report.summary.failed === 0

}



async function mutatingRun(args, report, sql) {

  const ctx = {

    sdvId: null,

    responseSetId: null,

    responseId: null,

    fieldId: null,

    findingId: null,

    priorValueHash: null,

    addendumFieldId: null,

    submittedSnapshotBeforeAddendum: null,

  }



  const { issues } = validateInputs(args, { requireTenantIds: true })

  if (issues.length) {

    for (const s of STEP_DEFINITIONS) {

      if (!stepAppliesToProfile(s.id, args.profile)) continue

      report.steps.push(stepRecord(s.id, 'blocked', { detail: issues.join('; ') }))

    }

    report.summary.blocked = STEP_DEFINITIONS.filter((s) => stepAppliesToProfile(s.id, args.profile)).length

    report.ok = false

    return

  }



  let pkg

  let defs

  let approval

  if (!args.skipPublish) {

    const p = loadJson(args.publishPackage, 'publish package')

    const d = loadJson(args.sourceDefinitions, 'source definitions')

    const a = loadJson(args.approval, 'approval')

    if (p.error || d.error || a.error) {

      report.steps.push(

        stepRecord('publish_package', 'fail', {

          detail: [p.error, d.error, a.error].filter(Boolean).join('; '),

          rpc: 'publish_source_package',

        }),

      )

      report.summary.failed++

      report.ok = false

      return

    }

    pkg = p.data

    defs = d.data

    approval = a.data

  }



  async function runStep(id, runner) {

    if (!stepAppliesToProfile(id, args.profile)) {

      report.steps.push(

        stepRecord(id, 'skip', {

          detail: 'PROFILE_BASIC — use --profile full',

          skip_reason: 'PROFILE_BASIC',

        }),

      )

      report.summary.skipped++

      return { status: 'skip' }

    }

    try {

      const outcome = await runner()

      report.steps.push(

        stepRecord(id, outcome.status, {

          detail: outcome.detail ?? '',

          actor_user_id: outcome.actor_user_id ?? null,

          rpc: outcome.rpc ?? null,

          expected: outcome.expected ?? null,

          actual: outcome.actual ?? null,

          key_ids: outcome.key_ids ?? {},

          errors: outcome.errors ?? null,

          ...outcome.extra,

        }),

      )

      if (outcome.status === 'pass') report.summary.passed++

      else if (outcome.status === 'skip') report.summary.skipped++

      else report.summary.failed++

      return outcome

    } catch (e) {

      report.steps.push(

        stepRecord(id, 'fail', {

          detail: e.message || String(e),

          errors: e.message || String(e),

        }),

      )

      report.summary.failed++

      return { status: 'fail' }

    }

  }



  // 1 publish

  if (args.skipPublish) {

    report.steps.push(stepRecord('publish_package', 'skip', { detail: '--skip-publish' }))

    report.summary.skipped++

  } else {

    await runStep('publish_package', async () => {

      const result = await withActor(sql, args.actorUserId, (tx) =>

        callRpc(tx, 'publish_source_package', ['::uuid', '::uuid', '::uuid', '::jsonb', '::jsonb', '::jsonb'], [

          args.organizationId,

          args.studyId,

          args.studyVersionId,

          pkg,

          defs,

          approval,

        ]),

      )

      if (!rpcOk(result)) {

        return {

          status: 'fail',

          detail: JSON.stringify(result),

          actor_user_id: args.actorUserId,

          rpc: 'publish_source_package',

          expected: 'ok=true',

          actual: result,

        }

      }

      ctx.sdvId = firstSdvFromPublish(result)

      return {

        status: 'pass',

        detail: `published package_id=${result.package_id}; sdv=${ctx.sdvId ?? 'see DB'}`,

        actor_user_id: args.actorUserId,

        rpc: 'publish_source_package',

        expected: 'ok=true',

        actual: result,

        key_ids: { package_id: result.package_id, sdv_id: ctx.sdvId },

      }

    })

  }



  // 2 verify 4A

  await runStep('verify_phase4a', async () => {

    const rows = await sql`

      select count(*)::int as sdv_count

      from public.source_definition_versions sdv

      where sdv.study_id = ${args.studyId}::uuid

        and sdv.lifecycle_status = 'published'

    `

    const fields = await sql`

      select count(*)::int as field_count

      from public.source_fields sf

      join public.source_definition_versions sdv on sdv.id = sf.source_definition_version_id

      where sdv.study_id = ${args.studyId}::uuid

        and sdv.lifecycle_status = 'published'

    `

    const sdvCount = rows[0]?.sdv_count ?? 0

    const fieldCount = fields[0]?.field_count ?? 0

    if (sdvCount < 1 || fieldCount < 1) {

      return {

        status: 'fail',

        detail: `sdv_count=${sdvCount} field_count=${fieldCount}`,

        expected: 'published SDVs and fields exist',

        actual: { sdvCount, fieldCount },

      }

    }

    if (!ctx.sdvId) {

      const first = await sql`

        select id from public.source_definition_versions

        where study_id = ${args.studyId}::uuid and lifecycle_status = 'published'

        order by created_at desc nulls last

        limit 1

      `

      ctx.sdvId = first[0]?.id ?? null

    }

    return {

      status: 'pass',

      detail: `sdv_count=${sdvCount} field_count=${fieldCount} bind_sdv=${ctx.sdvId}`,

      expected: 'sdv_count>=1 field_count>=1',

      actual: { sdvCount, fieldCount, bindSdv: ctx.sdvId },

      key_ids: { sdv_id: ctx.sdvId },

    }

  })



  // 3 bind PE

  await runStep('bind_procedure_execution', async () => {

    if (!ctx.sdvId) return { status: 'fail', detail: 'no SDV to bind' }

    await sql`

      update public.procedure_executions

      set source_definition_version_id = ${ctx.sdvId}::uuid

      where id = ${args.procedureExecutionId}::uuid

        and organization_id = ${args.organizationId}::uuid

    `

    return {

      status: 'pass',

      detail: `PE bound to ${ctx.sdvId}`,

      key_ids: { procedure_execution_id: args.procedureExecutionId, sdv_id: ctx.sdvId },

    }

  })



  // 4 open

  await runStep('open_response_set', async () => {

    const openOnce = () =>

      withActor(sql, args.actorUserId, (tx) =>

        callRpc(

          tx,

          'open_source_response_set',

          ['::uuid', '::uuid', '::uuid', '::uuid', '::uuid', '::uuid', '::uuid'],

          [

            args.organizationId,

            args.studyId,

            args.studyVersionId,

            args.studySubjectId,

            args.visitId,

            args.procedureExecutionId,

            ctx.sdvId,

          ],

        ),

      )

    const r1 = await openOnce()

    const r2 = await openOnce()

    if (!rpcOk(r1) || !rpcOk(r2)) {

      return {

        status: 'fail',

        detail: JSON.stringify({ first: r1, second: r2 }),

        actor_user_id: args.actorUserId,

        rpc: 'open_source_response_set',

        actual: { first: r1, second: r2 },

      }

    }

    const id1 = r1?.data?.source_response_set_id

    const id2 = r2?.data?.source_response_set_id

    ctx.responseSetId = id1

    if (id1 && id2 && id1 === id2) {

      return {

        status: 'pass',

        detail: `idempotent set_id=${id1}`,

        actor_user_id: args.actorUserId,

        rpc: 'open_source_response_set',

        expected: 'same source_response_set_id on second call',

        actual: { first: id1, second: id2 },

        key_ids: { source_response_set_id: id1 },

      }

    }

    return { status: 'fail', detail: `idempotent mismatch ${id1} vs ${id2}` }

  })



  // 5 save draft

  await runStep('save_draft', async () => {

    const fields = await sql`

      select sf.id, sf.widget_hint, sf.is_required

      from public.source_fields sf

      where sf.source_definition_version_id = ${ctx.sdvId}::uuid

      order by sf.is_required desc, sf.field_key

      limit 20

    `

    if (!fields.length) return { status: 'skip', detail: 'no fields on SDV' }



    const required = fields.filter((f) => f.is_required)

    const target = required.length ? required : [fields[0]]

    const responses = target.map((f) => ({

      source_field_id: f.id,

      ...valueForWidget(f.widget_hint),

    }))



    const result = await withActor(sql, args.actorUserId, (tx) =>

      callRpc(tx, 'save_source_draft', ['::uuid', '::uuid', '::jsonb'], [

        args.organizationId,

        ctx.responseSetId,

        responses,

      ]),

    )

    if (!rpcOk(result)) {

      return {

        status: 'fail',

        detail: JSON.stringify(result),

        actor_user_id: args.actorUserId,

        rpc: 'save_source_draft',

        actual: result,

      }

    }



    const current = await sql`

      select id, source_field_id

      from public.source_responses

      where response_set_id = ${ctx.responseSetId}::uuid and is_current = true

      limit 1

    `

    ctx.responseId = current[0]?.id ?? null

    ctx.fieldId = current[0]?.source_field_id ?? target[0]?.id

    return {

      status: 'pass',

      detail: `saved ${responses.length} field(s)`,

      actor_user_id: args.actorUserId,

      rpc: 'save_source_draft',

      key_ids: { source_response_set_id: ctx.responseSetId, response_id: ctx.responseId },

    }

  })



  // 6 submit

  await runStep('submit_freeze', async () => {

    let result

    try {

      result = await withActor(sql, args.actorUserId, (tx) =>

        callRpc(tx, 'submit_source_response_set', ['::uuid', '::uuid', '::text'], [

          args.organizationId,

          ctx.responseSetId,

          'phase4b2-e2e-harness',

        ]),

      )

    } catch (e) {

      return { status: 'fail', detail: e.message, rpc: 'submit_source_response_set', errors: e.message }

    }

    if (!rpcOk(result)) return { status: 'fail', detail: JSON.stringify(result), actual: result }

    return {

      status: 'pass',

      detail: `status=${result?.data?.status ?? 'submitted'}`,

      actor_user_id: args.actorUserId,

      rpc: 'submit_source_response_set',

      key_ids: { source_response_set_id: ctx.responseSetId },

      actual: result,

    }

  })



  // 7 save after submit denied

  await runStep('save_after_submit_denied', async () => {

    const setRow = await sql`

      select status from public.source_response_sets where id = ${ctx.responseSetId}::uuid

    `

    if (setRow[0]?.status !== 'submitted' && setRow[0]?.status !== 'corrected' && setRow[0]?.status !== 'addended') {

      return {

        status: 'skip',

        detail: `set not in post-submit status (status=${setRow[0]?.status})`,

      }

    }

    const probe = await expectRpcDenied(sql, args.actorUserId, 'save_source_draft', ['::uuid', '::uuid', '::jsonb'], [

      args.organizationId,

      ctx.responseSetId,

      [{ source_field_id: ctx.fieldId, value_text: 'should-not-save' }],

    ])

    return probe.denied

      ? {

          status: 'pass',

          detail: 'post-submit save rejected',

          actor_user_id: args.actorUserId,

          rpc: 'save_source_draft',

          expected: 'denied',

          actual: probe.actual,

        }

      : {

          status: 'fail',

          detail: 'post-submit save unexpectedly succeeded',

          actual: probe.actual,

        }

  })



  // 8–10 findings

  await runStep('create_finding', async () => {

    const result = await withActor(sql, args.actorUserId, (tx) =>

      callRpc(

        tx,

        'create_source_validation_finding',

        ['::uuid', '::uuid', '::text', '::text', '::text', '::uuid', '::uuid', '::text'],

        [

          args.organizationId,

          ctx.responseSetId,

          'required',

          'warning',

          'E2E harness validation finding',

          ctx.responseId,

          ctx.fieldId,

          'E2E_RULE_001',

        ],

      ),

    )

    if (!rpcOk(result)) return { status: 'fail', detail: JSON.stringify(result), actual: result }

    ctx.findingId = result?.data?.finding_id

    return {

      status: 'pass',

      detail: `finding_id=${ctx.findingId}`,

      actor_user_id: args.actorUserId,

      rpc: 'create_source_validation_finding',

      key_ids: { finding_id: ctx.findingId },

      actual: result,

    }

  })



  await runStep('acknowledge_finding', async () => {

    const actor = args.monitorUserId ?? args.actorUserId

    const result = await withActor(sql, actor, (tx) =>

      callRpc(tx, 'acknowledge_source_validation_finding', ['::uuid', '::uuid', '::text'], [

        args.organizationId,

        ctx.findingId,

        'e2e acknowledge',

      ]),

    )

    if (!rpcOk(result)) return { status: 'fail', detail: JSON.stringify(result), actual: result }

    return {

      status: 'pass',

      detail: `status=${result?.data?.status}`,

      actor_user_id: actor,

      rpc: 'acknowledge_source_validation_finding',

      actual: result,

    }

  })



  await runStep('resolve_or_waive_finding', async () => {

    const result = await withActor(sql, args.actorUserId, (tx) =>

      callRpc(tx, 'resolve_source_validation_finding', ['::uuid', '::uuid', '::text'], [

        args.organizationId,

        ctx.findingId,

        'e2e resolution — no response mutation',

      ]),

    )

    if (!rpcOk(result)) return { status: 'fail', detail: JSON.stringify(result), actual: result }

    return {

      status: 'pass',

      detail: `terminal status=${result?.data?.status}`,

      actor_user_id: args.actorUserId,

      rpc: 'resolve_source_validation_finding',

      actual: result,

    }

  })



  // 11 correct

  await runStep('correct_response', async () => {

    if (!ctx.responseId) return { status: 'skip', detail: 'no response_id from draft step' }



    const prior = await sql`

      select value_text, value_number, value_boolean, value_date, value_datetime, is_submitted, is_current

      from public.source_responses where id = ${ctx.responseId}::uuid

    `

    ctx.priorValueHash = responseValueSnapshot(prior[0])

    const widgetHint = await loadFieldWidget(sql, ctx.fieldId)

    const correctionPayload = correctionValueForWidget(widgetHint)



    let result

    try {

      result = await withActor(sql, args.actorUserId, (tx) =>

        callRpc(tx, 'correct_source_response', ['::uuid', '::uuid', '::jsonb', '::text'], [

          args.organizationId,

          ctx.responseId,

          correctionPayload,

          'e2e harness correction',

        ]),

      )

    } catch (e) {

      return { status: 'fail', detail: e.message, errors: e.message }

    }

    if (!rpcOk(result)) return { status: 'fail', detail: JSON.stringify(result), actual: result }



    const newRow = await sql`

      select id from public.source_responses

      where response_set_id = ${ctx.responseSetId}::uuid

        and source_field_id = ${ctx.fieldId}::uuid

        and is_current = true

      limit 1

    `



    const afterPrior = await sql`

      select value_text, value_number, value_boolean, value_date, value_datetime, is_submitted

      from public.source_responses where id = ${ctx.responseId}::uuid

    `

    const unchanged =

      responseValueSnapshot(afterPrior[0]) === responseValueSnapshot(prior[0]) &&

      afterPrior[0]?.is_submitted === true



    if (newRow[0]?.id && newRow[0].id !== ctx.responseId && unchanged) {

      ctx.responseId = newRow[0].id

      return {

        status: 'pass',

        detail: 'new current response; prior value unchanged',

        actor_user_id: args.actorUserId,

        rpc: 'correct_source_response',

        key_ids: { new_response_id: ctx.responseId, prior_response_id: prior[0]?.id },

        actual: result,

      }

    }

    return { status: 'fail', detail: JSON.stringify(result), actual: result }

  })



  // 12 addendum

  await runStep('add_addendum', async () => {

    if (!ctx.responseSetId || !ctx.sdvId) {

      return { status: 'skip', detail: 'missing response set or SDV', skip_reason: 'MISSING_CONTEXT' }

    }



    ctx.submittedSnapshotBeforeAddendum = await snapshotSubmittedResponses(sql, ctx.responseSetId)



    const eligible = await resolveAddendumEligibleField(sql, ctx.responseSetId, ctx.sdvId)

    if (!eligible) {

      return {

        status: 'skip',

        detail: 'NO_ADDENDUM_ELIGIBLE_FIELD',

        skip_reason: 'NO_ADDENDUM_ELIGIBLE_FIELD',

        actor_user_id: args.actorUserId,

        rpc: 'add_source_addendum',

        expected: 'eligible uncaptured field on bound SDV',

      }

    }



    ctx.addendumFieldId = eligible.id

    const valuePayload = valueForWidget(eligible.widget_hint)



    let result

    try {

      result = await withActor(sql, args.actorUserId, (tx) =>

        callRpc(

          tx,

          'add_source_addendum',

          ['::uuid', '::uuid', '::uuid', '::jsonb', '::text', '::uuid'],

          [

            args.organizationId,

            ctx.responseSetId,

            eligible.id,

            valuePayload,

            'e2e harness addendum',

            ctx.sdvId,

          ],

        ),

      )

    } catch (e) {

      return { status: 'fail', detail: e.message, errors: e.message, rpc: 'add_source_addendum' }

    }



    if (!rpcOk(result)) {

      return { status: 'fail', detail: JSON.stringify(result), actual: result, rpc: 'add_source_addendum' }

    }



    const addendumRow = await sql`

      select id from public.source_response_addenda

      where response_set_id = ${ctx.responseSetId}::uuid

      order by created_at desc nulls last

      limit 1

    `

    const newResponse = await sql`

      select id, is_submitted, is_current

      from public.source_responses

      where response_set_id = ${ctx.responseSetId}::uuid

        and source_field_id = ${eligible.id}::uuid

        and is_current = true

      limit 1

    `

    const setStatus = await sql`

      select status from public.source_response_sets where id = ${ctx.responseSetId}::uuid

    `

    const afterSnapshot = await snapshotSubmittedResponses(sql, ctx.responseSetId)

    const priorUnchanged = submittedSnapshotUnchanged(
      ctx.submittedSnapshotBeforeAddendum,
      afterSnapshot,
    )



    const statusOk = ['addended', 'corrected', 'submitted'].includes(setStatus[0]?.status)



    if (addendumRow[0]?.id && newResponse[0]?.id && newResponse[0].is_submitted && priorUnchanged && statusOk) {

      return {

        status: 'pass',

        detail: `addendum_id=${addendumRow[0].id} set_status=${setStatus[0]?.status}`,

        actor_user_id: args.actorUserId,

        rpc: 'add_source_addendum',

        expected: 'addendum row + new current response; prior submitted rows unchanged',

        actual: result,

        key_ids: {

          addendum_id: addendumRow[0].id,

          response_id: newResponse[0].id,

          source_field_id: eligible.id,

        },

      }

    }



    return {

      status: 'fail',

      detail: `addendum assertions failed addendum=${!!addendumRow[0]} response=${!!newResponse[0]} prior_unchanged=${priorUnchanged} status=${setStatus[0]?.status}`,

      actual: { result, setStatus: setStatus[0]?.status, priorUnchanged },

    }

  })



  // 13 complete PE

  await runStep('complete_procedure_execution', async () => {

    const peBefore = await sql`

      select execution_status from public.procedure_executions

      where id = ${args.procedureExecutionId}::uuid

    `

    const result = await withActor(sql, args.actorUserId, (tx) =>

      callRpc(tx, 'complete_procedure_execution', ['::uuid'], [args.procedureExecutionId]),

    )

    const peAfter = await sql`

      select execution_status from public.procedure_executions

      where id = ${args.procedureExecutionId}::uuid

    `

    if (result?.ok === true) {

      const completed = ['completed', 'verified'].includes(peAfter[0]?.execution_status)

      return {

        status: completed ? 'pass' : 'fail',

        detail: `PE ${peBefore[0]?.execution_status} → ${peAfter[0]?.execution_status}`,

        actor_user_id: args.actorUserId,

        rpc: 'complete_procedure_execution',

        expected: 'ok=true; execution_status completed or verified',

        actual: result,

        key_ids: { procedure_execution_id: args.procedureExecutionId },

      }

    }

    return {

      status: 'skip',

      detail: `complete_procedure_execution: ${result?.error ?? JSON.stringify(result)}`,

      skip_reason: 'PE_COMPLETE_BLOCKED',

      actor_user_id: args.actorUserId,

      rpc: 'complete_procedure_execution',

      actual: result,

    }

  })



  // 14 complete visit

  await runStep('complete_visit', async () => {

    const result = await withActor(sql, args.actorUserId, (tx) =>

      callRpc(tx, 'complete_visit', ['::uuid'], [args.visitId]),

    )

    const visit = await sql`

      select visit_status from public.visits where id = ${args.visitId}::uuid

    `

    if (result?.ok === true && visit[0]?.visit_status === 'completed') {

      return {

        status: 'pass',

        detail: `visit_status=${visit[0]?.visit_status}`,

        actor_user_id: args.actorUserId,

        rpc: 'complete_visit',

        expected: 'ok=true; visit_status=completed',

        actual: result,

        key_ids: { visit_id: args.visitId },

      }

    }

    return {

      status: 'skip',

      detail: `complete_visit: ${result?.error ?? JSON.stringify(result)} visit_status=${visit[0]?.visit_status}`,

      skip_reason: 'VISIT_COMPLETE_BLOCKED',

      actual: result,

    }

  })



  // 15 lock visit

  await runStep('lock_visit', async () => {

    const result = await withActor(sql, args.actorUserId, (tx) =>

      callRpc(tx, 'lock_visit', ['::uuid'], [args.visitId]),

    )

    const visit = await sql`

      select visit_status, locked_at, locked_by_user_id

      from public.visits where id = ${args.visitId}::uuid

    `

    const setLock = await sql`

      select status, locked_at, locked_by_user_id

      from public.source_response_sets where id = ${ctx.responseSetId}::uuid

    `

    if (result?.ok === true && visit[0]?.visit_status === 'locked') {

      return {

        status: 'pass',

        detail: `visit locked; srs locked_at=${setLock[0]?.locked_at ?? 'n/a'}`,

        actor_user_id: args.actorUserId,

        rpc: 'lock_visit',

        expected: 'ok=true; visit_status=locked',

        actual: { rpc: result, visit: visit[0], response_set: setLock[0] },

        key_ids: { visit_id: args.visitId, source_response_set_id: ctx.responseSetId },

      }

    }

    return {

      status: 'skip',

      detail: `lock_visit: ${result?.error ?? JSON.stringify(result)} visit_status=${visit[0]?.visit_status}`,

      skip_reason: 'VISIT_LOCK_BLOCKED',

      actual: result,

    }

  })



  // 16 save after lock denied

  await runStep('save_after_lock_denied', async () => {

    const locked = await sql`

      select visit_status from public.visits where id = ${args.visitId}::uuid

    `

    if (locked[0]?.visit_status !== 'locked') {

      return { status: 'skip', detail: 'visit not locked — prior step skipped', skip_reason: 'VISIT_NOT_LOCKED' }

    }

    const probe = await expectRpcDenied(sql, args.actorUserId, 'save_source_draft', ['::uuid', '::uuid', '::jsonb'], [

      args.organizationId,

      ctx.responseSetId,

      [{ source_field_id: ctx.fieldId, value_text: 'locked-deny' }],

    ])

    const lockReason = isLockOrImmutableDenial(probe.actual)

    return probe.denied && lockReason

      ? {

          status: 'pass',

          detail: 'draft save blocked when visit locked',

          actor_user_id: args.actorUserId,

          rpc: 'save_source_draft',

          expected: 'denied (visit locked / not mutable)',

          actual: probe.actual,

        }

      : {

          status: 'fail',

          detail: probe.denied

            ? 'denied but reason not lock/immutable'

            : 'draft save allowed on locked visit',

          actual: probe.actual,

        }

  })



  // 17 correction after lock

  await runStep('correction_after_lock_allowed', async () => {

    const locked = await sql`

      select visit_status from public.visits where id = ${args.visitId}::uuid

    `

    if (locked[0]?.visit_status !== 'locked') {

      return { status: 'skip', detail: 'visit not locked', skip_reason: 'VISIT_NOT_LOCKED' }

    }

    if (!ctx.responseId) return { status: 'skip', detail: 'no response to correct' }



    const priorId = ctx.responseId

    const prior = await sql`

      select value_text, value_number, value_boolean, value_date, value_datetime, is_submitted

      from public.source_responses where id = ${priorId}::uuid

    `

    const widgetHint = await loadFieldWidget(sql, ctx.fieldId)

    const correctionPayload = correctionValueForWidget(widgetHint)



    let result

    try {

      result = await withActor(sql, args.actorUserId, (tx) =>

        callRpc(tx, 'correct_source_response', ['::uuid', '::uuid', '::jsonb', '::text'], [

          args.organizationId,

          ctx.responseId,

          correctionPayload,

          'e2e post-lock correction',

        ]),

      )

    } catch (e) {

      return { status: 'fail', detail: e.message, errors: e.message }

    }



    if (!rpcOk(result)) {

      return { status: 'fail', detail: JSON.stringify(result), actual: result }

    }



    const newRow = await sql`

      select id from public.source_responses

      where response_set_id = ${ctx.responseSetId}::uuid

        and source_field_id = ${ctx.fieldId}::uuid

        and is_current = true

      limit 1

    `

    const afterPrior = await sql`

      select value_text, value_number, value_boolean, value_date, value_datetime, is_submitted

      from public.source_responses where id = ${priorId}::uuid

    `

    const appendOnly =

      newRow[0]?.id &&

      newRow[0].id !== priorId &&

      responseValueSnapshot(afterPrior[0]) === responseValueSnapshot(prior[0])



    if (appendOnly) {

      ctx.responseId = newRow[0].id

      return {

        status: 'pass',

        detail: 'correction allowed after lock; append-only preserved',

        actor_user_id: args.actorUserId,

        rpc: 'correct_source_response',

        expected: 'ok=true; new current row; prior row value unchanged',

        actual: result,

        key_ids: { new_response_id: newRow[0].id, prior_response_id: priorId },

      }

    }

    return { status: 'fail', detail: 'append-only check failed', actual: result }

  })



  // 18 tenant isolation

  await runStep('tenant_isolation', async () => {

    if (!args.crossOrgUserId && !args.deniedStudyUserId) {

      return {

        status: 'skip',

        detail: 'IDS_NOT_PROVIDED',

        skip_reason: 'IDS_NOT_PROVIDED',

      }

    }



    const probes = []

    const openArgs = [

      args.organizationId,

      args.studyId,

      args.studyVersionId,

      args.studySubjectId,

      args.visitId,

      args.procedureExecutionId,

      ctx.sdvId,

    ]

    const openCasts = ['::uuid', '::uuid', '::uuid', '::uuid', '::uuid', '::uuid', '::uuid']



    if (args.crossOrgUserId) {

      probes.push({

        name: 'cross_org_open_denied',

        actor: args.crossOrgUserId,

        rpc: 'open_source_response_set',

        casts: openCasts,

        values: openArgs,

      })

      probes.push({

        name: 'cross_org_save_denied',

        actor: args.crossOrgUserId,

        rpc: 'save_source_draft',

        casts: ['::uuid', '::uuid', '::jsonb'],

        values: [

          args.organizationId,

          ctx.responseSetId,

          [{ source_field_id: ctx.fieldId, value_text: 'cross-org-deny' }],

        ],

      })

    }



    if (args.deniedStudyUserId) {

      probes.push({

        name: 'denied_study_open_denied',

        actor: args.deniedStudyUserId,

        rpc: 'open_source_response_set',

        casts: openCasts,

        values: openArgs,

      })

      probes.push({

        name: 'denied_study_submit_denied',

        actor: args.deniedStudyUserId,

        rpc: 'submit_source_response_set',

        casts: ['::uuid', '::uuid', '::text'],

        values: [args.organizationId, ctx.responseSetId, 'e2e isolation probe'],

      })

      if (ctx.responseId) {

        probes.push({

          name: 'denied_study_correct_denied',

          actor: args.deniedStudyUserId,

          rpc: 'correct_source_response',

          casts: ['::uuid', '::uuid', '::jsonb', '::text'],

          values: [

            args.organizationId,

            ctx.responseId,

            { value_text: 'denied-correct' },

            'e2e isolation',

          ],

        })

      }

    }



    if (args.monitorUserId) {

      probes.push({

        name: 'monitor_save_denied',

        actor: args.monitorUserId,

        rpc: 'save_source_draft',

        casts: ['::uuid', '::uuid', '::jsonb'],

        values: [

          args.organizationId,

          ctx.responseSetId,

          [{ source_field_id: ctx.fieldId, value_text: 'monitor-deny' }],

        ],

      })

      if (ctx.responseId) {

        probes.push({

          name: 'monitor_correct_denied',

          actor: args.monitorUserId,

          rpc: 'correct_source_response',

          casts: ['::uuid', '::uuid', '::jsonb', '::text'],

          values: [

            args.organizationId,

            ctx.responseId,

            { value_text: 'monitor-correct-deny' },

            'e2e isolation',

          ],

        })

      }

    }



    const results = []

    let allPass = true

    for (const p of probes) {

      const probe = await expectRpcDenied(sql, p.actor, p.rpc, p.casts, p.values)

      const pass = probe.denied

      if (!pass) allPass = false

      results.push({

        probe: p.name,

        actor_user_id: p.actor,

        rpc: p.rpc,

        expected: 'denied',

        pass,

        actual: probe.actual,

      })

    }



    return allPass

      ? {

          status: 'pass',

          detail: `${results.length} isolation probe(s) denied as expected`,

          expected: 'all probes denied',

          actual: results,

          isolation: results,

        }

      : {

          status: 'fail',

          detail: 'one or more isolation probes unexpectedly allowed',

          actual: results,

          isolation: results,

        }

  })



  report.ok = report.summary.failed === 0 && report.summary.blocked === 0

}



function writeReport(report, reportPath) {

  mkdirSync(REPORT_DIR, { recursive: true })

  writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf8')

}



async function main() {

  loadEnvFiles()

  const args = parseArgs(process.argv)

  const reportPath = reportPathForProfile(args.profile)

  const startedAt = new Date().toISOString()



  const report = {

    ok: false,

    profile: args.profile,

    mode: args.mode,

    mutating: args.mutating,

    started_at: startedAt,

    ended_at: null,

    inputs: {

      organization_id: args.organizationId,

      study_id: args.studyId,

      study_version_id: args.studyVersionId,

      study_subject_id: args.studySubjectId,

      visit_id: args.visitId,

      procedure_execution_id: args.procedureExecutionId,

      actor_user_id: args.actorUserId,

      monitor_user_id: args.monitorUserId,

      cross_org_user_id: args.crossOrgUserId,

      denied_study_user_id: args.deniedStudyUserId,

      skip_publish: args.skipPublish,

      publish_package: args.publishPackage,

      source_definitions: args.sourceDefinitions,

      approval: args.approval,

    },

    steps: [],

    summary: { passed: 0, failed: 0, skipped: 0, planned: 0, blocked: 0 },

    artifacts: { report_path: reportPath },

  }



  console.log(

    `Phase 4B.2 runtime E2E — ${args.mutating ? 'MUTATING' : 'planning'} (mode=${args.mode}, profile=${args.profile})`,

  )



  if (!args.mutating) {

    planningRun(args, report)

  } else {

    const sql = await connectPostgres()

    if (!sql) {

      console.error('BLOCKED: set DATABASE_URL_DIRECT or DATABASE_URL in .env.local for --mutating')

      report.steps.push(stepRecord('harness', 'blocked', { detail: 'no database URL' }))

      report.summary.blocked = 1

      report.ok = false

    } else {

      try {

        await mutatingRun(args, report, sql)

      } finally {

        await sql.end({ timeout: 10 })

      }

    }

  }



  report.ended_at = new Date().toISOString()

  writeReport(report, reportPath)



  const { passed, failed, skipped, planned, blocked } = report.summary

  console.log(`Report: ${reportPath}`)

  console.log(

    `Summary: ${report.ok ? 'OK' : 'FAIL'} — pass=${passed} fail=${failed} skip=${skipped} planned=${planned} blocked=${blocked}`,

  )



  if (!report.ok && args.mutating) process.exit(1)

  if (!args.mutating && blocked > 0) process.exit(1)

}



main().catch((err) => {

  console.error(err.message || err)

  process.exit(1)

})


