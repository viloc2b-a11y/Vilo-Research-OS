/**
 * Visit runtime study scope smoke: query-param preselection and workspace links.
 */
import fs from 'node:fs'
import path from 'node:path'
import { buildStudyWorkspaceRuntimeLinks } from '../lib/study-workspace/study-workspace-links'
import {
  resolveInitialVisitRuntimeStudy,
  resolveVisitRuntimeClientStudyId,
} from '../lib/visit-runtime-execution/resolve-initial-visit-runtime-study'

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message)
}

function read(relativePath: string) {
  return fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8')
}

function runChecks() {
  console.log('--- Visit runtime study scope checks ---')

  const studyA = '00000000-0000-4000-8000-0000000000a1'
  const studyB = '00000000-0000-4000-8000-0000000000b2'
  const accessible = [studyA, studyB]

  const valid = resolveInitialVisitRuntimeStudy({
    queryStudyId: studyB,
    accessibleStudyIds: accessible,
  })
  assert(valid.initialStudyId === studyB, 'valid query study_id resolves to initialStudyId')
  assert(!valid.invalidStudyIdFromQuery, 'valid query is not marked invalid')

  const invalid = resolveInitialVisitRuntimeStudy({
    queryStudyId: '00000000-0000-4000-8000-00009999',
    accessibleStudyIds: accessible,
  })
  assert(invalid.initialStudyId === null, 'invalid query does not set initialStudyId')
  assert(invalid.invalidStudyIdFromQuery, 'invalid query is flagged')

  const none = resolveInitialVisitRuntimeStudy({
    queryStudyId: null,
    accessibleStudyIds: accessible,
  })
  assert(none.initialStudyId === null && !none.invalidStudyIdFromQuery, 'missing query is neutral')

  const clientValid = resolveVisitRuntimeClientStudyId(
    accessible.map((id) => ({ id })),
    studyB,
    false,
  )
  assert(clientValid === studyB, 'client preselects validated study_id')

  const clientInvalid = resolveVisitRuntimeClientStudyId(
    accessible.map((id) => ({ id })),
    null,
    true,
  )
  assert(clientInvalid === '', 'invalid query does not fall back to studies[0]')

  const clientDefault = resolveVisitRuntimeClientStudyId(
    accessible.map((id) => ({ id })),
    null,
    false,
  )
  assert(clientDefault === studyA, 'no query defaults to first accessible study')

  const pageSource = read('app/(ops)/visit-runtime/page.tsx')
  assert(pageSource.includes('searchParams'), 'visit runtime page reads searchParams')
  assert(
    pageSource.includes('resolveInitialVisitRuntimeStudy'),
    'visit runtime page validates study_id server-side',
  )

  const clientSource = read('components/visit-runtime-execution/visit-runtime-client.tsx')
  assert(clientSource.includes('useSearchParams'), 'visit runtime client syncs study_id in URL')
  assert(
    clientSource.includes('invalidStudyIdFromQuery'),
    'visit runtime client handles invalid study_id query',
  )
  assert(
    !clientSource.includes('useState(studies[0]?.id'),
    'visit runtime client does not unconditionally default to studies[0]',
  )

  const studyId = '00000000-0000-4000-8000-0000000000c3'
  const links = buildStudyWorkspaceRuntimeLinks(studyId)
  assert(
    links.operationalSignatures === `/operational-signatures?study_id=${encodeURIComponent(studyId)}`,
    'workspace link includes operational signatures with study_id',
  )
  assert(
    links.visitRuntime === `/visit-runtime?study_id=${encodeURIComponent(studyId)}`,
    'workspace visit runtime link preserves study_id',
  )

  console.log('OK query study_id preselection resolver')
  console.log('OK invalid study_id does not default to studies[0]')
  console.log('OK visit runtime route and client honor study scope')
  console.log('OK study workspace operational signatures link')
}

runChecks()
console.log('------------------------------------------------------------')
console.log('Visit runtime study scope smoke test passed.')
