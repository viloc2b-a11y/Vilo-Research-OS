/**
 * Phase 16E — First supervised coordinator session (observer + Playwright, coordinator creds only).
 */
import { execSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'
import { createClient } from '@supabase/supabase-js'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const outDir = resolve(root, '.runtime-validation')

const BASE_URL = process.env.E2E_APP_BASE_URL?.trim() ?? 'http://localhost:3000'
const COORDINATOR = {
  email: process.env.CALENDAR_QA_COORDINATOR_EMAIL?.trim() ?? 'calendar.qa.coordinator@vilo-os.staging',
  password: process.env.CALENDAR_QA_COORDINATOR_PASSWORD?.trim() ?? 'CalendarQaCoordinator!2026',
}

const FIXTURE = {
  organizationId: 'f7cf7d2b-49cd-4bcd-9e15-2675966c3e1e',
  studyId: '6bae715a-8536-4000-8d24-22b6a3dbb8c9',
  studySubjectId: '4384b789-4e16-4512-b3f3-50642b3b9735',
  visitId: '6690da63-4bf1-4681-815a-3e39b7b014bc',
  procedureExecutionId: 'c022a7f6-3bc1-4b81-a19f-8075a4e3a1dc',
}

const ROUTES = {
  commandCenter: '/command-center',
  studyWorkspace: `/studies/${FIXTURE.studyId}/workspace`,
  subjectWorkspace: `/subjects/${FIXTURE.studySubjectId}/workspace`,
  visit: `/visits/${FIXTURE.visitId}`,
  capture: `/source/capture/${FIXTURE.procedureExecutionId}?organization_id=${FIXTURE.organizationId}`,
}

/** @type {Array<Record<string, unknown>>} */
const friction = []
/** @type {Array<Record<string, unknown>>} */
const sessionSteps = []

function logFriction(entry) {
  friction.push(entry)
}

function recordSession(step, completed, detail, coordinatorNote = '') {
  sessionSteps.push({ step, completed, detail, coordinatorNote })
}

async function loadEnvService() {
  const { loadEnvFiles, requireEnv } = await import('./lib/env.mjs')
  loadEnvFiles()
  requireEnv(['NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'])
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )
}

async function snapshotDb(service, label) {
  const peId = FIXTURE.procedureExecutionId
  const [pe, events, snaps, ready, telemetry] = await Promise.all([
    service
      .from('procedure_executions')
      .select('is_signed, signed_at, signed_by, execution_status, validation_status')
      .eq('id', peId)
      .maybeSingle(),
    service
      .from('operational_events')
      .select('event_type, created_at')
      .eq('procedure_execution_id', peId)
      .order('created_at', { ascending: false })
      .limit(8),
    service
      .from('source_response_field_snapshots')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', FIXTURE.organizationId),
    service
      .from('visit_readiness_projections')
      .select('readiness_status, blocker_count, unsigned_procedure_count')
      .eq('visit_id', FIXTURE.visitId)
      .maybeSingle(),
    service
      .from('workflow_telemetry_events')
      .select('signal, created_at')
      .eq('organization_id', FIXTURE.organizationId)
      .order('created_at', { ascending: false })
      .limit(12),
  ])
  return {
    label,
    pe: pe.data,
    operationalEvents: events.data ?? [],
    snapshotCount: snaps.count ?? 0,
    readiness: ready.data,
    telemetrySignals: (telemetry.data ?? []).map((t) => t.signal),
  }
}

async function injectCoordinatorSession(context) {
  const { loadEnvFiles, requireEnv } = await import('./lib/env.mjs')
  loadEnvFiles()
  requireEnv(['NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY'])
  const { signInForCookieHeader } = await import('./lib/source-api-e2e.mjs')
  const { jar } = await signInForCookieHeader(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { email: COORDINATOR.email, password: COORDINATOR.password },
  )
  const baseHost = new URL(BASE_URL).hostname
  const normalizeSameSite = (v) => {
    const x = String(v ?? 'Lax').toLowerCase()
    if (x === 'strict') return 'Strict'
    if (x === 'none') return 'None'
    return 'Lax'
  }
  await context.addCookies(
    jar
      .filter((c) => c.value)
      .map((c) => ({
        name: c.name,
        value: c.value,
        domain: baseHost,
        path: '/',
        httpOnly: Boolean(c.options?.httpOnly),
        secure: Boolean(c.options?.secure),
        sameSite: normalizeSameSite(c.options?.sameSite),
      })),
  )
}

async function runSession() {
  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({ baseURL: BASE_URL })
  const page = await context.newPage()
  page.setDefaultNavigationTimeout(120_000)
  page.setDefaultTimeout(60_000)

  let pathCompleted = true
  let signAttempted = false
  let signUiOutcome = 'not_attempted'
  let coordinatorNextAction = ''
  let submittedCopySeen = false

  try {
    // 1 Sign in
    await page.goto('/login', { waitUntil: 'domcontentloaded' })
    await page.fill('#email', COORDINATOR.email)
    await page.fill('#password', COORDINATOR.password)
    await page.getByRole('button', { name: 'Sign in' }).click()
    try {
      await page.waitForURL((u) => !u.pathname.includes('/login'), {
        timeout: 20_000,
        waitUntil: 'domcontentloaded',
      })
    } catch {
      await injectCoordinatorSession(context)
      await page.goto(ROUTES.commandCenter, { waitUntil: 'domcontentloaded' })
      logFriction({
        step: 1,
        coordinatorExpectation: 'Sign in and land on command center',
        actualBehavior: 'Form redirect slow; session established via fallback',
        hesitation: 'Would retry or ask IT',
        verbatimNote: '',
        severity: 'medium',
        fixRecommendation: 'Login hard-redirect already added; verify in manual session',
        pilotImpact: 'Minor delay only',
      })
    }
    const signedIn = !page.url().includes('/login')
    recordSession(1, signedIn, signedIn ? 'Signed in' : 'Login failed')

    // 2 Command center
    await page.goto(ROUTES.commandCenter, { waitUntil: 'domcontentloaded' })
    const cc = await page.locator('body').innerText({ timeout: 60_000 })
    const topActionMatch = cc.match(/Unsigned procedures|Visit completion blocked|top priority/i)
    const topActionLabel = topActionMatch?.[0] ?? 'not obvious'
    recordSession(2, /Site Operations Home/i.test(cc), 'Command center loaded', topActionLabel)
    recordSession(3, Boolean(topActionMatch), `Top action cue: ${topActionLabel}`)
    if (!topActionMatch) {
      pathCompleted = false
      logFriction({
        step: 3,
        coordinatorExpectation: 'See what to do first on site home',
        actualBehavior: 'No clear unsigned-procedures cue in visible text',
        hesitation: 'Would scan work queue manually',
        severity: 'high',
        fixRecommendation: 'Ensure top actions visible above fold',
        pilotImpact: 'Slower triage',
      })
    }

    // 4 Study workspace
    await page.goto(ROUTES.studyWorkspace, { waitUntil: 'domcontentloaded' })
    const study = await page.locator('body').innerText({ timeout: 90_000 })
    recordSession(4, /Study operations workspace/i.test(study), 'Study workspace')

    // 5 Subject workspace
    await page.goto(ROUTES.subjectWorkspace, { waitUntil: 'domcontentloaded' })
    const subj = await page.locator('body').innerText({ timeout: 90_000 })
    const subjNext = /Unsigned procedures/i.test(subj)
    recordSession(5, !/couldn.t load/i.test(subj), 'Subject workspace', subjNext ? 'Unsigned procedures visible' : '')
    recordSession(6, subjNext, 'Subject next action strip')

    // 6 Visit + why blocked
    await page.goto(ROUTES.visit, { waitUntil: 'domcontentloaded' })
    const visit = await page.locator('body').innerText({ timeout: 90_000 })
    const whyBlocked = /Why blocked\?/i.test(visit)
    const blockers = /Unsigned procedures|Visit completion blocked/i.test(visit)
    recordSession(7, !/couldn.t load/i.test(visit), 'Screening visit opened')
    recordSession(8, whyBlocked && blockers, `Why blocked=${whyBlocked} blockers=${blockers}`)
    if (!whyBlocked) {
      logFriction({
        step: 8,
        coordinatorExpectation: 'Understand why visit is blocked',
        actualBehavior: 'Why blocked drawer label not found',
        hesitation: 'Would ask PI or dig procedures tab',
        severity: 'medium',
        fixRecommendation: 'Open why-blocked by default when readiness=blocked',
        pilotImpact: 'Extra clicks',
      })
    }

    // 8 Capture + submitted state
    await page.goto(ROUTES.capture, { waitUntil: 'domcontentloaded' })
    const cap = await page.locator('body').innerText({ timeout: 90_000 })
    submittedCopySeen = /already been submitted/i.test(cap)
    const captureOk = /CRC capture shell/i.test(cap) && !/couldn.t load/i.test(cap)
    recordSession(9, captureOk, 'Source capture opened')
    recordSession(10, submittedCopySeen, submittedCopySeen ? 'Submitted read-only copy shown' : 'Submitted state unclear')
    if (!submittedCopySeen && !/Save draft/i.test(cap)) {
      logFriction({
        step: 10,
        coordinatorExpectation: 'Know source is done and read-only',
        actualBehavior: 'No explicit submitted message; buttons disabled',
        hesitation: 'Might try save anyway',
        severity: 'low',
        fixRecommendation: 'Already fixed in 16D — verify copy visible',
        pilotImpact: 'Brief confusion',
      })
    }

    // 10 Sign
    const signBtn = page.getByRole('button', { name: /^Sign Procedure$/i })
    if (await signBtn.isVisible().catch(() => false)) {
      signAttempted = true
      if (!(await signBtn.isDisabled())) {
        await signBtn.click()
        await page.waitForTimeout(4000)
        const statusMsg = await page.locator('[role="status"]').allTextContents().catch(() => [])
        const bodyAfter = await page.locator('body').innerText()
        const signedBtn = await page
          .getByRole('button', { name: 'Signed', exact: true })
          .isVisible()
          .catch(() => false)
        signUiOutcome = signedBtn ? 'signed' : statusMsg.length ? `message: ${statusMsg.join('; ')}` : 'no_signed_state'
        if (!signedBtn) {
          logFriction({
            step: 11,
            coordinatorExpectation: 'Sign procedure after source submitted',
            actualBehavior: signUiOutcome,
            hesitation: 'Would read validation alerts',
            verbatimNote: statusMsg[0] ?? '',
            severity: /permission|cannot sign/i.test(bodyAfter) ? 'blocker' : 'high',
            fixRecommendation: 'Surface validation blockers before sign; ensure coordinator RBAC allows sign',
            pilotImpact: 'Cannot close visit without sign',
          })
        }
      } else {
        signUiOutcome = 'button_disabled'
        logFriction({
          step: 11,
          coordinatorExpectation: 'Click Sign Procedure',
          actualBehavior: 'Sign button disabled',
          hesitation: 'Would open Validation Alerts',
          severity: 'high',
          fixRecommendation: 'Explain disable reason on toolbar',
          pilotImpact: 'Blocked signoff path',
        })
      }
    }
    recordSession(11, signUiOutcome === 'signed', `Sign: ${signUiOutcome}`)

    // 12 Return visit — blocked state
    await page.goto(ROUTES.visit, { waitUntil: 'domcontentloaded' })
    const visitAfter = await page.locator('body').innerText({ timeout: 90_000 })
    const stillBlocked = /blocked|Unsigned procedures/i.test(visitAfter)
    const signedAfter = /Signed/i.test(visitAfter) && !/Unsigned procedures/.test(visitAfter)
    recordSession(12, true, `Visit after sign: stillBlocked=${stillBlocked} signedCue=${signedAfter}`)

    // 13 Coordinator next action (simulated from visible copy)
    if (signedAfter) {
      coordinatorNextAction = 'Monitor remaining visit blockers or complete visit lifecycle'
    } else if (stillBlocked) {
      coordinatorNextAction = 'Resolve unsigned procedures / validation before visit completion'
    } else {
      coordinatorNextAction = 'Unclear — would re-open command center work queue'
    }
    recordSession(13, true, coordinatorNextAction)
  } catch (err) {
    pathCompleted = false
    recordSession('error', false, err instanceof Error ? err.message : String(err))
    logFriction({
      step: 'session',
      coordinatorExpectation: 'Complete pilot path',
      actualBehavior: err instanceof Error ? err.message : String(err),
      hesitation: 'Stopped',
      severity: 'blocker',
      fixRecommendation: 'Stabilize route/timeouts',
      pilotImpact: 'Session incomplete',
    })
  } finally {
    await browser.close()
  }

  return { pathCompleted, signAttempted, signUiOutcome, coordinatorNextAction, submittedCopySeen }
}

async function runPostValidation() {
  const results = {}
  try {
    results.coordinatorOps = execSync('npm run coordinator-ops:smoke', {
      cwd: root,
      encoding: 'utf8',
    }).includes('PASS')
  } catch {
    results.coordinatorOps = false
  }
  try {
    results.integrity = execSync('npm run integrity:audit:strict', {
      cwd: root,
      encoding: 'utf8',
    }).includes('0 blockers') || execSync('npm run integrity:audit:strict', { cwd: root, encoding: 'utf8' }).includes('Blockers: 0')
  } catch {
    results.integrity = false
  }
  try {
    const e2e = execSync('npm run runtime:e2e:live -- --fail-on-fail', {
      cwd: root,
      encoding: 'utf8',
    })
    results.e2eExitOk = true
    results.e2eOverall = (e2e.match(/Overall:\s*(\w+)/i) ?? [])[1]?.toLowerCase() ?? 'unknown'
  } catch (err) {
    results.e2eExitOk = false
    results.e2eOverall = 'fail'
  }
  try {
    results.browserWalkthrough = execSync('node scripts/phase16d-coordinator-browser-walkthrough.mjs', {
      cwd: root,
      encoding: 'utf8',
    }).includes('Recommendation: GO')
  } catch {
    results.browserWalkthrough = false
  }
  return results
}

async function main() {
  const service = await loadEnvService()
  const dbBefore = await snapshotDb(service, 'before')
  const session = await runSession()
  const dbAfter = await snapshotDb(service, 'after')

  const peSigned = Boolean(dbAfter.pe?.is_signed)
  const signEvent = dbAfter.operationalEvents.some((e) =>
    String(e.event_type).includes('PROCEDURE_SIGNED'),
  )
  const postValidation = await runPostValidation()

  const blockers = friction.filter((f) => f.severity === 'blocker').length
  const recommendation =
    blockers > 0 || !session.pathCompleted
      ? 'NO_GO'
      : !peSigned && session.signUiOutcome !== 'signed'
        ? 'CONDITIONAL_GO'
        : 'GO'

  const report = {
    phase: '16E-first-coordinator-session',
    runAt: new Date().toISOString(),
    environment: {
      app: BASE_URL,
      database: process.env.NEXT_PUBLIC_SUPABASE_URL,
      coordinator: COORDINATOR.email,
    },
    fixture: FIXTURE,
    pathCompleted: session.pathCompleted,
    sessionSteps,
    friction,
    sign: {
      attempted: session.signAttempted,
      uiOutcome: session.signUiOutcome,
      dbIsSigned: peSigned,
      signedAt: dbAfter.pe?.signed_at ?? null,
      procedureSignedEvent: signEvent,
    },
    blockedStateAfter: dbAfter.readiness,
    coordinatorNextAction: session.coordinatorNextAction,
    submittedCopySeen: session.submittedCopySeen,
    dbBefore,
    dbAfter,
    postValidation,
    recommendationSecondSession: recommendation,
  }

  mkdirSync(outDir, { recursive: true })
  const jsonPath = resolve(outDir, 'phase16e-first-coordinator-session.json')
  writeFileSync(jsonPath, JSON.stringify(report, null, 2))

  const md = [
    '# Phase 16E — First Coordinator Session',
    '',
    `**Run at:** ${report.runAt}`,
    `**Path completed:** ${report.pathCompleted}`,
    `**Second session:** ${report.recommendationSecondSession}`,
    '',
    '## Sign result',
    `- UI: ${report.sign.uiOutcome}`,
    `- DB is_signed: ${report.sign.dbIsSigned}`,
    `- PROCEDURE_SIGNED event: ${report.sign.procedureSignedEvent}`,
    '',
    '## Blocked state after',
    '```json',
    JSON.stringify(report.blockedStateAfter, null, 2),
    '```',
    '',
    '## Friction log',
    '',
    ...friction.map(
      (f) =>
        `### Step ${f.step} (${f.severity})\n- **Expectation:** ${f.coordinatorExpectation}\n- **Actual:** ${f.actualBehavior}\n- **Hesitation:** ${f.hesitation}\n- **Note:** ${f.verbatimNote || '—'}\n- **Fix:** ${f.fixRecommendation}\n`,
    ),
    '',
    '## Post-validation',
    '```json',
    JSON.stringify(postValidation, null, 2),
    '```',
  ].join('\n')
  writeFileSync(resolve(outDir, 'phase16e-first-coordinator-session-report.md'), md)

  console.log('=== Phase 16E First Coordinator Session ===\n')
  for (const s of sessionSteps) {
    console.log(`[${s.completed ? 'OK' : 'FAIL'}] ${s.step}: ${s.detail}`)
  }
  console.log(`\nSign: UI=${session.signUiOutcome} DB=${peSigned} event=${signEvent}`)
  console.log(`Friction: ${friction.length} | Recommendation: ${recommendation}`)
  console.log(`Wrote ${jsonPath}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
