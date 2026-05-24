import type { VisitOrchestrationContext } from '@/lib/coordinator-orchestration/context/build-visit-context'
import type { CoordinatorNextAction } from '@/lib/coordinator-orchestration/types'
import type { RuntimeProjectionBlocker } from '@/lib/projections/types'

function basePriority(blocker: RuntimeProjectionBlocker): number {
  if (blocker.severity === 'blocker') return 85
  if (blocker.severity === 'warning') return 55
  return 30
}

function actionFromBlocker(blocker: RuntimeProjectionBlocker): CoordinatorNextAction | null {
  const priority = basePriority(blocker)
  const href = blocker.href ?? null

  if (blocker.category === 'protocol_graph' || blocker.id.startsWith('graph-')) {
    return {
      id: `action:graph:${blocker.id}`,
      kind: 'graph_resolution',
      priority,
      label: blocker.label,
      detail: blocker.detail,
      domain: 'graph',
      blockerId: blocker.id,
      href,
      requiresEscalation: blocker.severity === 'blocker',
      requiresPiReview: false,
    }
  }

  if (blocker.category === 'governance') {
    const piReview =
      blocker.label.toLowerCase().includes('pi')
      || blocker.detail.toLowerCase().includes('investigator')
      || blocker.id.includes('signoff')
    return {
      id: `action:gov:${blocker.id}`,
      kind: piReview ? 'pi_review' : 'governance_resolution',
      priority: piReview ? priority + 5 : priority,
      label: blocker.label,
      detail: blocker.detail,
      domain: 'governance',
      blockerId: blocker.id,
      href,
      requiresEscalation: blocker.severity === 'blocker',
      requiresPiReview: piReview,
    }
  }

  if (blocker.category === 'safety_continuity' || blocker.category === 'safety') {
    const piReview =
      blocker.severity === 'blocker'
      || blocker.label.toLowerCase().includes('cbc')
      || blocker.label.toLowerCase().includes('ae')
    return {
      id: `action:safety:${blocker.id}`,
      kind: piReview ? 'pi_review' : 'safety_follow_up',
      priority: piReview ? Math.min(100, priority + 10) : priority,
      label: blocker.label,
      detail: blocker.detail,
      domain: 'safety',
      blockerId: blocker.id,
      href,
      requiresEscalation: blocker.severity === 'blocker',
      requiresPiReview: piReview,
    }
  }

  if (blocker.category === 'source' || blocker.id.includes('finding') || blocker.id.includes('source')) {
    const signoffBlock = blocker.id.includes('signoff') || blocker.label.toLowerCase().includes('signoff')
    return {
      id: `action:source:${blocker.id}`,
      kind: signoffBlock ? 'source_correction' : 'coordinator_workflow',
      priority,
      label: blocker.label,
      detail: blocker.detail,
      domain: 'source',
      blockerId: blocker.id,
      href,
      requiresEscalation: signoffBlock && blocker.severity === 'blocker',
      requiresPiReview: false,
      dependencyOf: signoffBlock ? 'action:source:missing' : null,
    }
  }

  if (blocker.category === 'procedures' || blocker.id.includes('procedure')) {
    if (blocker.id.includes('unsigned') || blocker.label.toLowerCase().includes('unsigned')) {
      return {
        id: `action:sign:${blocker.id}`,
        kind: 'signoff',
        priority,
        label: blocker.label,
        detail: blocker.detail,
        domain: 'visit',
        blockerId: blocker.id,
        href,
        requiresEscalation: false,
        requiresPiReview: false,
      }
    }
    return {
      id: `action:proc:${blocker.id}`,
      kind: 'procedure_execution',
      priority,
      label: blocker.label,
      detail: blocker.detail,
      domain: 'visit',
      blockerId: blocker.id,
      href,
      requiresEscalation: false,
      requiresPiReview: false,
    }
  }

  if (blocker.category === 'visit') {
    return {
      id: `action:visit:${blocker.id}`,
      kind: 'coordinator_follow_up',
      priority,
      label: blocker.label,
      detail: blocker.detail,
      domain: 'visit',
      blockerId: blocker.id,
      href,
      requiresEscalation: false,
      requiresPiReview: false,
    }
  }

  return {
    id: `action:generic:${blocker.id}`,
    kind: 'coordinator_follow_up',
    priority,
    label: blocker.label,
    detail: blocker.detail,
    domain: 'visit',
    blockerId: blocker.id,
    href,
    requiresEscalation: blocker.severity === 'blocker',
    requiresPiReview: false,
  }
}

export function deriveCoordinatorNextActions(ctx: VisitOrchestrationContext): CoordinatorNextAction[] {
  const actions: CoordinatorNextAction[] = []
  const seen = new Set<string>()

  for (const blocker of ctx.readiness.blockers) {
    const action = actionFromBlocker(blocker)
    if (!action || seen.has(action.id)) continue
    seen.add(action.id)
    actions.push(action)
  }

  if (ctx.readiness.pendingProcedureCount > 0) {
    actions.push({
      id: 'action:proc:pending',
      kind: 'procedure_execution',
      priority: 70,
      label: 'Complete pending procedures',
      detail: `${ctx.readiness.pendingProcedureCount} procedure(s) awaiting execution.`,
      domain: 'visit',
      href: null,
      requiresEscalation: false,
      requiresPiReview: false,
    })
  }

  if (ctx.readiness.missingSourceCount > 0) {
    actions.push({
      id: 'action:source:missing',
      kind: 'source_correction',
      priority: 82,
      label: 'Submit missing source',
      detail: `${ctx.readiness.missingSourceCount} source capture(s) not submitted — blocks signoff.`,
      domain: 'source',
      href: null,
      requiresEscalation: false,
      requiresPiReview: false,
    })
  }

  if (ctx.readiness.unresolvedFindingCount > 0) {
    const cbcFinding = ctx.readiness.blockers.some(
      (b) => b.label.toLowerCase().includes('cbc') || b.detail.toLowerCase().includes('cbc'),
    )
    actions.push({
      id: 'action:findings:unresolved',
      kind: cbcFinding ? 'pi_review' : 'coordinator_workflow',
      priority: cbcFinding ? 92 : 75,
      label: cbcFinding ? 'Unresolved CBC — PI review' : 'Resolve source findings',
      detail: `${ctx.readiness.unresolvedFindingCount} unresolved finding(s).`,
      domain: 'source',
      href: null,
      requiresEscalation: cbcFinding,
      requiresPiReview: cbcFinding,
    })
  }

  if (ctx.overdueWorkflowCount > 0) {
    actions.push({
      id: 'action:workflow:overdue',
      kind: 'coordinator_workflow',
      priority: 78,
      label: 'Overdue workflow action',
      detail: `${ctx.overdueWorkflowCount} workflow item(s) past due — coordinator follow-up.`,
      domain: 'workflow',
      href: null,
      requiresEscalation: false,
      requiresPiReview: false,
    })
  }

  for (const leak of ctx.leakageItems) {
    if (leak.kind === 'executed_unsigned') {
      actions.push({
        id: `action:leak:unsigned:${leak.procedureExecutionId ?? leak.id}`,
        kind: 'leakage_escalation',
        priority: leak.severity === 'critical' ? 88 : 65,
        label: 'Unsigned procedure — leakage risk',
        detail: leak.detail,
        domain: 'financial',
        procedureExecutionId: leak.procedureExecutionId,
        href: null,
        requiresEscalation: leak.severity === 'critical',
        requiresPiReview: false,
      })
    }
    if (leak.kind === 'completed_missing_source') {
      actions.push({
        id: `action:leak:source:${leak.procedureExecutionId ?? leak.id}`,
        kind: 'source_correction',
        priority: 86,
        label: 'Source correction for billable procedure',
        detail: leak.detail,
        domain: 'financial',
        procedureExecutionId: leak.procedureExecutionId,
        href: null,
        requiresEscalation: false,
        requiresPiReview: false,
        dependencyOf: 'action:source:missing',
      })
    }
  }

  if (ctx.rescheduleCount >= 2) {
    actions.push({
      id: 'action:escalation:reschedule',
      kind: 'operational_escalation',
      priority: 72,
      label: 'Repeated reschedule — operational escalation',
      detail: `Visit rescheduled ${ctx.rescheduleCount} time(s); coordinator escalation recommended.`,
      domain: 'visit',
      href: null,
      requiresEscalation: true,
      requiresPiReview: false,
    })
  }

  if (ctx.replaySummary) {
    actions.push({
      id: 'action:replay:chronology',
      kind: 'coordinator_follow_up',
      priority: 45,
      label: 'Review replay chronology',
      detail: ctx.replaySummary,
      domain: 'replay',
      href: null,
      requiresEscalation: false,
      requiresPiReview: false,
    })
  }

  if (
    !ctx.readiness.coordinatorSignReady
    && ctx.readiness.missingSourceCount === 0
    && ctx.readiness.unsignedProcedureCount > 0
  ) {
    actions.push({
      id: 'action:signoff:blocked',
      kind: 'signoff',
      priority: 80,
      label: 'Blocked signoff — complete signatures',
      detail: `${ctx.readiness.unsignedProcedureCount} unsigned procedure(s) block coordinator signoff.`,
      domain: 'visit',
      href: null,
      requiresEscalation: false,
      requiresPiReview: false,
    })
  }

  return actions.sort((a, b) => b.priority - a.priority)
}
