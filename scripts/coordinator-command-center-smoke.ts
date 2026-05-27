/**
 * Coordinator Command Center smoke.
 * Static/read-model guardrails for the K1-K5 operational consolidation layer.
 */
import fs from 'node:fs'
import path from 'node:path'

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message)
}

function read(relativePath: string) {
  return fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8')
}

function assertContainsAll(content: string, tokens: string[], label: string) {
  for (const token of tokens) {
    assert(content.includes(token), `${label} missing ${token}`)
  }
}

function assertNoMutation(relativePath: string) {
  const content = read(relativePath)
  const forbidden = [
    ['.ins', 'ert('].join(''),
    ['.upd', 'ate('].join(''),
    ['.ups', 'ert('].join(''),
    ['.del', 'ete('].join(''),
    ['.r', 'pc('].join(''),
    'set_active_reference',
    'publishRuntime',
    'publish_source_package',
    'approveReconciliation',
    'signOperationalArtifact',
    'createOperationalSignatureRequest',
  ]
  for (const token of forbidden) {
    assert(!content.includes(token), `${relativePath} must not mutate via ${token}`)
  }
}

function runChecks() {
  console.log('--- Coordinator Command Center checks ---')

  const page = read('app/(ops)/coordinator-command-center/page.tsx')
  assert(page.includes('CoordinatorCommandCenterView'), 'page renders command center view')
  assert(page.includes('canAccessCoordinatorWorkspace'), 'page enforces coordinator access')
  assert(page.includes('getPrimaryOrganizationId'), 'page requires organization scope')

  const loader = read('lib/coordinator-command-center/load-coordinator-command-center.ts')
  assertContainsAll(
    loader,
    [
      "from('source_blueprint_evidence')",
      "from('source_blueprint_draft_suggestions')",
      "from('operational_signature_requests')",
      "from('runtime_source_packages')",
      "from('runtime_source_package_publications')",
      "from('operational_review_queries')",
      "from('document_intelligence_active_reference_events')",
      ".eq('organization_id', args.organizationId)",
      ".eq('study_id', validSelectedStudyId)",
      "pending_review",
      "superseded_candidate",
      "suggestion_status', 'draft'",
      "status', 'pending'",
    ],
    'read model',
  )

  const view = read('components/coordinator-command-center/coordinator-command-center-view.tsx')
  assertContainsAll(
    view,
    [
      'Pending Evidence Reviews',
      'Pending Draft Suggestions',
      'Pending Signatures',
      'Runtime/Publication Alerts',
      'Protocol Change / Version Drift Alerts',
      'Pending Review',
      'Requires Signature',
      'Runtime Alert',
      'Version Change',
      'Coordinator Action Needed',
      'read-only',
    ],
    'view',
  )

  const section = read('components/coordinator-command-center/command-center-section.tsx')
  assertContainsAll(
    loader,
    [
      'Review Evidence',
      'Open Lineage',
      'Review Suggestion',
      'Open Evidence',
      'Review Before Signing',
      'Open Signature Workflow',
    ],
    'actions',
  )

  for (const relativePath of [
    'lib/coordinator-command-center/load-coordinator-command-center.ts',
    'app/(ops)/coordinator-command-center/page.tsx',
    'components/coordinator-command-center/coordinator-command-center-view.tsx',
    'components/coordinator-command-center/command-center-section.tsx',
  ]) {
    assertNoMutation(relativePath)
  }

  const allCommandCenter = [
    page,
    loader,
    view,
    section,
    read('components/coordinator-command-center/command-center-utils.ts'),
  ].join('\n')
  for (const forbidden of [
    ['AI', ' recommendation'].join(''),
    ['Autonomous', ' workflow'].join(''),
    ['Auto', '-approved'].join(''),
    ['Smart', ' runtime'].join(''),
    ['Self-healing', ' workflow'].join(''),
  ]) {
    assert(!allCommandCenter.includes(forbidden), `forbidden label absent: ${forbidden}`)
  }

  const packageJson = read('package.json')
  assert(
    packageJson.includes('coordinator-command-center:smoke'),
    'smoke script is registered',
  )

  console.log('OK Pending evidence, draft, and signature queues')
  console.log('OK Runtime and version drift alerts')
  console.log('OK Organization/study filtering contract')
  console.log('OK Read-only/no mutation guardrails')
}

runChecks()
console.log('------------------------------------------------------------')
console.log('Coordinator Command Center smoke test passed.')
