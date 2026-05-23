import { readFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')

function gate(name: string, pass: boolean, detail: string = '') {
  return { name, pass, detail }
}

async function main() {
  const gates: ReturnType<typeof gate>[] = []

  const migrationPath = join(ROOT, 'supabase', 'migrations', '0073_h4_phase2_db_runtime_integrity.sql')
  
  if (!existsSync(migrationPath)) {
    console.error('FAIL: 0073 migration missing')
    process.exit(1)
  }

  const content = readFileSync(migrationPath, 'utf8')

  // operational_events immutability guard
  gates.push(gate(
    'SQL contains operational_events immutability guard',
    content.includes('operational_events_immutability_guard') && content.includes('before update or delete on public.operational_events')
  ))

  // visits runtime transition guard
  gates.push(gate(
    'SQL contains visits runtime transition guard',
    content.includes('visits_runtime_guard') && content.includes('before update on public.visits')
  ))

  // procedure_executions runtime guard
  gates.push(gate(
    'SQL contains procedure_executions runtime guard',
    content.includes('procedure_executions_runtime_guard') && content.includes('before update on public.procedure_executions')
  ))

  // terminal visit statuses locked/cancelled/no_show
  gates.push(gate(
    'SQL blocks transitions out of terminal visit statuses',
    content.includes("old.visit_status in ('locked', 'cancelled', 'no_show')") && content.includes('is distinct from old.visit_status')
  ))

  // completed -> locked allowed
  gates.push(gate(
    'SQL allows completed -> locked transition',
    content.includes("old.visit_status = 'completed' and new.visit_status not in ('completed', 'locked')")
  ))

  // completed procedure -> verified allowed
  gates.push(gate(
    'SQL allows completed -> verified procedure execution when visit is completed',
    content.includes("not (old.execution_status = 'completed' and new.execution_status = 'verified')") && content.includes("only verification is allowed when visit is completed")
  ))

  // no DROP TABLE
  gates.push(gate(
    'SQL does not contain destructive DROP TABLE',
    !content.match(/drop\s+table\s+/i)
  ))

  // no destructive ALTER TABLE
  gates.push(gate(
    'SQL does not contain destructive ALTER TABLE DROP COLUMN',
    !content.match(/alter\s+table\s+.*?drop\s+column/i)
  ))

  console.log(JSON.stringify({ phase: 'H4-Phase2-DB-Runtime-Integrity', gates }, null, 2))
  
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
