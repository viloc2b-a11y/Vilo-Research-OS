/**
 * Phase 16H — Coordinator operational usability smoke (scroll, calendar, clinical tabs).
 *
 * Run: node scripts/phase16h-coordinator-operational-usability-smoke.mjs
 * Requires: npx playwright install chromium (first run)
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const outDir = resolve(root, '.runtime-validation')

const BASE_URL = process.env.E2E_BASE_URL?.trim() ?? process.env.E2E_APP_BASE_URL?.trim() ?? 'http://localhost:3000'
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

const SCROLL_BOTTOM = {
  'command-center': '#recent-events',
  'operational-calendar': null,
  'study-workspace': null,
  'subject-workspace': null,
  'subject-chart': null,
  visit: null,
  'source-capture': null,
}

const ROUTES = [
  { id: 'command-center', path: '/command-center', scrollMarker: /Data shown is read-only/i },
  { id: 'operational-calendar', path: '/operational-calendar', scrollMarker: /Operational Calendar/i },
  {
    id: 'study-workspace',
    path: `/studies/${FIXTURE.studyId}/workspace`,
    scrollMarker: /Study operations workspace/i,
  },
  {
    id: 'subject-workspace',
    path: `/subjects/${FIXTURE.studySubjectId}/workspace`,
    scrollMarker: /What can I do here now/i,
  },
  {
    id: 'subject-chart',
    path: `/subjects/${FIXTURE.studySubjectId}`,
    scrollMarker: /Subject /i,
  },
  { id: 'visit', path: `/visits/${FIXTURE.visitId}`, scrollMarker: /What can I do on this visit/i },
  {
    id: 'source-capture',
    path: `/source/capture/${FIXTURE.procedureExecutionId}?organization_id=${FIXTURE.organizationId}`,
    scrollMarker: /capture shell|Source capture/i,
  },
]

const SERVER_ERROR_RE =
  /This page couldn't load|A server error occurred|Application error: a server-side exception/i
const TECHNICAL_RE =
  /\b(violates|constraint|row-level|pg_|supabase|42P01|stack trace|digest)\b/i

/** @type {Array<Record<string, unknown>>} */
const results = []

function record(entry) {
  results.push(entry)
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

async function assertPageScrollable(page, bottomSelector) {
  const metrics = await page.evaluate((selector) => {
    const candidates = Array.from(document.querySelectorAll('.overflow-y-auto, .scrollbar-thin'))
    const scrollEl =
      candidates.find((el) => el.scrollHeight > el.clientHeight + 8) ??
      document.scrollingElement ??
      document.documentElement
    const before = scrollEl.scrollTop
    scrollEl.scrollTop = scrollEl.scrollHeight
    const after = scrollEl.scrollTop
    let bottomVisible = false
    if (selector) {
      const target = document.querySelector(selector)
      if (target) {
        const rect = target.getBoundingClientRect()
        const hostRect = scrollEl.getBoundingClientRect?.() ?? {
          top: 0,
          bottom: window.innerHeight,
        }
        bottomVisible = rect.top >= hostRect.top && rect.bottom <= hostRect.bottom + 2
      }
    }
    return {
      scrollHeight: scrollEl.scrollHeight,
      clientHeight: scrollEl.clientHeight,
      scrolled: after > before,
      scrollTop: after,
      bottomVisible,
      hostTag: scrollEl.tagName,
    }
  }, bottomSelector ?? null)

  const scrollable = metrics.scrollHeight > metrics.clientHeight + 40
  if (!scrollable) {
    return { ok: true, note: 'short_page_no_scroll_needed' }
  }
  if (!metrics.scrolled && metrics.scrollTop === 0) {
    return { ok: false, note: 'overflow_blocked' }
  }
  if (bottomSelector && !metrics.bottomVisible) {
    return { ok: false, note: 'bottom_not_reachable' }
  }
  return { ok: true, note: 'scrolled' }
}

async function main() {
  const { loadEnvFiles } = await import('./lib/env.mjs')
  loadEnvFiles()

  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({
    baseURL: BASE_URL,
    viewport: { width: 900, height: 640 },
  })
  const page = await context.newPage()
  page.setDefaultNavigationTimeout(120_000)
  page.setDefaultTimeout(60_000)

  let signedIn = false
  try {
    await page.goto('/login', { waitUntil: 'domcontentloaded' })
    await page.fill('#email', COORDINATOR.email)
    await page.fill('#password', COORDINATOR.password)
    await page.getByRole('button', { name: 'Sign in' }).click()
    try {
      await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 45_000 })
      signedIn = !page.url().includes('/login')
    } catch {
      signedIn = false
    }
    if (!signedIn) {
      await injectCoordinatorSession(context)
      await page.goto('/command-center', { waitUntil: 'domcontentloaded' })
      const probe = await page.locator('body').innerText({ timeout: 60_000 })
      signedIn = /Site Operations Home/i.test(probe)
    }
    record({ step: 'sign-in', status: signedIn ? 'pass' : 'fail', baseUrl: BASE_URL })

    if (!signedIn) {
      throw new Error('Coordinator sign-in failed')
    }

    for (const route of ROUTES) {
      await page.goto(route.path, { waitUntil: 'domcontentloaded' })
      try {
        await page.waitForLoadState('networkidle', { timeout: 25_000 })
      } catch {
        // staging latency
      }
      const body = await page.locator('body').innerText({ timeout: 60_000 })
      const serverError = SERVER_ERROR_RE.test(body)
      const technicalLeak = TECHNICAL_RE.test(body)
      const markerOk = route.scrollMarker.test(body)
      const scroll = await assertPageScrollable(page, SCROLL_BOTTOM[route.id] ?? null)

      record({
        route: route.id,
        path: route.path,
        status: serverError ? 'fail' : markerOk && scroll.ok ? 'pass' : 'warn',
        serverError,
        technicalLeak,
        markerOk,
        scroll,
      })
    }

    // Command center → calendar link
    await page.goto('/command-center', { waitUntil: 'domcontentloaded' })
    const ccBody = await page.locator('body').innerText()
    const calendarLinkVisible = /Open operational calendar/i.test(ccBody)
    record({
      route: 'calendar-from-command-center',
      status: calendarLinkVisible ? 'pass' : 'fail',
      calendarLinkVisible,
    })

    if (calendarLinkVisible) {
      await page.getByRole('link', { name: 'Open operational calendar' }).first().click()
      await page.waitForLoadState('domcontentloaded')
      const calBody = await page.locator('body').innerText()
      record({
        route: 'calendar-navigation',
        status: /Operational Calendar/i.test(calBody) && !SERVER_ERROR_RE.test(calBody) ? 'pass' : 'fail',
      })
    }

    // Clinical tabs on subject chart
    for (const tab of ['conmeds', 'clinical-profile', 'adverse-events']) {
      const path = `/studies/${FIXTURE.studyId}/subjects/${FIXTURE.studySubjectId}?tab=${tab}`
      await page.goto(path, { waitUntil: 'domcontentloaded' })
      const tabBody = await page.locator('body').innerText({ timeout: 60_000 })
      record({
        route: `subject-tab-${tab}`,
        path,
        status: SERVER_ERROR_RE.test(tabBody) ? 'fail' : 'pass',
        serverError: SERVER_ERROR_RE.test(tabBody),
        safeErrorPanel: /We couldn't load this section/i.test(tabBody),
      })
    }
  } finally {
    await browser.close()
  }

  const failures = results.filter((r) => r.status === 'fail')
  const report = {
    phase: '16h-coordinator-operational-usability',
    baseUrl: BASE_URL,
    generatedAt: new Date().toISOString(),
    pass: failures.length === 0,
    failureCount: failures.length,
    results,
  }

  mkdirSync(outDir, { recursive: true })
  writeFileSync(
    resolve(outDir, 'phase16h-coordinator-operational-usability.json'),
    `${JSON.stringify(report, null, 2)}\n`,
  )

  console.log(JSON.stringify(report, null, 2))
  if (failures.length > 0) {
    process.exitCode = 1
  }
}

main().catch((err) => {
  console.error(err)
  process.exitCode = 1
})
