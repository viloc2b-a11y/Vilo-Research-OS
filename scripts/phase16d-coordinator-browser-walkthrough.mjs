/**
 * Phase 16D — Live coordinator browser walkthrough (Playwright, coordinator session only).
 *
 * Run: npx playwright install chromium && node scripts/phase16d-coordinator-browser-walkthrough.mjs
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

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
  login: '/login',
  commandCenter: '/command-center',
  studyWorkspace: `/studies/${FIXTURE.studyId}/workspace`,
  subjectWorkspace: `/subjects/${FIXTURE.studySubjectId}/workspace`,
  visit: `/visits/${FIXTURE.visitId}`,
  capture: `/source/capture/${FIXTURE.procedureExecutionId}?organization_id=${FIXTURE.organizationId}`,
}

const TECHNICAL_RE =
  /\b(violates|constraint|row-level|pg_|supabase|42P01|stack trace|TypeError:|ReferenceError:)\b/i

/** @type {Array<Record<string, unknown>>} */
const friction = []
/** @type {Array<Record<string, unknown>>} */
const steps = []

function logFriction(entry) {
  friction.push(entry)
}

function recordStep(step, status, detail, extra = {}) {
  steps.push({ step, status, detail, ...extra })
}

function scanTechnical(text, step) {
  if (!text || !TECHNICAL_RE.test(text)) return null
  const match = text.match(TECHNICAL_RE)
  logFriction({
    step,
    whatCoordinatorSees: text.slice(0, 280),
    expectedBehavior: 'Coordinator-safe error or success copy only',
    actualBehavior: `Technical token visible: ${match?.[0] ?? 'unknown'}`,
    severity: 'blocker',
    fixRecommendation: 'Route through translateRuntimeError / coordinator-facing envelopes',
    pilotImpact: 'Trust break; coordinator may see implementation details',
  })
  return match?.[0]
}

async function waitForAppReady(page, label) {
  await page.waitForLoadState('domcontentloaded')
  try {
    await page.waitForLoadState('networkidle', { timeout: 25_000 })
  } catch {
    // slow staging-backed pages
  }
  const body = await page.locator('body').innerText({ timeout: 30_000 })
  scanTechnical(body, label)
  return body
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
  const normalizeSameSite = (value) => {
    const v = String(value ?? 'Lax').toLowerCase()
    if (v === 'strict') return 'Strict'
    if (v === 'none') return 'None'
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
  return jar.length
}

async function main() {
  const { loadEnvFiles } = await import('./lib/env.mjs')
  loadEnvFiles()

  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({ baseURL: BASE_URL })
  const page = await context.newPage()
  page.setDefaultNavigationTimeout(120_000)
  page.setDefaultTimeout(60_000)

  const consoleErrors = []
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text())
  })
  page.on('pageerror', (err) => consoleErrors.push(String(err)))

  let signInOk = false
  let saveResult = { attempted: false, outcome: 'skip' }
  let submitResult = { attempted: false, outcome: 'skip' }
  let signResult = { attempted: false, outcome: 'skip' }
  const routesCompleted = []

  try {
    // 1. Sign in (form first; Supabase session cookie fallback — same coordinator credentials)
    let signInMethod = 'form'
    await page.goto(ROUTES.login, { waitUntil: 'domcontentloaded' })
    await page.fill('#email', COORDINATOR.email)
    await page.fill('#password', COORDINATOR.password)
    await page.getByRole('button', { name: 'Sign in' }).click()
    try {
      await page.waitForURL((url) => !url.pathname.includes('/login'), {
        timeout: 45_000,
        waitUntil: 'domcontentloaded',
      })
      signInOk = !page.url().includes('/login')
    } catch {
      signInOk = false
    }

    if (!signInOk) {
      const alert = await page.locator('[role="alert"]').textContent().catch(() => null)
      const cookieCount = await injectCoordinatorSession(context)
      await page.goto(ROUTES.commandCenter, { waitUntil: 'domcontentloaded' })
      const ccProbe = await page.locator('body').innerText({ timeout: 60_000 })
      signInOk = /Site Operations Home/i.test(ccProbe)
      signInMethod = signInOk ? 'supabase_session_cookies' : 'failed'
      logFriction({
        step: 1,
        whatCoordinatorSees: alert ?? 'Headless login did not redirect off /login',
        expectedBehavior: 'Form sign-in redirects to command center within a few seconds',
        actualBehavior: `Form redirect timed out; cookie session fallback cookies=${cookieCount} ok=${signInOk}`,
        severity: signInOk ? 'medium' : 'blocker',
        fixRecommendation: signInOk
          ? 'Investigate client router.refresh after sign-in in headless browsers'
          : 'Verify coordinator seed password and staging auth',
        pilotImpact: signInOk
          ? 'Manual browser sign-in likely fine; automate with session for CI'
          : 'Cannot start pilot',
      })
    }

    recordStep(
      1,
      signInOk ? 'pass' : 'fail',
      signInOk ? `Signed in via ${signInMethod} → ${page.url()}` : 'Still unauthenticated',
    )
    routesCompleted.push('login')

    if (!signInOk) {
      throw new Error('Coordinator sign-in failed')
    }

    // 2–3. Command center
    await page.goto(ROUTES.commandCenter, { waitUntil: 'domcontentloaded' })
    const ccBody = await waitForAppReady(page, 'command-center')
    routesCompleted.push('command-center')
    const hasSiteHome = /Site Operations Home/i.test(ccBody)
    const hasWorkQueue = /Coordinator work queue/i.test(ccBody)
    const hasTopActions =
      /Unsigned procedures/i.test(ccBody) || /Next actions/i.test(ccBody) || /top priority/i.test(ccBody)
    recordStep(2, hasSiteHome ? 'pass' : 'fail', hasSiteHome ? 'Site Operations Home visible' : 'Missing site home heading')
    recordStep(3, hasWorkQueue && hasTopActions ? 'pass' : 'warn', `workQueue=${hasWorkQueue} topActions=${hasTopActions}`)

    if (!hasWorkQueue) {
      logFriction({
        step: 3,
        whatCoordinatorSees: ccBody.slice(0, 400),
        expectedBehavior: 'Labeled coordinator work queue buckets',
        actualBehavior: 'Work queue label not found on first paint',
        severity: 'high',
        fixRecommendation: 'Ensure OperationalWorkQueuePanel renders when projections exist',
        pilotImpact: 'Coordinator may not find prioritized work',
      })
    }

    // 4–5. Study workspace
    await page.goto(ROUTES.studyWorkspace, { waitUntil: 'domcontentloaded' })
    const studyBody = await waitForAppReady(page, 'study-workspace')
    routesCompleted.push('study-workspace')
    const studyOk = /Study operations workspace/i.test(studyBody)
    recordStep(4, studyOk ? 'pass' : 'warn', studyOk ? 'Study operations workspace loaded' : 'Study workspace heading unclear')

    // 6–7. Subject workspace
    await page.goto(ROUTES.subjectWorkspace, { waitUntil: 'domcontentloaded' })
    const subjBody = await waitForAppReady(page, 'subject-workspace')
    routesCompleted.push('subject-workspace')
    const subjOk = /Subject workspace|operations/i.test(subjBody)
    const nextActionVisible = /Unsigned procedures|Next action/i.test(subjBody)
    recordStep(6, subjOk ? 'pass' : 'warn', subjOk ? 'Subject workspace loaded' : 'Subject workspace heading unclear')
    recordStep(7, nextActionVisible ? 'pass' : 'warn', `nextActionVisible=${nextActionVisible}`)

    if (!nextActionVisible) {
      logFriction({
        step: 7,
        whatCoordinatorSees: subjBody.slice(0, 400),
        expectedBehavior: 'Clear next action strip for pilot visit',
        actualBehavior: 'Unsigned procedures / next action not visible in body text',
        severity: 'medium',
        fixRecommendation: 'Surface OperationalNextActionStrip when visit orchestration exists',
        pilotImpact: 'Coordinator must drill into visit to see priority',
      })
    }

    // 8–9. Visit + why blocked
    await page.goto(ROUTES.visit, { waitUntil: 'domcontentloaded' })
    const visitBody = await waitForAppReady(page, 'visit')
    routesCompleted.push('visit')
    const whyBlocked = /Why blocked\?/i.test(visitBody)
    const visitBlockedCopy = /Unsigned procedures|Visit completion blocked/i.test(visitBody)
    recordStep(8, visitBlockedCopy ? 'pass' : 'warn', 'Screening visit runtime panel loaded')
    recordStep(9, whyBlocked && visitBlockedCopy ? 'pass' : 'warn', `whyBlocked=${whyBlocked} blockers=${visitBlockedCopy}`)

    if (!whyBlocked) {
      logFriction({
        step: 9,
        whatCoordinatorSees: visitBody.slice(0, 400),
        expectedBehavior: 'Why blocked drawer explains blocked readiness',
        actualBehavior: 'Why blocked? control not found in visible text',
        severity: 'medium',
        fixRecommendation: 'Ensure RuntimeWhyBlockedDrawer opens for blocked visits',
        pilotImpact: 'Harder to explain visit state to PI',
      })
    }

    // 10–14. Capture
    await page.goto(ROUTES.capture, { waitUntil: 'domcontentloaded' })
    const capBody = await waitForAppReady(page, 'capture')
    routesCompleted.push('capture')
    const captureLoaded =
      /CRC capture shell/i.test(capBody) && !/Could not load procedure workflow/i.test(capBody)
    const fallbackError = await page.locator('.text-destructive').allTextContents()
    recordStep(10, captureLoaded ? 'pass' : 'fail', captureLoaded ? 'Capture shell loaded' : 'Capture error or missing shell')
    recordStep(11, captureLoaded ? 'pass' : 'fail', `destructiveAlerts=${fallbackError.length}`)

    if (!captureLoaded) {
      logFriction({
        step: 11,
        whatCoordinatorSees: (fallbackError.join(' ') || capBody).slice(0, 400),
        expectedBehavior: 'Published source form with procedure context',
        actualBehavior: 'Capture shell failed or workflow error panel',
        severity: 'blocker',
        fixRecommendation: 'Resolve capture shell / SDV binding for pilot PE',
        pilotImpact: 'Cannot capture source in pilot',
      })
    }

    const saveBtn = page.getByRole('button', { name: /^Save draft$/i })
    const submitBtn = page.getByRole('button', { name: /Save and submit/i })
    const canSave = await saveBtn.isEnabled().catch(() => false)
    const canSubmit = await submitBtn.isEnabled().catch(() => false)

    if (canSave) {
      saveResult.attempted = true
      await saveBtn.click()
      await page.waitForTimeout(2500)
      const afterSave = await page.locator('body').innerText()
      scanTechnical(afterSave, 'save-draft')
      if (/Data changed on the server|immutable|409/i.test(afterSave)) {
        saveResult.outcome = 'immutable_conflict'
        logFriction({
          step: 12,
          whatCoordinatorSees: afterSave.match(/Data changed[^\n]*/)?.[0] ?? 'Save conflict',
          expectedBehavior: 'Draft saves when response set is editable',
          actualBehavior: '409 / immutable messaging after save',
          severity: 'medium',
          fixRecommendation: 'Refresh capture shell when already submitted; disable save when not mutable',
          pilotImpact: 'Confusing on re-open of submitted source',
        })
      } else if (/saved|success/i.test(afterSave)) {
        saveResult.outcome = 'pass'
      } else {
        saveResult.outcome = 'unknown'
      }
    } else {
      saveResult.outcome = 'disabled'
      logFriction({
        step: 12,
        whatCoordinatorSees: 'Save draft button disabled or absent',
        expectedBehavior: 'Mutable sets allow draft save',
        actualBehavior: 'Save draft not enabled (likely already submitted)',
        severity: 'low',
        fixRecommendation: 'Show read-only state clearly when submitted',
        pilotImpact: 'Expected for pilot fixture; document for coordinators',
      })
    }
    recordStep(12, saveResult.outcome === 'pass' ? 'pass' : 'warn', `save: ${saveResult.outcome}`)

    if (canSubmit) {
      submitResult.attempted = true
      const reason = page.locator('#submit_reason')
      if (await reason.isVisible().catch(() => false)) {
        await reason.fill('Phase 16D supervised coordinator browser walkthrough')
      }
      await submitBtn.click()
      await page.waitForTimeout(3500)
      const afterSubmit = await page.locator('body').innerText()
      scanTechnical(afterSubmit, 'submit')
      submitResult.outcome = /submitted|success|complete/i.test(afterSubmit) ? 'pass' : 'unknown'
    } else {
      submitResult.outcome = 'disabled'
    }
    recordStep(13, submitResult.outcome === 'pass' ? 'pass' : 'warn', `submit: ${submitResult.outcome}`)

    // Sign on capture/visit shell
    const signBtn = page.getByRole('button', { name: /^Sign Procedure$/i })
    if (await signBtn.isVisible().catch(() => false)) {
      signResult.attempted = true
      const disabled = await signBtn.isDisabled()
      if (!disabled) {
        await signBtn.click()
        await page.waitForTimeout(3000)
        const afterSign = await page.locator('body').innerText()
        scanTechnical(afterSign, 'sign')
        const signedBtn = page.getByRole('button', { name: 'Signed', exact: true })
        signResult.outcome = (await signedBtn.isVisible().catch(() => false)) ? 'pass' : 'unknown'
      } else {
        signResult.outcome = 'disabled'
        logFriction({
          step: 14,
          whatCoordinatorSees: 'Sign Procedure disabled',
          expectedBehavior: 'Coordinator can sign when validation complete',
          actualBehavior: 'Button disabled (locked, section disabled, or already signed)',
          severity: 'high',
          fixRecommendation: 'Clarify disable reason in toolbar; complete validation prerequisites',
          pilotImpact: 'Signoff blocked until prerequisites met',
        })
      }
    } else {
      await page.goto(ROUTES.visit, { waitUntil: 'domcontentloaded' })
      await waitForAppReady(page, 'visit-sign')
      const signVisit = page.getByRole('button', { name: /^Sign Procedure$/i })
      if (await signVisit.isVisible().catch(() => false)) {
        signResult.attempted = true
        if (!(await signVisit.isDisabled())) {
          await signVisit.click()
          await page.waitForTimeout(3000)
          signResult.outcome = (await page
            .getByRole('button', { name: 'Signed', exact: true })
            .isVisible()
            .catch(() => false))
            ? 'pass'
            : 'unknown'
        } else {
          signResult.outcome = 'disabled'
        }
      }
    }
    recordStep(14, signResult.outcome === 'pass' ? 'pass' : 'warn', `sign: ${signResult.outcome}`)

    // 15–17. Revisit visit for runtime panel / queues
    await page.goto(ROUTES.visit, { waitUntil: 'domcontentloaded' })
    const visitAfter = await waitForAppReady(page, 'visit-after-actions')
    const panelUpdated = /Unsigned procedures|Signed|Visit completion/i.test(visitAfter)
    const queueOnVisit = /Coordinator work queue|Do now/i.test(visitAfter)
    recordStep(15, panelUpdated ? 'pass' : 'warn', 'Runtime action panel present after actions')
    recordStep(16, queueOnVisit ? 'pass' : 'warn', `workQueueOnVisit=${queueOnVisit}`)
    recordStep(17, consoleErrors.some((e) => TECHNICAL_RE.test(e)) ? 'fail' : 'pass', `consoleErrors=${consoleErrors.length}`)

    if (consoleErrors.length > 0) {
      logFriction({
        step: 17,
        whatCoordinatorSees: `Browser console: ${consoleErrors.slice(0, 3).join('; ')}`,
        expectedBehavior: 'No client errors during walkthrough',
        actualBehavior: `${consoleErrors.length} console error(s)`,
        severity: consoleErrors.some((e) => TECHNICAL_RE.test(e)) ? 'blocker' : 'medium',
        fixRecommendation: 'Fix client exceptions on visit/capture routes',
        pilotImpact: 'May indicate broken UI paths',
      })
    }

    // 18–19 documented in report (snapshots/telemetry verified post-run via dry-run)
    recordStep(18, 'skip', 'Verify via post-walkthrough dry-run (snapshots)')
    recordStep(19, 'skip', 'Verify via post-walkthrough dry-run (telemetry)')
  } catch (err) {
    recordStep('error', 'fail', err instanceof Error ? err.message : String(err))
    logFriction({
      step: 'walkthrough',
      whatCoordinatorSees: 'Walkthrough aborted before completion',
      expectedBehavior: 'All checklist routes load within timeout',
      actualBehavior: err instanceof Error ? err.message : String(err),
      severity: 'blocker',
      fixRecommendation: 'Increase server warm-up; optimize workspace SSR for staging latency',
      pilotImpact: 'Cannot complete supervised path if pages hang',
    })
  } finally {
    await browser.close()
  }

  const comprehension = {
    commandCenter: steps.find((s) => s.step === 3)?.status ?? 'unknown',
    studyWorkspace: steps.find((s) => s.step === 4)?.status ?? 'unknown',
    subjectWorkspace: steps.find((s) => s.step === 7)?.status ?? 'unknown',
    runtimeUi: steps.find((s) => s.step === 9)?.status ?? 'unknown',
    workQueue: steps.find((s) => s.step === 16)?.status ?? 'unknown',
  }

  const blockers = friction.filter((f) => f.severity === 'blocker').length
  const recommendation =
    blockers > 0 || !signInOk
      ? 'NO_GO'
      : friction.filter((f) => f.severity === 'high').length > 2
        ? 'CONDITIONAL_GO'
        : 'GO'

  const report = {
    phase: '16D-coordinator-browser-walkthrough',
    runAt: new Date().toISOString(),
    environment: { baseUrl: BASE_URL, database: 'staging Supabase (via app)' },
    coordinator: { email: COORDINATOR.email },
    fixture: FIXTURE,
    routesCompleted,
    signInOk,
    sourceCapture: steps.find((s) => s.step === 10)?.detail,
    saveResult,
    submitResult,
    signResult,
    comprehension,
    friction,
    steps,
    consoleErrors,
    recommendation,
  }

  mkdirSync(outDir, { recursive: true })
  const jsonPath = resolve(outDir, 'phase16d-coordinator-browser-walkthrough.json')
  writeFileSync(jsonPath, JSON.stringify(report, null, 2))

  const md = buildMd(report)
  const mdPath = resolve(outDir, 'phase16d-coordinator-browser-walkthrough-report.md')
  writeFileSync(mdPath, md)

  console.log('=== Phase 16D Coordinator Browser Walkthrough ===\n')
  for (const s of steps) {
    console.log(`[${s.status.toUpperCase()}] Step ${s.step}: ${s.detail}`)
  }
  console.log(`\nFriction items: ${friction.length}`)
  console.log(`Recommendation (browser only): ${recommendation}`)
  console.log(`Wrote ${mdPath}`)

  if (!signInOk) process.exit(1)
}

function buildMd(report) {
  const lines = [
    '# Phase 16D — Live Coordinator Browser Walkthrough',
    '',
    `**Run at:** ${report.runAt}`,
    `**Recommendation (browser):** ${report.recommendation}`,
    '',
    '## Environment',
    `- App: ${report.environment.baseUrl}`,
    `- Coordinator: ${report.coordinator.email}`,
    '',
    '## Routes completed',
    report.routesCompleted.map((r) => `- ${r}`).join('\n'),
    '',
    '## Friction log',
    '',
  ]
  if (report.friction.length === 0) {
    lines.push('_No friction recorded._')
  } else {
    for (const f of report.friction) {
      lines.push(
        `### Step ${f.step} (${f.severity})`,
        `- **Sees:** ${f.whatCoordinatorSees}`,
        `- **Expected:** ${f.expectedBehavior}`,
        `- **Actual:** ${f.actualBehavior}`,
        `- **Fix:** ${f.fixRecommendation}`,
        `- **Pilot impact:** ${f.pilotImpact}`,
        '',
      )
    }
  }
  return lines.join('\n')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
