'use client'

import { useActionState } from 'react'
import { Bot, Check, Ban } from 'lucide-react'
import { applyVisitAutomationProposalAction } from '@/lib/runtime-ui/actions'
import type { RuntimeUiActionState } from '@/lib/runtime-ui/actions-state'
import type { VisitRuntimeUiModel } from '@/lib/runtime-ui/types'

const initial: RuntimeUiActionState = { ok: false, message: '' }

export function AutomationProposalReviewPanel({
  model,
  canMutate,
}: {
  model: VisitRuntimeUiModel
  canMutate: boolean
}) {
  const [state, formAction, pending] = useActionState(applyVisitAutomationProposalAction, initial)

  if (model.automationProposals.length === 0 && model.pendingAutomationApplyCount === 0) {
    return null
  }

  return (
    <section className="vilo-card p-4">
      <h3 className="mb-1 flex items-center gap-2 text-sm font-semibold text-foreground">
        <Bot className="size-4 text-primary" />
        Automation proposals
      </h3>
      <p className="mb-3 text-xs text-muted-foreground">
        Supervisor-reviewed only. Apply creates workflow follow-ups and spine events — never auto-signs or
        completes clinical steps.
      </p>

      {state.message ? (
        <p
          className={`mb-3 rounded-md px-3 py-2 text-xs ${
            state.ok ? 'bg-emerald-50 text-emerald-800' : 'bg-destructive/10 text-destructive'
          }`}
        >
          {state.message}
        </p>
      ) : null}

      <ul className="space-y-2">
        {model.automationProposals.map((proposal) => (
          <li key={proposal.id} className="rounded-md border border-border/80 px-3 py-2 text-xs">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium text-foreground">{proposal.label}</span>
              <span className="text-[10px] text-muted-foreground">{proposal.kind}</span>
            </div>
            <p className="mt-0.5 text-muted-foreground">{proposal.detail}</p>
          </li>
        ))}
      </ul>

      {canMutate && model.automationProposals.length > 0 ? (
        <form action={formAction} className="mt-3 flex flex-wrap gap-2">
          <input type="hidden" name="organization_id" value={model.organizationId} />
          <input type="hidden" name="study_id" value={model.studyId} />
          <input type="hidden" name="visit_id" value={model.visitId} />
          <input
            type="hidden"
            name="action_ids"
            value={model.automationProposals.map((p) => p.id).join(',')}
          />
          <button
            type="submit"
            disabled={pending}
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            <Check className="size-3.5" />
            {pending ? 'Applying…' : 'Apply proposals'}
          </button>
        </form>
      ) : (
        <p className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
          <Ban className="size-3" />
          Read-only — coordinator apply not available
        </p>
      )}
    </section>
  )
}
