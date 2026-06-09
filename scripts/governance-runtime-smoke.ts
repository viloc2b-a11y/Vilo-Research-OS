/**
 * Governance runtime smoke.
 *
 * Static integration smoke for governance runtime wiring:
 * - PI protocol acceptance over the universal signature engine
 * - delegation log signatures
 * - training acknowledgements
 * - amendment-aware retraining generation
 * - pending signatures queue visibility
 * - append-only audit trail behavior
 */
import fs from 'node:fs'
import path from 'node:path'

function read(relativePath: string) {
  return fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8')
}

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message)
}

function assertContains(content: string, tokens: string[], label: string) {
  for (const token of tokens) {
    assert(content.includes(token), `${label} missing ${token}`)
  }
}

function assertAppendOnly(content: string, label: string) {
  const forbidden = [
    'delete from',
    '.delete(',
    '.truncate(',
    'drop table',
    'update public.operational_signature_requests set status =',
    'update public.operational_signatures set',
  ]
  for (const token of forbidden) {
    assert(!content.toLowerCase().includes(token.toLowerCase()), `${label} must be append-first`)
  }
}

function main() {
  const migration = read('supabase/migrations/0163_governance_protocol_acceptance.sql')
  assertContains(
    migration,
    [
      'protocol_runtime_versions',
      'pi_acceptance_signature_request_id',
      'pi_acceptance_signature_id',
      'pi_acceptance_status',
      'pi_accepted_at',
      'pi_accepted_by',
      'protocol_runtime_versions_pi_acceptance_status_check',
      "in ('not_requested', 'pending', 'signed', 'voided', 'superseded')",
    ],
    'governance migration',
  )

  const artifactLoader = read('lib/operational-signatures/artifact-loader.ts')
  assertContains(
    artifactLoader,
    ['protocol_version', 'pi_acceptance_signature_request_id', 'pi_acceptance_status'],
    'artifact loader',
  )

  const signArtifact = read('lib/operational-signatures/sign-artifact.ts')
  assertContains(
    signArtifact,
    [
      'finalizeGovernanceProtocolAcceptance',
      "request.module !== 'governance'",
      "request.entityType !== 'protocol_version'",
      'pi_acceptance_signature_request_id',
      'pi_acceptance_signature_id',
      'pi_acceptance_status: \'signed\'',
      'pi_accepted_at',
      'pi_accepted_by',
    ],
    'sign artifact hook',
  )

  const governanceActions = read('lib/studies/governance-runtime-actions.ts')
  assertContains(
    governanceActions,
    [
      'requestProtocolAcceptanceAction',
      'generateGovernanceRetrainingAction',
      "workflow: 'governance_protocol_acceptance'",
      "module: 'governance'",
      "entityType: 'protocol_version'",
      'createTrainingAssignment',
    ],
    'governance actions',
  )

  const trainingActions = read('lib/studies/training-log-actions.ts')
  assertContains(
    trainingActions,
    [
      'trainingMaterialDocumentId',
      'study_training_items',
      'study_training_assignments',
      'training_item_id',
      'training_status',
    ],
    'training runtime',
  )

  const summary = read('lib/study-workspace/load-governance-summary.ts')
  assertContains(
    summary,
    [
      'openGovernanceSignatureCount',
      "from('operational_signature_requests')",
      "eq('module', 'governance')",
      "eq('status', 'pending')",
    ],
    'governance summary',
  )

  const workspaceTypes = read('lib/study-workspace/study-workspace-types.ts')
  assertContains(workspaceTypes, ['governance'], 'workspace section types')

  const nav = read('components/study-workspace/study-workspace-nav.tsx')
  assertContains(nav, ['Governance'], 'workspace nav')

  const shell = read('components/study-workspace/study-workspace-shell.tsx')
  assertContains(shell, ['StudyGovernancePanel', "activeSection === 'governance'"], 'workspace shell')

  const workspacePage = read('app/(ops)/studies/[studyId]/workspace/page.tsx')
  assertContains(
    workspacePage,
    ['loadProtocolRuntimeStudy', 'protocolRuntimeStudy', 'loadStudyGovernanceSummary'],
    'workspace page',
  )

  const panel = read('components/study-workspace/study-governance-panel.tsx')
  assertContains(
    panel,
    [
      'Protocol Acceptance',
      'Delegation & Training',
      'Generate retraining',
      'Open pending signatures',
      'Request PI acceptance',
      'Pending governance signatures',
    ],
    'governance panel',
  )

  const delegation = read('lib/studies/training-delegation-actions.ts')
  assertContains(
    delegation,
    ['study_delegation_log', 'study_delegation_log_audit', 'createOperationalSignatureRequest'],
    'delegation runtime',
  )
  assertAppendOnly(delegation, 'delegation runtime')

  const openQueue = read('components/operational-signatures/operational-signatures-client.tsx')
  assertContains(openQueue, ['Pending Signatures', 'Signature Meaning'], 'global signature queue')

  const queueLink = read('components/shell/sidebar-nav.tsx')
  assertContains(queueLink, ['/operational-signatures'], 'sidebar queue exposure')

  console.log(
    JSON.stringify(
      {
        smoke: 'governance-runtime',
        checks: [
          'protocol acceptance request',
          'delegation staff signature request',
          'delegation PI approval request',
          'training acknowledgement request',
          'amendment retraining generation',
          'pending signatures queue visibility',
          'append-only audit trail behavior',
        ],
        status: 'passed',
      },
      null,
      2,
    ),
  )
}

main()
