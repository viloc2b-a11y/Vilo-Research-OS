import Link from 'next/link'
import type { OperationalNextActionItem } from '@/lib/coordinator-operations/types'
import { ArrowRight, Target } from 'lucide-react'

export function CoordinatorTopActionsPanel({
  actions,
  emptyMessage = 'No prioritized next actions yet. Visits will populate this list after runtime orchestration runs.',
}: {
  actions: OperationalNextActionItem[]
  emptyMessage?: string
}) {
  return (
    <section className="vilo-card p-4">
      <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
        <Target className="size-4 text-primary" />
        Top coordinator next actions
      </h3>
      {actions.length === 0 ? (
        <p className="text-sm text-muted-foreground">{emptyMessage}</p>
      ) : (
        <ol className="space-y-2">
          {actions.map((action, index) => (
            <li
              key={action.id}
              className="flex items-start gap-3 rounded-md border border-border/60 px-3 py-2 text-sm"
            >
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                {index + 1}
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-medium text-foreground">{action.label}</p>
                {action.detail ? (
                  <p className="mt-0.5 text-xs text-muted-foreground">{action.detail}</p>
                ) : null}
                <p className="mt-1 text-[10px] text-muted-foreground">{action.scopeLabel}</p>
              </div>
              {action.href ? (
                <Link
                  href={action.href}
                  className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-primary hover:underline"
                >
                  Go
                  <ArrowRight className="size-3" />
                </Link>
              ) : null}
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}
