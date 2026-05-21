'use client'

import Link from 'next/link'
import { CaptureFeedback } from '@/components/source/capture-feedback'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type {
  CaptureActionMessage,
  CaptureCompletionNavigation,
} from '@/lib/source/capture/types'

type CaptureCompletionActionsProps = {
  message: CaptureActionMessage
  actionKind: 'save' | 'submit'
  navigation: CaptureCompletionNavigation
}

export function CaptureCompletionActions({
  message,
  actionKind,
  navigation,
}: CaptureCompletionActionsProps) {
  const next = navigation.nextIncompleteProcedure
  const secondaryHref =
    actionKind === 'submit' && !next
      ? navigation.visitWorkflowPath
      : next?.captureHref ?? null

  const secondaryLabel =
    actionKind === 'submit' && !next
      ? 'Open Visit Workflow / Closeout'
      : next
        ? `Continue: ${next.label}`
        : null

  return (
    <div className="space-y-4 rounded-md border border-emerald-500/40 bg-emerald-500/5 px-4 py-4">
      <CaptureFeedback message={message} />
      <div>
        <p className="text-sm font-medium text-foreground">What to do next</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Stay on this page or choose a next step — nothing will redirect automatically.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Link
          href={navigation.visitPath}
          className={cn(buttonVariants({ variant: 'default' }))}
        >
          Return to Visit Workspace
        </Link>
        {secondaryHref && secondaryLabel ? (
          <Link
            href={secondaryHref}
            className={cn(buttonVariants({ variant: 'outline' }))}
          >
            {secondaryLabel}
          </Link>
        ) : null}
      </div>
    </div>
  )
}
