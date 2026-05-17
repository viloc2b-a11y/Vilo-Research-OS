/**
 * Phase 5.6A — Combined post-submit writes regression runner.
 *
 * Orchestrates existing harnesses (no logic duplication):
 *   - 5.3B correction shell E2E
 *   - 5.4B addendum shell E2E
 *   - 5.5B findings action E2E
 *
 *   npm run db:validate-phase56a-post-submit-writes-e2e
 *   npm run db:validate-phase56a-post-submit-writes-e2e:live -- --organization-id ...
 *
 * Combined report: tmp/runtime-e2e/phase56a-post-submit-writes-e2e-report.json
 */

import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const REPORT_DIR = join(ROOT, 'tmp/runtime-e2e')
const COMBINED_REPORT_PATH = join(REPORT_DIR, 'phase56a-post-submit-writes-e2e-report.json')

const PHASES = [
  {
    key: 'correction',
    phase: '5.3B',
    title: 'Post-submit correction shell',
    script: 'validate-phase53b-correction-shell-e2e.mjs',
    reportFile: 'phase53b-correction-shell-e2e-report.json',
  },
  {
    key: 'addendum',
    phase: '5.4B',
    title: 'Post-submit addendum shell',
    script: 'validate-phase54b-addendum-shell-e2e.mjs',
    reportFile: 'phase54b-addendum-shell-e2e-report.json',
  },
  {
    key: 'findings',
    phase: '5.5B',
    title: 'Findings lifecycle actions',
    script: 'validate-phase55b-findings-action-e2e.mjs',
    reportFile: 'phase55b-findings-action-e2e-report.json',
  },
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
  console.log(`Phase 5.6A Post-submit writes regression runner

Runs correction (5.3B), addendum (5.4B), and findings (5.5B) harnesses sequentially.

Options:
  --live                         Pass --live to each child harness
  --base-url <url>               Forward to children (default http://localhost:3000)
  --organization-id <uuid>       Required for live mode
  --org-b-id <uuid>              Cross-tenant probe (forwarded)
  --fresh                        Fresh procedure_execution per harness (default)
  --no-fresh                     Reuse discovery semantics from child harnesses

Examples:
  npm run db:validate-phase56a-post-submit-writes-e2e
  npm run db:validate-phase56a-post-submit-writes-e2e:live -- \\
    --organization-id <uuid> --base-url http://localhost:3001
`)
}

function buildChildArgv(args) {
  const childArgv = []
  if (args.live) childArgv.push('--live')
  if (args.fresh) childArgv.push('--fresh')
  else childArgv.push('--no-fresh')
  if (args.baseUrl) childArgv.push('--base-url', args.baseUrl)
  if (args.organizationId) childArgv.push('--organization-id', args.organizationId)
  if (args.orgBId) childArgv.push('--org-b-id', args.orgBId)
  return childArgv
}

function readChildReport(reportPath) {
  if (!existsSync(reportPath)) return null
  try {
    return JSON.parse(readFileSync(reportPath, 'utf8'))
  } catch {
    return null
  }
}

function collectBlockingDefects(childReport, exitCode) {
  const defects = []
  if (exitCode !== 0) {
    defects.push({
      type: 'exit_code',
      detail: `child process exit code ${exitCode}`,
    })
  }
  for (const gap of childReport?.gaps ?? []) {
    defects.push({ type: 'gap', detail: gap })
  }
  for (const step of childReport?.steps ?? []) {
    if (step.status !== 'fail') continue
    defects.push({
      type: 'step',
      step: step.step ?? step.id,
      detail: step.detail ?? null,
      route: step.route ?? null,
      http_status: step.http_status ?? null,
      expected: step.expected ?? null,
      actual: step.actual ?? null,
      errors: step.errors ?? null,
    })
  }
  return defects
}

function sumSummary(target, source) {
  if (!source) return
  target.passed += source.passed ?? 0
  target.failed += source.failed ?? 0
  target.skipped += source.skipped ?? 0
  target.blocked += source.blocked ?? 0
  target.planned += source.planned ?? 0
}

function runChildHarness(phase, args) {
  const scriptPath = join(ROOT, 'scripts', phase.script)
  const reportPath = join(REPORT_DIR, phase.reportFile)
  const childArgv = buildChildArgv(args)

  console.log(`\n--- Phase ${phase.phase} ${phase.key}: ${phase.title} ---`)
  console.log(`> node scripts/${phase.script} ${childArgv.join(' ')}\n`)

  const result = spawnSync(process.execPath, [scriptPath, ...childArgv], {
    cwd: ROOT,
    stdio: 'inherit',
    env: process.env,
  })

  const childReport = readChildReport(reportPath)
  const exitCode = result.status ?? 1
  const blockingDefects = collectBlockingDefects(childReport, exitCode)
  const ok =
    exitCode === 0 &&
    blockingDefects.length === 0 &&
    (childReport?.ok !== false || childReport == null)

  return {
    phase: phase.phase,
    key: phase.key,
    title: phase.title,
    script: phase.script,
    ok,
    exit_code: exitCode,
    signal: result.signal ?? null,
    report_path: reportPath,
    report_exists: existsSync(reportPath),
    mode: childReport?.mode ?? (args.live ? 'live' : 'planning'),
    summary: childReport?.summary ?? null,
    gaps: childReport?.gaps ?? [],
    blocking_defects: blockingDefects,
    child_report: childReport
      ? {
          phase: childReport.phase,
          ok: childReport.ok,
          started_at: childReport.started_at,
          finished_at: childReport.finished_at,
        }
      : null,
  }
}

function finish(report) {
  report.finished_at = new Date().toISOString()
  mkdirSync(REPORT_DIR, { recursive: true })
  writeFileSync(COMBINED_REPORT_PATH, JSON.stringify(report, null, 2))

  const { passed, failed, skipped, blocked, planned, phases_ok, phases_failed } =
    report.summary

  console.log('\n=== Phase 5.6A post-submit writes regression ===')
  for (const p of report.phases) {
    const s = p.summary
    const counts = s
      ? `pass=${s.passed} fail=${s.failed} skip=${s.skipped} blocked=${s.blocked} planned=${s.planned}`
      : 'no child summary'
    console.log(
      `  ${p.phase} ${p.key}: ${p.ok ? 'PASS' : 'FAIL'} (${counts}) → ${p.report_path}`,
    )
  }
  console.log(
    `\nTotal: pass=${passed} fail=${failed} skip=${skipped} blocked=${blocked} planned=${planned} | phases ok=${phases_ok} failed=${phases_failed}`,
  )
  console.log(`Combined report: ${COMBINED_REPORT_PATH}`)

  if (report.blocking_defects.length) {
    console.log('\nBlocking defects:')
    for (const d of report.blocking_defects) {
      const loc = d.phase ? `[${d.phase} ${d.key}] ` : ''
      if (d.type === 'step') {
        console.log(`  - ${loc}${d.step}: ${d.detail ?? 'failed'}`)
      } else {
        console.log(`  - ${loc}${d.type}: ${d.detail}`)
      }
    }
  }
}

async function main() {
  const args = parseArgs(process.argv)
  const startedAt = new Date().toISOString()

  const report = {
    phase: '5.6A',
    mode: args.live ? 'live' : 'planning',
    base_url: args.baseUrl,
    organization_id: args.organizationId,
    fresh: args.fresh,
    started_at: startedAt,
    ok: true,
    summary: {
      passed: 0,
      failed: 0,
      skipped: 0,
      blocked: 0,
      planned: 0,
      phases_ok: 0,
      phases_failed: 0,
    },
    phases: [],
    blocking_defects: [],
    report_paths: {
      combined: COMBINED_REPORT_PATH,
      correction: join(REPORT_DIR, PHASES[0].reportFile),
      addendum: join(REPORT_DIR, PHASES[1].reportFile),
      findings: join(REPORT_DIR, PHASES[2].reportFile),
    },
  }

  for (const phase of PHASES) {
    const result = runChildHarness(phase, args)
    const { child_report: _omit, ...phaseEntry } = result
    report.phases.push(phaseEntry)

    sumSummary(report.summary, result.summary)
    if (result.ok) report.summary.phases_ok++
    else {
      report.summary.phases_failed++
      report.ok = false
      for (const defect of result.blocking_defects) {
        report.blocking_defects.push({
          phase: result.phase,
          key: result.key,
          ...defect,
        })
      }
    }
  }

  finish(report)
  process.exit(report.ok ? 0 : 1)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
