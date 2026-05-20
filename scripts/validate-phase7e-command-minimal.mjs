/**
 * Phase 7E — Command Center (minimal) validator.
 *
 * Run: npm run db:validate-phase7e-command-minimal
 */
import { existsSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const projectRoot = resolve(__dirname, '..')

const results = {
  runAt: new Date().toISOString(),
  phase: '7E',
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

function exists(rel) {
  return existsSync(join(projectRoot, rel))
}

const routes = [
  'app/(ops)/performance/page.tsx',
  'app/(ops)/performance/today/page.tsx',
  'app/(ops)/performance/risks/page.tsx',
  'app/(ops)/performance/layout.tsx',
]

for (const route of routes) {
  record(`route exists: ${route}`, exists(route))
}

const layout = read('app/(ops)/performance/layout.tsx')
record('performance layout has command nav', layout.includes('PerformanceCommandNav'))

const portfolioPage = read('app/(ops)/performance/page.tsx')
record('portfolio uses StudyHealthTable', portfolioPage.includes('StudyHealthTable'))
record('portfolio uses PortfolioStateBanner', portfolioPage.includes('PortfolioStateBanner'))
record('visit snapshot collapsed by default', portfolioPage.includes('<details'))

const todayPage = read('app/(ops)/performance/today/page.tsx')
record('today uses CoordinatorTodayInbox', todayPage.includes('CoordinatorTodayInbox'))

const risksPage = read('app/(ops)/performance/risks/page.tsx')
record('risks uses OwnerWorkflowQueue', risksPage.includes('OwnerWorkflowQueue'))

const typesTs = read('app/(ops)/performance/_lib/performance-types.ts')
record('read model has portfolioSummary', typesTs.includes('portfolioSummary'))
record('read model has coordinatorLoad', typesTs.includes('coordinatorLoad'))

const rpcTs = read('lib/performance/read-layer/rpc-dashboard.ts')
record('RPC maps coordinator load', rpcTs.includes('mapCoordinatorLoadRows'))

const sidebarNav = read('components/shell/sidebar-nav.tsx')
for (const href of ['/performance', '/performance/today', '/performance/risks']) {
  record(`sidebar sub-nav: ${href}`, sidebarNav.includes(`'${href}'`))
}

const FORBIDDEN_CHART_LIBS = ['recharts', 'chart.js', 'd3', 'plotly.js']
let chartHit = false
for (const rel of [
  'app/(ops)/performance/page.tsx',
  'app/(ops)/performance/today/page.tsx',
  'app/(ops)/performance/risks/page.tsx',
]) {
  const text = read(rel)
  if (FORBIDDEN_CHART_LIBS.some((lib) => text.includes(lib))) chartHit = true
}
record('no chart libraries in command routes', !chartHit)

const aggregator = read('lib/performance/read-layer/aggregator.ts')
record('VPI load telemetry hook', aggregator.includes('recordVpiLoadTelemetryIfOverBudget'))
record('telemetry event type', read('lib/operations/event-types.ts').includes('VPI_LOAD_TELEMETRY'))

console.log(JSON.stringify(results, null, 2))
const exitCode = results.summary.failed > 0 ? 1 : 0
console.log(
  exitCode === 0
    ? `\nPhase 7E validator: ${results.summary.passed} passed`
    : `\nPhase 7E validator: ${results.summary.failed} failed`,
)
process.exit(exitCode)
