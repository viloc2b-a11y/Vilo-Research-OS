import type { CoordinatorNextAction, BlockerResolutionChain } from '@/lib/coordinator-orchestration/types'
import type { VisitReadinessProjection } from '@/lib/projections/types'

const DOMAIN_ORDER = ['safety', 'graph', 'source', 'governance', 'visit', 'financial', 'workflow', 'replay']

export function buildBlockerResolutionChains(input: {
  readiness: VisitReadinessProjection
  nextActions: CoordinatorNextAction[]
}): BlockerResolutionChain[] {
  const chains: BlockerResolutionChain[] = []
  const blockerActions = input.nextActions.filter((a) => a.blockerId)

  for (const blocker of input.readiness.blockers.filter((b) => b.severity === 'blocker')) {
    const related = blockerActions.filter((a) => a.blockerId === blocker.id)
    const domains = [...new Set(related.map((a) => a.domain))].sort(
      (a, b) => DOMAIN_ORDER.indexOf(a) - DOMAIN_ORDER.indexOf(b),
    )

    const steps = related.map((a, i) => ({
      order: i + 1,
      actionId: a.id,
      label: a.label,
      domain: a.domain,
    }))

    if (steps.length === 0 && blocker.category === 'source') {
      steps.push({
        order: 1,
        actionId: `chain:source:${blocker.id}`,
        label: 'Correct source capture',
        domain: 'source',
      })
      steps.push({
        order: 2,
        actionId: `chain:signoff:${blocker.id}`,
        label: 'Complete signoff after source',
        domain: 'visit',
      })
    }

    if (steps.length > 0) {
      chains.push({
        id: `chain:${blocker.id}`,
        rootBlockerId: blocker.id,
        rootLabel: blocker.label,
        domains,
        steps,
      })
    }
  }

  const signoffChain = input.nextActions.find((a) => a.id === 'action:source:missing')
  if (signoffChain) {
    const dependent = input.nextActions.filter(
      (a) => a.dependencyOf === 'action:source:missing' || a.kind === 'signoff',
    )
    if (dependent.length > 0 && !chains.some((c) => c.id === 'chain:signoff-path')) {
      chains.push({
        id: 'chain:signoff-path',
        rootBlockerId: 'signoff-blocked',
        rootLabel: 'Signoff blocked by source',
        domains: ['source', 'visit'],
        steps: [
          { order: 1, actionId: 'action:source:missing', label: 'Submit missing source', domain: 'source' },
          ...dependent.slice(0, 3).map((a, i) => ({
            order: i + 2,
            actionId: a.id,
            label: a.label,
            domain: a.domain,
          })),
        ],
      })
    }
  }

  return chains.slice(0, 12)
}
