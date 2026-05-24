import { CoordinatorNextActionStrip } from '@/components/runtime-ui/CoordinatorNextActionStrip'
import { SafetyGovernanceBlockerPanel } from '@/components/runtime-ui/SafetyGovernanceBlockerPanel'
import { FinancialLeakageWarningPanel } from '@/components/runtime-ui/FinancialLeakageWarningPanel'
import { RuntimeWhyBlockedDrawer } from '@/components/runtime-ui/RuntimeWhyBlockedDrawer'
import { RuntimeWorkQueuePanel } from '@/components/runtime-ui/RuntimeWorkQueuePanel'
import { AutomationProposalReviewPanel } from '@/components/runtime-ui/AutomationProposalReviewPanel'
import { RuntimeUxGuardrails } from '@/components/runtime-ui/RuntimeUxGuardrails'
import type { VisitRuntimeUiModel } from '@/lib/runtime-ui/types'

export function VisitRuntimeActionPanel({
  model,
  canMutate,
  variant = 'full',
}: {
  model: VisitRuntimeUiModel
  canMutate: boolean
  variant?: 'compact' | 'full' | 'workflow'
}) {
  return (
    <RuntimeUxGuardrails compact={model.overloadCompact}>
      <div className="space-y-4">
        {variant !== 'workflow' ? <CoordinatorNextActionStrip model={model} /> : null}

        {variant !== 'workflow' ? (
          <div className="flex flex-wrap items-center gap-2 text-[10px] text-muted-foreground">
            {model.urgencyLevel ? (
              <span className="rounded-full border px-2 py-0.5 capitalize">Urgency: {model.urgencyLevel}</span>
            ) : null}
            {model.visitPhase ? (
              <span className="rounded-full border px-2 py-0.5 capitalize">
                Phase: {model.visitPhase.replace('_', ' ')}
              </span>
            ) : null}
            {model.piReviewNeeded ? (
              <span className="rounded-full border border-violet-200 bg-violet-50 px-2 py-0.5 text-violet-800">
                PI review needed
              </span>
            ) : null}
            <span className="rounded-full border px-2 py-0.5 capitalize">
              Readiness: {model.readinessStatus}
            </span>
          </div>
        ) : null}

        {variant !== 'compact' ? <RuntimeWhyBlockedDrawer whyBlocked={model.whyBlocked} /> : null}

        {variant === 'full' ? (
          <>
            <SafetyGovernanceBlockerPanel blockers={model.safetyGovernanceBlockers} />
            <FinancialLeakageWarningPanel leakage={model.leakage} />
            <RuntimeWorkQueuePanel buckets={model.workQueue} compact={model.overloadCompact} />
            <AutomationProposalReviewPanel model={model} canMutate={canMutate} />
          </>
        ) : null}

        {variant === 'workflow' ? (
          <>
            <RuntimeWorkQueuePanel buckets={model.workQueue} compact={model.overloadCompact} />
            <AutomationProposalReviewPanel model={model} canMutate={canMutate} />
          </>
        ) : null}

        {variant === 'compact' ? (
          <>
            <FinancialLeakageWarningPanel leakage={model.leakage} />
            {model.safetyGovernanceBlockers.length > 0 ? (
              <SafetyGovernanceBlockerPanel blockers={model.safetyGovernanceBlockers.slice(0, 3)} />
            ) : null}
            <RuntimeWhyBlockedDrawer whyBlocked={model.whyBlocked} />
          </>
        ) : null}
      </div>
    </RuntimeUxGuardrails>
  )
}
