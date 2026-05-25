'use client'

import { useActionState } from 'react'
import { Button } from '@/components/ui/button'
import type { ConditionalProcedureOption } from '@/lib/visits/conditional-procedures'
import { instantiateConditionalProcedureFormAction } from '@/lib/visits/conditional-procedure-actions'
import { INITIAL_INSTANTIATE_CONDITIONAL_STATE } from '@/lib/visits/conditional-procedure-action-state'

function InstantiateForm({
  organizationId,
  visitId,
  option,
  canInstantiate,
}: {
  organizationId: string
  visitId: string
  option: ConditionalProcedureOption
  canInstantiate: boolean
}) {
  const [state, action, pending] = useActionState(
    instantiateConditionalProcedureFormAction,
    INITIAL_INSTANTIATE_CONDITIONAL_STATE,
  )

  return (
    <form action={action} className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-amber-200/80 bg-amber-50/50 px-3 py-2">
      <input type="hidden" name="organization_id" value={organizationId} />
      <input type="hidden" name="visit_id" value={visitId} />
      <input type="hidden" name="map_id" value={option.mapId} />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-foreground">{option.procedureLabel}</p>
        <p className="text-xs text-muted-foreground">
          Available if condition met
          {option.conditionLabel ? `: ${option.conditionLabel}` : ''}
          {option.isRequired ? ' · Required when instantiated' : ''}
        </p>
      </div>
      <Button type="submit" size="sm" disabled={pending || !canInstantiate}>
        {pending ? 'Instantiating…' : 'Confirm condition met'}
      </Button>
      {state.message ? (
        <p
          className={`w-full text-xs ${state.ok ? 'text-emerald-700' : 'text-destructive'}`}
          role="status"
        >
          {state.message}
        </p>
      ) : null}
    </form>
  )
}

export function ConditionalProceduresPanel({
  organizationId,
  visitId,
  options,
  canInstantiate,
}: {
  organizationId: string
  visitId: string
  options: ConditionalProcedureOption[]
  canInstantiate: boolean
}) {
  if (options.length === 0) return null

  return (
    <section className="mt-6 space-y-2">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Conditional procedures
      </h3>
      <p className="text-xs text-muted-foreground">
        These procedures are not auto-created at schedule generation. Instantiate only when the coordinator
        confirms the condition is met.
      </p>
      {!canInstantiate ? (
        <p className="text-xs text-amber-800">
          Visit is not in an editable state for instantiation (scheduled, checked in, or in progress required).
        </p>
      ) : null}
      <div className="space-y-2">
        {options.map((option) => (
          <InstantiateForm
            key={option.mapId}
            organizationId={organizationId}
            visitId={visitId}
            option={option}
            canInstantiate={canInstantiate}
          />
        ))}
      </div>
    </section>
  )
}
