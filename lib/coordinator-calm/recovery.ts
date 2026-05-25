/**
 * Recovery-first workflow helpers — continuity over judgment (site-internal).
 */

export type RecoverableWorkflow = {
  workflowId: string
  workflowLabel: string
  priority: number
  recoveryKind: 'blocked' | 'signoff' | 'source' | 'stale_flow'
  nextStep: string
  href?: string | null
  scopeLabel?: string | null
}

export type RecoveryFlowInput = {
  workflows: RecoverableWorkflow[]
  /** Prior visit/source the coordinator was working on. */
  lastActiveWorkflowId?: string | null
}

export type RecoveryGrouping = {
  primary: RecoverableWorkflow[]
  secondary: RecoverableWorkflow[]
  suppressedNoiseCount: number
}

function recoveryWeight(flow: RecoverableWorkflow): number {
  let weight = flow.priority
  if (flow.recoveryKind === 'blocked') weight += 50
  if (flow.recoveryKind === 'signoff') weight += 45
  if (flow.recoveryKind === 'source') weight += 40
  if (flow.recoveryKind === 'stale_flow') weight += 20
  return weight
}

export function suppressRecoveryNoise(flows: RecoverableWorkflow[]): {
  visible: RecoverableWorkflow[]
  suppressedCount: number
} {
  const byKey = new Map<string, RecoverableWorkflow>()
  let suppressedCount = 0

  for (const flow of flows) {
    const key = `${flow.recoveryKind}:${flow.workflowLabel}`.toLowerCase()
    const existing = byKey.get(key)
    if (existing) {
      suppressedCount += 1
      if (recoveryWeight(flow) > recoveryWeight(existing)) {
        byKey.set(key, flow)
      }
      continue
    }
    byKey.set(key, flow)
  }

  return {
    visible: Array.from(byKey.values()).sort((a, b) => recoveryWeight(b) - recoveryWeight(a)),
    suppressedCount,
  }
}

export function continueWhereLeftOff(
  input: RecoveryFlowInput,
): RecoverableWorkflow | null {
  if (!input.lastActiveWorkflowId) return getMostRecoverableWorkflow(input)
  const match = input.workflows.find((w) => w.workflowId === input.lastActiveWorkflowId)
  return match ?? getMostRecoverableWorkflow(input)
}

export function getMostRecoverableWorkflow(
  input: RecoveryFlowInput,
): RecoverableWorkflow | null {
  const { visible } = suppressRecoveryNoise(input.workflows)
  return visible[0] ?? null
}

export function getHighestRiskUnfinishedFlow(
  input: RecoveryFlowInput,
): RecoverableWorkflow | null {
  const blocked = input.workflows.filter((w) => w.recoveryKind === 'blocked')
  if (blocked.length > 0) {
    return blocked.sort((a, b) => recoveryWeight(b) - recoveryWeight(a))[0] ?? null
  }
  const signoff = input.workflows.filter((w) => w.recoveryKind === 'signoff')
  if (signoff.length > 0) {
    return signoff.sort((a, b) => recoveryWeight(b) - recoveryWeight(a))[0] ?? null
  }
  return getMostRecoverableWorkflow(input)
}

export function groupRecoveryActions(
  input: RecoveryFlowInput,
  options?: { maxPrimary?: number; maxSecondary?: number },
): RecoveryGrouping {
  const maxPrimary = options?.maxPrimary ?? 5
  const maxSecondary = options?.maxSecondary ?? 3
  const { visible, suppressedCount } = suppressRecoveryNoise(input.workflows)
  const primary = visible.slice(0, maxPrimary)
  const secondary = visible.slice(maxPrimary, maxPrimary + maxSecondary)
  return {
    primary,
    secondary,
    suppressedNoiseCount: suppressedCount + Math.max(0, visible.length - maxPrimary - maxSecondary),
  }
}

export function recoverableFromQueueItem(item: {
  label: string
  kind: string
  priority: number
  href?: string | null
  scopeLabel?: string | null
}, workflowId: string): RecoverableWorkflow {
  const text = `${item.kind} ${item.label}`.toLowerCase()
  let recoveryKind: RecoverableWorkflow['recoveryKind'] = 'stale_flow'
  if (/block|unresolved|stalled/.test(text)) recoveryKind = 'blocked'
  else if (/sign|signature|signoff|pi/.test(text)) recoveryKind = 'signoff'
  else if (/source|continuity|capture/.test(text)) recoveryKind = 'source'

  return {
    workflowId,
    workflowLabel: item.label,
    priority: item.priority,
    recoveryKind,
    nextStep: item.label,
    href: item.href,
    scopeLabel: item.scopeLabel,
  }
}
