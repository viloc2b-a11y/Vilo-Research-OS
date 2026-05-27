/**
 * K3 smoke: Evidence-backed Blueprint Drafting.
 * Static guardrails for draft suggestions only; no runtime/publish/reconciliation writes.
 */
import fs from 'node:fs'
import path from 'node:path'
import {
  DRAFT_SUGGESTION_STATUS,
  DRAFT_SUGGESTION_TYPE,
} from '../lib/source-blueprint-drafting/draft-suggestion-types'

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message)
}

function read(relativePath: string) {
  return fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8')
}

function assertNoForbiddenRuntimeMutation(relativePath: string) {
  const content = read(relativePath)
  const forbidden = [
    "from('runtime_source_packages')",
    "from('runtime_source_visit_shells')",
    "from('runtime_source_procedure_shells')",
    "from('runtime_source_package_publications')",
    "from('runtime_source_publication_events')",
    "from('published_source_definition_versions')",
    "from('published_source_sections')",
    "from('published_source_fields')",
    "from('visit_instances')",
    "from('visit_procedure_instances')",
    'publishRuntime',
    'publish_source_package',
    'approveReconciliation',
  ]

  for (const token of forbidden) {
    assert(!content.includes(token), `${relativePath} must not contain ${token}`)
  }
}

function runChecks() {
  console.log('--- Source Blueprint Drafting K3 checks ---')

  const migration = read('supabase/migrations/0131_source_blueprint_draft_suggestions.sql')
  assert(migration.includes('source_blueprint_draft_suggestions'), 'suggestion table exists')
  assert(migration.includes('evidence_id uuid not null'), 'suggestion stores evidence_id')
  assert(migration.includes("'accepted_for_manual_use'"), 'manual-use review status exists')
  assert(migration.includes('user_has_study_access(study_id)'), 'RLS uses study access')
  assert(
    !migration.replace(/--[^\n]*/g, '').includes('organization_id = auth.uid()'),
    'RLS does not use organization_id = auth.uid()',
  )

  const createSource = read('lib/source-blueprint-drafting/create-draft-suggestions.ts')
  assert(
    createSource.includes('evidenceStatus: EVIDENCE_STATUS.MAPPED'),
    'suggestions load mapped evidence only',
  )
  assert(
    !createSource.includes('PENDING_REVIEW') &&
      !createSource.includes('REJECTED') &&
      !createSource.includes('SUPERSEDED_CANDIDATE'),
    'pending/rejected/superseded candidate evidence is not selected',
  )
  assert(createSource.includes('loadEvidenceLineage'), 'suggestions include lineage')
  assert(createSource.includes('runtimeMutated: false'), 'payload records no runtime mutation')
  assert(
    createSource.includes('publishedSourceMutated: false'),
    'payload records no published source mutation',
  )
  assert(
    createSource.includes('reconciliationMutated: false'),
    'payload records no reconciliation mutation',
  )

  const reviewSource = read('lib/source-blueprint-drafting/review-draft-suggestion.ts')
  assert(
    reviewSource.includes(".from('source_blueprint_draft_suggestions')"),
    'review updates suggestion table',
  )
  assert(reviewSource.includes('reviewed_by'), 'review stores reviewer')
  assert(reviewSource.includes('reviewed_at'), 'review stores review timestamp')
  assert(reviewSource.includes('review_notes'), 'review stores notes')

  const libDir = path.join(process.cwd(), 'lib/source-blueprint-drafting')
  for (const file of fs.readdirSync(libDir).filter((name) => name.endsWith('.ts'))) {
    assertNoForbiddenRuntimeMutation(path.join('lib/source-blueprint-drafting', file))
  }
  assertNoForbiddenRuntimeMutation('app/api/source-blueprint-drafting/suggest/route.ts')
  assertNoForbiddenRuntimeMutation('app/api/source-blueprint-drafting/list/route.ts')
  assertNoForbiddenRuntimeMutation('app/api/source-blueprint-drafting/[id]/review/route.ts')

  const ui = read('components/source-blueprint-drafting/draft-suggestion-queue.tsx')
  assert(ui.includes('Draft Suggestion'), 'UI uses Draft Suggestion language')
  assert(ui.includes('Evidence-backed'), 'UI uses Evidence-backed language')
  assert(ui.includes('No runtime changes occur automatically'), 'UI states no automatic runtime changes')
  assert(
    !ui.includes('AI final source') &&
      !ui.includes('Auto-generated source') &&
      !ui.includes('Runtime approved') &&
      !ui.includes('Ready for execution'),
    'forbidden UI language absent',
  )

  assert(DRAFT_SUGGESTION_TYPE.SOURCE_SECTION === 'source_section', 'source_section type')
  assert(DRAFT_SUGGESTION_TYPE.SOURCE_FIELD === 'source_field', 'source_field type')
  assert(
    DRAFT_SUGGESTION_STATUS.ACCEPTED_FOR_MANUAL_USE === 'accepted_for_manual_use',
    'manual-use status',
  )

  console.log('✅ Suggestion schema + RLS')
  console.log('✅ Mapped evidence only')
  console.log('✅ No runtime/publish/reconciliation mutation paths')
  console.log('✅ Review audit fields')
  console.log('✅ Coordinator UI language')
}

runChecks()
console.log('------------------------------------------------------------')
console.log('Source Blueprint Drafting K3 smoke test passed.')
