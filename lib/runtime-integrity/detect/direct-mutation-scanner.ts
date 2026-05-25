import fs from 'node:fs'
import path from 'node:path'
import { EMISSION_PROXIMITY_CHARS } from '@/lib/runtime-integrity/constants'
import {
  isClinicalExecutionTable,
  isDerivedProjectionTable,
} from '@/lib/runtime-integrity/clinical-tables'

export type DirectMutationFinding = {
  file: string
  line: number
  column: number
  table: string
  operation: 'update' | 'insert' | 'delete' | 'upsert'
  hasEmissionHint: boolean
  severity: 'blocker' | 'warning' | 'info'
  message: string
}

const MUTATION_PATTERN =
  /\.from\s*\(\s*['"]([a-z_][a-z0-9_]*)['"]\s*\)\s*\.\s*(update|insert|delete|upsert)\s*\(/gi

const EMISSION_HINT_PATTERN =
  /ClinicalMutationGateway|emitClinicalOperationalEvent|emitVisitClinicalEvent|emitStudyClinicalEvent|emitClinicalProfileBridgeEvent|emitSubjectChartSpineEvent|emitSubjectEnrollmentRollback|emitWorkflowActionCreatedEvent|appendVisitCloseoutEvent|logOperationalEvent|logProcedureOperationalEvent|logVisitOperationalEvent|logSourceEngineOperationalEvent|emitRuntimeAutomationReversed|workflowCreateEventType|workflowResolveEventType|\.rpc\s*\(/i

/** Paths allowed to mutate clinical tables without adjacent emission (or derived-only). */
const APPROVED_PATH_PREFIXES = [
  'lib/operations/',
  'lib/projections/persist.ts',
  'lib/projections/refresh.ts',
  'lib/projections/rebuild.ts',
  'lib/runtime-replay/persist.ts',
  'lib/safety-continuity/persist.ts',
  'lib/operational-intelligence/persist.ts',
  'lib/financial-runtime/persist.ts',
  'lib/coordinator-orchestration/persist.ts',
  'lib/runtime-automation/persist.ts',
  'lib/projections/runtime-projection-persist.ts',
  'lib/governance-fabric/signals.ts',
  'lib/governance-fabric/capa-placeholder.ts',
  'lib/protocol-graph/publish.ts',
]

const APPROVED_FILE_EXACT = new Set([
  'lib/visits/generateSubjectVisitSchedule.ts',
])

export function isApprovedMutationPath(relativePath: string): boolean {
  const normalized = relativePath.replace(/\\/g, '/')
  if (APPROVED_FILE_EXACT.has(normalized)) return true
  return APPROVED_PATH_PREFIXES.some((p) => normalized.startsWith(p))
}

function lineColumnFromIndex(content: string, index: number): { line: number; column: number } {
  const before = content.slice(0, index)
  const lines = before.split('\n')
  return { line: lines.length, column: (lines[lines.length - 1]?.length ?? 0) + 1 }
}

function hasEmissionHintNear(content: string, matchIndex: number): boolean {
  const start = Math.max(0, matchIndex - EMISSION_PROXIMITY_CHARS)
  const end = Math.min(content.length, matchIndex + EMISSION_PROXIMITY_CHARS)
  return EMISSION_HINT_PATTERN.test(content.slice(start, end))
}

export function scanSourceForDirectMutations(
  content: string,
  relativePath: string,
): DirectMutationFinding[] {
  const findings: DirectMutationFinding[] = []
  const normalized = relativePath.replace(/\\/g, '/')

  if (normalized.includes('.test.') || normalized.includes('.spec.')) return findings
  if (normalized.startsWith('scripts/') && !normalized.includes('runtime-integrity')) {
    // scripts may provision data — skip unless explicitly scanned
    return findings
  }

  const approved = isApprovedMutationPath(normalized)

  MUTATION_PATTERN.lastIndex = 0
  let match: RegExpExecArray | null
  while ((match = MUTATION_PATTERN.exec(content)) !== null) {
    const table = match[1]
    const operation = match[2].toLowerCase() as DirectMutationFinding['operation']

    if (isDerivedProjectionTable(table)) continue
    if (!isClinicalExecutionTable(table)) continue

    const { line, column } = lineColumnFromIndex(content, match.index)
    const hasEmissionHint = hasEmissionHintNear(content, match.index)

    let severity: DirectMutationFinding['severity'] = 'info'
    let message = `Clinical table ${table}.${operation}()`

    if (approved) {
      severity = 'info'
      message += ' (approved path)'
    } else if (!hasEmissionHint) {
      severity = 'blocker'
      message += ' without spine emission hint — use ClinicalMutationGateway or RPC'
    } else {
      severity = 'warning'
      message += ' with nearby emission hint — verify gateway envelope'
    }

    findings.push({
      file: normalized,
      line,
      column,
      table,
      operation,
      hasEmissionHint,
      severity,
      message,
    })
  }

  return findings
}

export function scanDirectoryForDirectMutations(rootDir: string): DirectMutationFinding[] {
  const findings: DirectMutationFinding[] = []

  function walk(dir: string) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        if (entry.name === 'node_modules' || entry.name === '.next') continue
        walk(full)
        continue
      }
      if (!entry.name.endsWith('.ts') && !entry.name.endsWith('.tsx')) continue
      const rel = path.relative(rootDir, full).replace(/\\/g, '/')
      if (!rel.startsWith('lib/')) continue
      const content = fs.readFileSync(full, 'utf8')
      findings.push(...scanSourceForDirectMutations(content, rel))
    }
  }

  walk(rootDir)
  return findings
}

export function summarizeDirectMutationFindings(findings: DirectMutationFinding[]): {
  total: number
  blockers: number
  warnings: number
  byTable: Record<string, number>
} {
  const byTable: Record<string, number> = {}
  let blockers = 0
  let warnings = 0
  for (const f of findings) {
    byTable[f.table] = (byTable[f.table] ?? 0) + 1
    if (f.severity === 'blocker') blockers += 1
    if (f.severity === 'warning') warnings += 1
  }
  return { total: findings.length, blockers, warnings, byTable }
}
