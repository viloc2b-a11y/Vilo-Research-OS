import { readFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')

function gate(name: string, pass: boolean, detail: string = '') {
  return { name, pass, detail }
}

async function main() {
  const gates: ReturnType<typeof gate>[] = []

  const migrationPath = join(ROOT, 'supabase', 'migrations', '0074_h4_phase4_delete_protection_guards.sql')
  
  if (!existsSync(migrationPath)) {
    console.error('FAIL: 0074 migration missing')
    process.exit(1)
  }

  const content = readFileSync(migrationPath, 'utf8')

  // BEFORE DELETE triggers/functions exist
  gates.push(gate(
    'SQL contains BEFORE DELETE triggers',
    content.includes('before delete on public.visits') &&
    content.includes('before delete on public.procedure_executions') &&
    content.includes('before delete on public.source_response_sets') &&
    content.includes('before delete on public.source_responses') &&
    content.includes('before delete on public.visit_progress_notes')
  ))

  // visits scheduled exception exists
  gates.push(gate(
    'SQL contains visits scheduled delete guard',
    content.includes("old.visit_status != 'scheduled'")
  ))

  // procedure pending exception exists
  gates.push(gate(
    'SQL contains procedure_executions pending delete guard',
    content.includes("old.execution_status != 'pending'")
  ))

  // source_response_sets draft/archived exception exists
  gates.push(gate(
    'SQL contains source_response_sets draft/archived delete guard',
    content.includes("old.status not in ('draft', 'archived')")
  ))

  // source_responses submitted guard exists
  gates.push(gate(
    'SQL contains source_responses submitted delete guard',
    content.includes("old.is_submitted = true")
  ))

  // visit_progress_notes signed guard exists
  gates.push(gate(
    'SQL contains visit_progress_notes signed delete guard',
    content.includes("old.coordinator_signature_status = 'signed'") &&
    content.includes("old.investigator_review_status = 'signed'")
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

  console.log(JSON.stringify({ phase: 'H4-Phase4-Delete-Protection-Guards', gates }, null, 2))
  
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
