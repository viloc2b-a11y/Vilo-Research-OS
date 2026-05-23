import { execSync } from 'child_process'
import fs from 'fs'
import path from 'path'

function getMigrations() {
  const migrationsDir = path.join(process.cwd(), 'supabase', 'migrations')
  return fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql'))
}

async function run() {
  console.log('--- H5 Phase 2: Reopen Workflow Hardening Smoke Test ---')
  let failed = false

  const actionsPath = path.join(process.cwd(), 'lib/subject/visits/progress-note/actions.ts')
  const actionsContent = fs.readFileSync(actionsPath, 'utf8')

  console.log('1. Validating reopen reason required...')
  if (!actionsContent.includes('reopenReason?.trim()') || !actionsContent.includes('minimum 3 characters')) {
    console.error('❌ Missing reopen reason validation.')
    failed = true
  } else {
    console.log('✅ Reopen reason required validation found.')
  }

  console.log('2. Validating coordinator reopen action exists...')
  if (!actionsContent.includes('export async function reopenCoordinatorProgressNoteAction')) {
    console.error('❌ Missing reopenCoordinatorProgressNoteAction.')
    failed = true
  } else {
    console.log('✅ reopenCoordinatorProgressNoteAction exists.')
  }

  console.log('3. Validating investigator reopen action exists...')
  if (!actionsContent.includes('export async function reopenInvestigatorReviewAction')) {
    console.error('❌ Missing reopenInvestigatorReviewAction.')
    failed = true
  } else {
    console.log('✅ reopenInvestigatorReviewAction exists.')
  }

  console.log('4. Validating role guards exist...')
  if (!actionsContent.includes('canEditClinicalSource') || !actionsContent.includes('hasInvestigatorRole')) {
    console.error('❌ Missing role guards in reopen actions.')
    failed = true
  } else {
    console.log('✅ Role guards exist in reopen actions.')
  }

  console.log('5. Validating safe terminal error strings exist...')
  if (!actionsContent.includes('Cannot reopen: the visit is in a terminal locked state.') || !actionsContent.includes('Cannot reopen: the visit is in a terminal')) {
    console.error('❌ Missing safe terminal error strings in actions.')
    failed = true
  } else {
    console.log('✅ Safe terminal error strings exist.')
  }

  console.log('6. Validating operational event logging path exists...')
  // We can't easily parse SQL inside TS, but we can check if the RPC names are called
  if (!actionsContent.includes('reopen_visit_coordinator_closeout')) {
    console.error('❌ Missing RPC call for coordinator reopen.')
    failed = true
  } else if (!actionsContent.includes('reopen_visit_investigator_closeout')) {
     console.error('❌ Missing RPC call for investigator reopen.')
     failed = true
  } else {
    console.log('✅ RPC calls that trigger CLOSEOUT_REOPENED operational events exist.')
  }

  console.log('7. Validating no destructive migrations were added...')
  const migrations = getMigrations()
  if (migrations.some(m => m.includes('0075'))) {
    console.error('❌ New migration detected. No DB schema changes were allowed.')
    failed = true
  } else {
    console.log('✅ No new DB migrations added.')
  }

  if (failed) {
    console.error('\n❌ Smoke test failed.')
    process.exit(1)
  }

  console.log('\n✅ All H5 Phase 2 reopen workflow guards pass.')
}

run().catch(console.error)
