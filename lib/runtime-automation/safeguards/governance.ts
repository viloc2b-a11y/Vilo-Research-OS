import type {
  AutomationGovernanceSafeguard,
  ProposedAutomationAction,
} from '@/lib/runtime-automation/types'

const FORBIDDEN_APPLY_KINDS = new Set([
  'auto_complete_procedure',
  'bypass_signature',
  'mutate_protocol',
])

export function evaluateAutomationGovernanceSafeguards(input: {
  proposedActions: ProposedAutomationAction[]
  hasClinicalMutationAttempt?: boolean
}): AutomationGovernanceSafeguard[] {
  const safeguards: AutomationGovernanceSafeguard[] = []

  safeguards.push({
    id: 'safeguard:no-silent-clinical-mutation',
    severity: 'error',
    label: 'No silent clinical mutation',
    detail: 'Automation never mutates procedures, signatures, or protocol truth without coordinator action.',
    blocksApply: Boolean(input.hasClinicalMutationAttempt),
  })

  safeguards.push({
    id: 'safeguard:coordinator-supervised',
    severity: 'warning',
    label: 'Coordinator supervisory authority',
    detail: 'Apply path requires explicit coordinator actor; proposed plan alone has no clinical effect.',
    blocksApply: false,
  })

  safeguards.push({
    id: 'safeguard:spine-events-required',
    severity: 'error',
    label: 'Spine events on apply',
    detail: 'Applied, reversed, and overridden automation must emit operational_events.',
    blocksApply: false,
  })

  for (const action of input.proposedActions) {
    if (FORBIDDEN_APPLY_KINDS.has(action.kind)) {
      safeguards.push({
        id: `safeguard:forbidden:${action.id}`,
        severity: 'error',
        label: 'Forbidden automation action',
        detail: `Action ${action.kind} is not permitted.`,
        blocksApply: true,
      })
    }
  }

  const materializeCount = input.proposedActions.filter(
    (a) => a.kind === 'materialize_workflow',
  ).length
  if (materializeCount > 4) {
    safeguards.push({
      id: 'safeguard:workflow-flood',
      severity: 'warning',
      label: 'Workflow materialization cap',
      detail: 'Too many workflow materializations proposed — coordinator should triage manually.',
      blocksApply: false,
    })
  }

  return safeguards
}

export function applyBlockedBySafeguards(safeguards: AutomationGovernanceSafeguard[]): boolean {
  return safeguards.some((s) => s.blocksApply)
}
