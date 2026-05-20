/**
 * Phase 7A — VPI read layer structural validator.
 *
 * Static checks (no DB): module layout, facade delegation, no query fan-out in UI.
 * Run: npm run db:validate-phase7a-read-layer
 *
 * Pair with: npx tsc --noEmit && npm run build
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const projectRoot = resolve(__dirname, '..')

const results = {
  runAt: new Date().toISOString(),
  phase: '7A',
  checks: [],
  summary: { passed: 0, failed: 0 },
}

function record(name, ok, detail = '') {
  results.checks.push({ name, status: ok ? 'PASS' : 'FAIL', detail })
  if (ok) results.summary.passed++
  else results.summary.failed++
}

function read(rel) {
  return readFileSync(join(projectRoot, rel), 'utf8')
}

function fileExists(rel) {
  return existsSync(join(projectRoot, rel))
}

const REQUIRED_READ_LAYER_FILES = [
  'lib/performance/types.ts',
  'lib/performance/read-layer/index.ts',
  'lib/performance/read-layer/scope.ts',
  'lib/performance/read-layer/aggregator.ts',
  'lib/performance/read-layer/query/supabase-client.ts',
  'lib/performance/read-layer/query/query-limits.ts',
  'lib/performance/read-layer/signals/index.ts',
  'lib/performance/read-layer/signals/study-signals.ts',
  'lib/performance/read-layer/signals/visit-signals.ts',
  'lib/performance/read-layer/signals/procedure-signals.ts',
  'lib/performance/read-layer/signals/workflow-signals.ts',
  'lib/performance/read-layer/signals/subject-signals.ts',
  'lib/performance/read-layer/signals/data-capture-signals.ts',
  'lib/performance/read-layer/signals/event-signals.ts',
]

for (const rel of REQUIRED_READ_LAYER_FILES) {
  record(`file exists: ${rel}`, fileExists(rel), fileExists(rel) ? 'ok' : 'missing')
}

const facade = read('app/(ops)/performance/_lib/performance-read-model.ts')
record(
  'loadPerformanceReadModel exports',
  /export\s+async\s+function\s+loadPerformanceReadModel/.test(facade),
)
record(
  'facade delegates to read-layer',
  facade.includes('buildPerformanceReadModel') && facade.includes('resolveScope'),
)
record(
  'facade is thin (< 80 lines)',
  facade.split('\n').length < 80,
  `lines=${facade.split('\n').length}`,
)
record(
  'facade has no supabase.from',
  !/\.from\s*\(\s*['"]/.test(facade),
)

const aggregator = read('lib/performance/read-layer/aggregator.ts')
record(
  'aggregator implements buildPerformanceReadModel',
  /export\s+async\s+function\s+buildPerformanceReadModel/.test(aggregator),
)
record(
  'aggregator has no NotImplementedError skeleton',
  !aggregator.includes('NotImplementedError') && !aggregator.includes('PR1 skeleton'),
)

const FORBIDDEN_CHART_LIBS = [
  'recharts',
  'chart.js',
  'react-chartjs-2',
  'victory',
  'nivo',
  '@visx/',
  'echarts',
  'plotly.js',
]

function walkTsFiles(dir, acc = []) {
  if (!existsSync(dir)) return acc
  for (const name of readdirSync(dir)) {
    const full = join(dir, name)
    const st = statSync(full)
    if (st.isDirectory()) walkTsFiles(full, acc)
    else if (/\.(tsx?|jsx?)$/.test(name)) acc.push(full)
  }
  return acc
}

const performanceRoots = [
  join(projectRoot, 'app/(ops)/performance'),
].flatMap((root) => walkTsFiles(root))

let chartImportFound = false
for (const file of performanceRoots) {
  const text = readFileSync(file, 'utf8')
  if (FORBIDDEN_CHART_LIBS.some((lib) => text.includes(lib))) {
    chartImportFound = true
    break
  }
}
record('no chart libraries in performance routes', !chartImportFound)

const UI_QUERY_PATTERN = /\.from\s*\(\s*['"](?:visits|studies|procedure_executions|subject_workflow_actions|study_subjects)['"]/
const uiFiles = [
  ...walkTsFiles(join(projectRoot, 'app/(ops)/performance')),
].filter((f) => !f.includes('_lib'))

let uiQueryFanOut = false
for (const file of uiFiles) {
  if (UI_QUERY_PATTERN.test(readFileSync(file, 'utf8'))) {
    uiQueryFanOut = true
    break
  }
}
record('no operational Supabase fan-out in performance UI', !uiQueryFanOut)

const SIGNAL_FILES = REQUIRED_READ_LAYER_FILES.filter((f) => f.includes('/signals/') && f.endsWith('.ts'))
let signalsHaveQueries = false
for (const rel of SIGNAL_FILES) {
  const body = read(rel)
  if (/\.from\s*\(\s*['"]/.test(body) || body.includes('exactCount')) {
    signalsHaveQueries = true
    break
  }
}
record('signal modules host operational reads', signalsHaveQueries)

const limits = read('lib/performance/read-layer/query/query-limits.ts')
record(
  'query-limits is source of truth',
  limits.includes('RISK_VISITS_QUERY_LIMIT') && !limits.includes("from '@/app/(ops)/performance"),
)

const legacyLimits = read('app/(ops)/performance/_lib/performance-query-limits.ts')
record(
  'legacy query-limits re-exports read-layer',
  legacyLimits.includes("from '@/lib/performance/read-layer/query/query-limits'"),
)

console.log(JSON.stringify(results, null, 2))

if (results.summary.failed > 0) {
  console.error(`\nPhase 7A validator: ${results.summary.failed} check(s) failed.`)
  process.exit(1)
}

console.log(`\nPhase 7A validator: all ${results.summary.passed} checks passed.`)
