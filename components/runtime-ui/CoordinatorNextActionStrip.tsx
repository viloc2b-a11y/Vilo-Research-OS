import Link from 'next/link'
import { ArrowRight, AlertCircle, UserRound } from 'lucide-react'
import type { VisitRuntimeUiModel } from '@/lib/runtime-ui/types'

export function CoordinatorNextActionStrip({ model }: { model: VisitRuntimeUiModel }) {
  const action = model.nextAction
  if (!action) return null

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border border-primary/25 bg-primary/5 px-4 py-2.5">
      <span className="text-[10px] font-semibold uppercase tracking-wide text-primary">Next action</span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-foreground">{action.label}</p>
        {action.detail ? (
          <p className="text-xs text-muted-foreground line-clamp-1">{action.detail}</p>
        ) : null}
      </div>
      {action.requiresPiReview ? (
        <span className="inline-flex items-center gap-1 rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-medium text-violet-800">
          <UserRound className="size-3" />
          PI review
        </span>
      ) : null}
      {action.requiresEscalation ? (
        <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-900">
          <AlertCircle className="size-3" />
          Escalation
        </span>
      ) : null}
      {action.href ? (
        <Link href={action.href} className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
          Go
          <ArrowRight className="size-3" />
        </Link>
      ) : null}
    </div>
  )
}
