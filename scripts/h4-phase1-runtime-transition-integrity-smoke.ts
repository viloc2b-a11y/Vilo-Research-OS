import { readFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')

function gate(name: string, pass: boolean, detail: string = '') {
  return { name, pass, detail }
}

async function main() {
  const gates: ReturnType<typeof gate>[] = []

  // Check 1: signProcedure.ts has terminal-state guard
  const signProcPath = join(ROOT, 'lib', 'visit-runtime', 'signProcedure.ts')
  if (existsSync(signProcPath)) {
    const content = readFileSync(signProcPath, 'utf8')
    const hasInnerJoin = content.includes('visits!inner(visit_status)')
    const hasTerminalBlock = content.includes("['locked', 'completed', 'cancelled', 'no_show'].includes")
    gates.push(gate('App: signProcedure.ts guards against terminal visit status', hasInnerJoin && hasTerminalBlock, ''))
  } else {
    gates.push(gate('App: signProcedure.ts exists', false, 'Missing file'))
  }

  // Check 2: Coordinator signature requires valid state
  const progNoteActionsPath = join(ROOT, 'lib', 'subject', 'visits', 'progress-note', 'actions.ts')
  if (existsSync(progNoteActionsPath)) {
    const content = readFileSync(progNoteActionsPath, 'utf8')
    const callsGuards = content.includes('loadVisitCloseoutGuards(')
    gates.push(gate('App: Coordinator sign uses loadVisitCloseoutGuards', callsGuards, ''))
  } else {
    gates.push(gate('App: progress-note/actions.ts exists', false, 'Missing file'))
  }

  // Check 3: Investigator signature requires coordinator signature
  const guardsPath = join(ROOT, 'lib', 'subject', 'visits', 'progress-note', 'guards.ts')
  if (existsSync(guardsPath)) {
    const content = readFileSync(guardsPath, 'utf8')
    const requiresCoord = content.includes("investigatorBlockReasons.push('Coordinator must sign the progress note first.')")
    gates.push(gate('App: Investigator signature requires coordinator signature', requiresCoord, ''))
  } else {
    gates.push(gate('App: guards.ts exists', false, 'Missing file'))
  }

  // Check 4: Invalid reopen/sign transitions are blocked in RPCs
  const fixAuditMigrationPath = join(ROOT, 'supabase', 'migrations', '0069_phase11b_fix_audit_blockers.sql')
  if (existsSync(fixAuditMigrationPath)) {
    const content = readFileSync(fixAuditMigrationPath, 'utf8')
    const blocksCoordReopen = content.includes("v_visit.visit_review_status not in ('coordinator_signed', 'investigator_signed')")
    const blocksInvReopen = content.includes("v_visit.visit_review_status is distinct from 'investigator_signed'")
    const blocksInvSign = content.includes("v_visit.visit_review_status is distinct from 'coordinator_signed'")
    gates.push(gate('DB: RPCs block invalid reopen/sign transitions', blocksCoordReopen && blocksInvReopen && blocksInvSign, ''))
  } else {
    gates.push(gate('DB: 0069 migration exists', false, 'Missing file'))
  }

  console.log(JSON.stringify({ phase: 'H4-Phase1-Runtime-Transition-Integrity', gates }, null, 2))
  
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
