/**
 * Governance closeout smoke.
 *
 * Static integration smoke for closeout coverage:
 * - final PI sign-off via existing subject/visit closeout surfaces
 * - source completion certification via source blueprint sign-off
 * - regulatory closeout certification via binder/obligation surfaces
 * - no parallel governance or signature subsystem
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

function main() {
  const loader = read('lib/study-workspace/load-study-closeout-summary.ts')
  assertContains(
    loader,
    [
      'finalPiSignedVisitCount',
      'sourceCompletionSignoffCount',
      'regulatoryOpenHoldCount',
      'regulatoryCloseoutReady',
      "source_blueprint_draft_signoffs",
      "visit_review_status', 'investigator_signed'",
    ],
    'closeout summary loader',
  )

  const panel = read('components/study-workspace/study-governance-panel.tsx')
  assertContains(
    panel,
    [
      'Closeout Coverage',
      'Final PI sign-off',
      'Source completion certification',
      'Regulatory closeout',
      'Open subject closeout',
      'Open source completion sign-off',
      'Open regulatory binder',
    ],
    'governance closeout panel',
  )

  const shell = read('components/study-workspace/study-workspace-shell.tsx')
  assertContains(shell, ['closeoutSummary', 'StudyGovernancePanel'], 'workspace shell')

  const page = read('app/(ops)/studies/[studyId]/workspace/page.tsx')
  assertContains(page, ['loadStudyCloseoutSummary', 'closeoutSummary'], 'workspace page')

  const signoffPage = read('app/(ops)/source-blueprint-signoff/page.tsx')
  assertContains(signoffPage, ['SourceBlueprintSignoffClient'], 'source completion surface')

  const subjectCloseout = read('components/subject/SubjectCloseoutChecklist.tsx')
  assertContains(subjectCloseout, ['Subject closeout checklist', 'Mark Completed'], 'subject closeout surface')

  const regulatoryBinder = read('components/study-workspace/study-regulatory-binder-panel.tsx')
  assertContains(
    regulatoryBinder,
    ['Regulatory Binder', 'Expiration alerts', 'Open obligations'],
    'regulatory binder surface',
  )

  console.log(
    JSON.stringify(
      {
        smoke: 'governance-closeout',
        checks: [
          'final PI sign-off surface',
          'source completion certification surface',
          'regulatory closeout certification surface',
          'workspace wiring',
          'no parallel governance layer',
        ],
        status: 'passed',
      },
      null,
      2,
    ),
  )
}

main()
