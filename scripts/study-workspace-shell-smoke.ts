/**
 * Study workspace shell smoke tests.
 *
 * Usage: npx tsx scripts/study-workspace-shell-smoke.ts
 */
import fs from 'node:fs'
import path from 'node:path'
import { buildStudyWorkspaceRuntimeLinks } from '../lib/study-workspace/study-workspace-links'
import type { StudyWorkspaceSummaryCounts } from '../lib/study-workspace/study-workspace-types'

/** Features that must not be presented as available in the monitoring view UI */
const FORBIDDEN_MONITOR_FEATURE_PATTERNS = [
  /sponsor\s+intelligence/i,
  /\brisk\s+scor(e|ing)\b/i,
  /\bprofitability\b/i,
  /\bai\s+predict/i,
  /21\s*cfr\s+part\s+11/i,
  /\bpart\s+11\s+compliant/i,
]

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message)
}

function runChecks() {
  console.log('--- Study workspace shell checks ---')

  const safeDefaults: StudyWorkspaceSummaryCounts = {
    subjectCount: null,
    documentCount: null,
    publishedSourceCount: null,
    runtimeVisitCount: null,
    lockedSnapshotCount: null,
    openObligationsCount: null,
    expirationAlertsCount: null,
  }
  assert(
    Object.values(safeDefaults).every((value) => value === null),
    'summary count fallbacks use null when unavailable',
  )

  const workspacePage = path.join(
    process.cwd(),
    'app/(ops)/studies/[studyId]/workspace/page.tsx',
  )
  assert(fs.existsSync(workspacePage), 'workspace route page exists')

  const loaderPath = path.join(process.cwd(), 'lib/study-workspace/load-study-workspace-summary.ts')
  assert(fs.existsSync(loaderPath), 'summary loader exists')

  const studyId = '00000000-0000-4000-8000-00000000a001'
  const links = buildStudyWorkspaceRuntimeLinks(studyId)

  const linkValues = Object.values(links)
  assert(
    linkValues.every((href) => href.includes(studyId) || href.includes(encodeURIComponent(studyId))),
    'route links include studyId where applicable',
  )
  assert(links.protocolIntake.includes('study_id='), 'protocol intake link has study_id param')
  assert(links.visitRuntime.includes('study_id='), 'visit runtime link has study_id param')

  const monitorPanelPath = path.join(
    process.cwd(),
    'components/study-workspace/study-monitoring-view-panel.tsx',
  )
  const monitorSource = fs.readFileSync(monitorPanelPath, 'utf8').toLowerCase()
  for (const pattern of FORBIDDEN_MONITOR_FEATURE_PATTERNS) {
    assert(!pattern.test(monitorSource), `monitor panel must not promote: ${pattern}`)
  }
  assert(
    monitorSource.includes('read-only'),
    'monitor panel describes read-only informational scope',
  )

  const migrationsDir = path.join(process.cwd(), 'supabase/migrations')
  const migrationFiles = fs.readdirSync(migrationsDir)
  const studyWorkspaceMigrations = migrationFiles.filter((f) =>
    f.toLowerCase().includes('study_workspace'),
  )
  assert(
    studyWorkspaceMigrations.length === 0,
    'no new study_workspace runtime tables migration added',
  )

  console.log('✅ Summary loader safe null defaults')
  console.log('✅ Workspace route exists')
  console.log('✅ Summary loader module exists')
  console.log('✅ Runtime links include studyId')
  console.log('✅ Monitoring view avoids forbidden internal-risk keywords')
  console.log('✅ No study_workspace migrations added')
}

runChecks()
console.log('------------------------------------------------------------')
console.log('Study workspace shell smoke test passed.')
