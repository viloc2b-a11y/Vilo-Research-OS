import { readFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')

function gate(name: string, pass: boolean, detail: string = '') {
  return { name, pass, detail }
}

async function main() {
  const gates: ReturnType<typeof gate>[] = []

  // Check 1: Unique constraint on visits (Phase 11A)
  const p0MigrationPath = join(ROOT, 'supabase', 'migrations', '0067_phase11a_runtime_safety_p0.sql')
  if (existsSync(p0MigrationPath)) {
    const content = readFileSync(p0MigrationPath, 'utf8')
    const hasVisitUidx = content.includes('visits_subject_visit_def_active_uidx')
    gates.push(gate('DB: visits table has unique active visit constraint', hasVisitUidx, ''))
  } else {
    gates.push(gate('DB: 0067 migration exists', false, 'Missing file'))
  }

  // Check 2: Unique constraint on procedure_executions
  const procMigrationPath = join(ROOT, 'supabase', 'migrations', '0009_procedure_executions.sql')
  if (existsSync(procMigrationPath)) {
    const content = readFileSync(procMigrationPath, 'utf8')
    const hasProcUidx = content.includes('unique (visit_id, procedure_definition_id)')
    gates.push(gate('DB: procedure_executions has unique constraint', hasProcUidx, ''))
  } else {
    gates.push(gate('DB: 0009 migration exists', false, 'Missing file'))
  }

  // Check 3: RPC handles unique violation
  const fixAuditMigrationPath = join(ROOT, 'supabase', 'migrations', '0069_phase11b_fix_audit_blockers.sql')
  if (existsSync(fixAuditMigrationPath)) {
    const content = readFileSync(fixAuditMigrationPath, 'utf8')
    const rpcCatchesUnique = content.includes('when unique_violation then') && content.includes('continue;')
    gates.push(gate('DB: RPC generate_subject_visit_schedule handles unique_violation', rpcCatchesUnique, ''))
  } else {
    gates.push(gate('DB: 0069 migration exists', false, 'Missing file'))
  }

  // Check 4: Application fallback handles 23505
  const genSchedulePath = join(ROOT, 'lib', 'visits', 'generateSubjectVisitSchedule.ts')
  if (existsSync(genSchedulePath)) {
    const content = readFileSync(genSchedulePath, 'utf8')
    const appCatches23505 = content.includes("visitErr.code === '23505'") && content.includes('existingDefIds.add')
    gates.push(gate('App: Legacy fallback handles 23505 unique constraint violation', appCatches23505, ''))
  } else {
    gates.push(gate('App: generateSubjectVisitSchedule.ts exists', false, 'Missing file'))
  }

  console.log(JSON.stringify({ phase: 'H3-Phase4-Runtime-Duplicate-Guards', gates }, null, 2))
  
  const failed = gates.filter((g) => !g.pass)
  if (failed.length > 0) {
    console.error('FAIL', failed)
    process.exit(1)
  }
  console.log('PASS')
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
