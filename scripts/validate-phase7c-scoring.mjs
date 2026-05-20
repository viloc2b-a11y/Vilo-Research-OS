/**
 * Phase 7C — VPI Scoring Lite validator.
 *
 * Static: scoring module layout, controlled vocabulary, dedupe/sort wiring, no chart libs.
 * Unit: mirrors subject/study scoring rules in pure JS (no DB).
 *
 * Run: npm run db:validate-phase7c-scoring
 * Pair with: npx tsc --noEmit && npm run build
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const projectRoot = resolve(__dirname, '..')

const results = {
  runAt: new Date().toISOString(),
  phase: '7C',
  checks: [],
  summary: { passed: 0, failed: 0, skipped: 0 },
}

function record(name, status, detail = '') {
  results.checks.push({ name, status, detail: String(detail ?? '') })
  if (status === 'PASS') results.summary.passed++
  else if (status === 'FAIL') results.summary.failed++
  else results.summary.skipped++
}

function read(rel) {
  return readFileSync(join(projectRoot, rel), 'utf8')
}

function fileExists(rel) {
  return existsSync(join(projectRoot, rel))
}

function walkTsFiles(dir, acc = []) {
  if (!existsSync(dir)) return acc
  for (const name of readdirSync(dir)) {
    const full = join(dir, name)
    if (statSync(full).isDirectory()) walkTsFiles(full, acc)
    else if (/\.(tsx?|jsx?)$/.test(name)) acc.push(full)
  }
  return acc
}

const SCORING_FILES = [
  'lib/performance/scoring/types.ts',
  'lib/performance/scoring/subject-scoring.ts',
  'lib/performance/scoring/study-scoring.ts',
  'lib/performance/scoring/recommended-actions.ts',
  'lib/performance/scoring/risk-queue.ts',
  'lib/performance/scoring/index.ts',
  'lib/performance/scoring/enrich-read-model.ts',
]

for (const rel of SCORING_FILES) {
  record(`scoring file exists: ${rel}`, fileExists(rel) ? 'PASS' : 'FAIL')
}

const typesTs = read('lib/performance/scoring/types.ts')
for (const state of ['healthy', 'watch', 'risk', 'critical']) {
  record(`operational state defined: ${state}`, typesTs.includes(`'${state}'`) ? 'PASS' : 'FAIL')
}

const actionsTs = read('lib/performance/scoring/recommended-actions.ts')
const CONTROLLED_ACTIONS = [
  'contact_subject_today',
  'resolve_blocked_validation',
  'obtain_pi_signature',
  'reschedule_visit',
  'review_open_query',
  'triage_assignment',
  'review_stale_study',
]
record(
  'recommended actions controlled vocabulary',
  CONTROLLED_ACTIONS.every((code) => actionsTs.includes(`'${code}'`)) ? 'PASS' : 'FAIL',
)

const riskQueueTs = read('lib/performance/scoring/risk-queue.ts')
record('dedupe by subject_id', /dedupeScoredSubjectsBySubjectId/.test(riskQueueTs) ? 'PASS' : 'FAIL')
record('severity sort uses priorityRank', /priorityRank/.test(riskQueueTs) ? 'PASS' : 'FAIL')
record('priorityRank not in queue item return', !/priorityRank.*SubjectRiskQueueItem/.test(riskQueueTs) ? 'PASS' : 'FAIL')

const rpcTs = read('lib/performance/read-layer/rpc-dashboard.ts')
const signalsTs = read('lib/performance/read-layer/build-from-signals.ts')
record('RPC path uses buildScoredRiskQueueFromVpiRows', rpcTs.includes('buildScoredRiskQueueFromVpiRows') ? 'PASS' : 'FAIL')
record('RPC path enriches study cards', rpcTs.includes('enrichStudyCardFromVpiRow') ? 'PASS' : 'FAIL')
record('fallback uses buildFallbackSubjectSignals', signalsTs.includes('buildFallbackSubjectSignals') ? 'PASS' : 'FAIL')
record('fallback uses buildScoredRiskQueueFromSignals', signalsTs.includes('buildScoredRiskQueueFromSignals') ? 'PASS' : 'FAIL')
record('fallback enriches study cards', signalsTs.includes('enrichStudyCardFromHealth') ? 'PASS' : 'FAIL')

const migrationsDir = join(projectRoot, 'supabase/migrations')
const migrationTexts = existsSync(migrationsDir)
  ? readdirSync(migrationsDir)
      .filter((f) => f.endsWith('.sql'))
      .map((f) => readFileSync(join(migrationsDir, f), 'utf8'))
      .join('\n')
  : ''
record(
  'no scoring rule tables in migrations',
  !/create\s+table\s+.*scoring/i.test(migrationTexts) &&
    !/vpi_scoring_rule/i.test(migrationTexts)
    ? 'PASS'
    : 'FAIL',
)

const FORBIDDEN_CHART_LIBS = ['recharts', 'chart.js', 'react-chartjs-2', 'victory', 'nivo', '@visx/', 'echarts', 'plotly.js', 'd3']
const perfDirs = [
  join(projectRoot, 'app/(ops)/performance'),
  join(projectRoot, 'lib/performance'),
]
let chartHit = false
for (const dir of perfDirs) {
  for (const file of walkTsFiles(dir)) {
    const text = readFileSync(file, 'utf8')
    if (FORBIDDEN_CHART_LIBS.some((lib) => text.includes(lib))) {
      chartHit = true
      break
    }
  }
  if (chartHit) break
}
record('no chart libraries in performance code', chartHit ? 'FAIL' : 'PASS')

// --- Pure JS unit mirrors (subject + study scoring) ---

const STATE_PRIORITY_RANK = { healthy: 0, watch: 1, risk: 2, critical: 3 }

function operationalStateForSubjectSignalKind(kind) {
  if (['blocked_procedure', 'missed_visit', 'out_of_window'].includes(kind)) return 'critical'
  if (['overdue_action', 'window_closing_today'].includes(kind)) return 'risk'
  if (['unsigned_procedure_48h', 'window_warning', 'stale_subject'].includes(kind)) return 'watch'
  return 'healthy'
}

function resolveStudyOperationalState(input) {
  if (input.blockedProcedureCount > 0 || input.missedVisitCount > 2) return 'critical'
  if (input.openQueryCount > 5 || input.openFindingsCount > 3) return 'risk'
  if (
    input.unsignedOver48hCount > 0 ||
    input.visitsClosingWindowToday > 0 ||
    input.staleStudyFlag
  ) {
    return 'watch'
  }
  return 'healthy'
}

function dedupeBySubject(scored) {
  const bySubject = new Map()
  for (const row of scored) {
    const key = `${row.studyId}:${row.subjectId}`
    const existing = bySubject.get(key)
    if (!existing || row.priorityRank > existing.priorityRank) {
      bySubject.set(key, row)
    } else if (
      row.priorityRank === existing.priorityRank &&
      row.sortDate < existing.sortDate
    ) {
      bySubject.set(key, row)
    }
  }
  return [...bySubject.values()]
}

record(
  'unit: subject blocked_procedure => critical',
  operationalStateForSubjectSignalKind('blocked_procedure') === 'critical' ? 'PASS' : 'FAIL',
)
record(
  'unit: subject overdue_action => risk',
  operationalStateForSubjectSignalKind('overdue_action') === 'risk' ? 'PASS' : 'FAIL',
)
record(
  'unit: subject window_warning => watch',
  operationalStateForSubjectSignalKind('window_warning') === 'watch' ? 'PASS' : 'FAIL',
)
record(
  'unit: study blocked procedures => critical',
  resolveStudyOperationalState({
    blockedProcedureCount: 1,
    missedVisitCount: 0,
    openQueryCount: 0,
    openFindingsCount: 0,
    unsignedOver48hCount: 0,
    visitsClosingWindowToday: 0,
    staleStudyFlag: false,
  }) === 'critical'
    ? 'PASS'
    : 'FAIL',
)
record(
  'unit: study open queries => risk',
  resolveStudyOperationalState({
    blockedProcedureCount: 0,
    missedVisitCount: 0,
    openQueryCount: 6,
    openFindingsCount: 0,
    unsignedOver48hCount: 0,
    visitsClosingWindowToday: 0,
    staleStudyFlag: false,
  }) === 'risk'
    ? 'PASS'
    : 'FAIL',
)
record(
  'unit: study stale flag => watch',
  resolveStudyOperationalState({
    blockedProcedureCount: 0,
    missedVisitCount: 0,
    openQueryCount: 0,
    openFindingsCount: 0,
    unsignedOver48hCount: 0,
    visitsClosingWindowToday: 0,
    staleStudyFlag: true,
  }) === 'watch'
    ? 'PASS'
    : 'FAIL',
)

const deduped = dedupeBySubject([
  {
    studyId: 's1',
    subjectId: 'sub1',
    priorityRank: STATE_PRIORITY_RANK.watch,
    sortDate: '2026-01-02',
  },
  {
    studyId: 's1',
    subjectId: 'sub1',
    priorityRank: STATE_PRIORITY_RANK.critical,
    sortDate: '2026-01-10',
  },
])
record(
  'unit: dedupe keeps highest severity per subject',
  deduped.length === 1 && deduped[0].priorityRank === STATE_PRIORITY_RANK.critical ? 'PASS' : 'FAIL',
)

const sorted = [...deduped,
  {
    studyId: 's1',
    subjectId: 'sub2',
    priorityRank: STATE_PRIORITY_RANK.risk,
    sortDate: '2026-01-01',
  },
  {
    studyId: 's1',
    subjectId: 'sub3',
    priorityRank: STATE_PRIORITY_RANK.watch,
    sortDate: '2026-01-01',
  },
].sort((a, b) => {
  const rankDelta = b.priorityRank - a.priorityRank
  if (rankDelta !== 0) return rankDelta
  return a.sortDate.localeCompare(b.sortDate)
})
record(
  'unit: sort critical before risk before watch',
  sorted[0].priorityRank >= sorted[1].priorityRank &&
    sorted[1].priorityRank >= sorted[2].priorityRank
    ? 'PASS'
    : 'FAIL',
)

console.log(JSON.stringify(results, null, 2))
const exitCode = results.summary.failed > 0 ? 1 : 0
if (exitCode === 0) {
  console.log(`\nPhase 7C scoring validator: ${results.summary.passed} passed`)
} else {
  console.error(`\nPhase 7C scoring validator: ${results.summary.failed} failed`)
}
process.exit(exitCode)
