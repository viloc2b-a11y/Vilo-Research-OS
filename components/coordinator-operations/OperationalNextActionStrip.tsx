import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import type { RuntimeUiNextAction } from '@/lib/runtime-ui/types'

export function OperationalNextActionStrip({
  nextAction,
}: {
  nextAction: RuntimeUiNextAction
}) {
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border border-primary/25 bg-primary/5 px-4 py-2.5">
      <span className="text-[10px] font-semibold uppercase tracking-wide text-primary">Next action</span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-foreground">{nextAction.label}</p>
        {nextAction.detail ? (
          <p className="text-xs text-muted-foreground line-clamp-1">{nextAction.detail}</p>
        ) : null}
      </div>
      {nextAction.href ? (
        <Link href={nextAction.href} className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
          Go
          <ArrowRight className="size-3" />
        </Link>
      ) : null}
    </div>
  )
}
