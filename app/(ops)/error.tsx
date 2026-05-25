'use client'

import { CoordinatorSafeErrorPanel } from '@/components/runtime-ui/CoordinatorSafeErrorPanel'
import { CoordinatorPageScroll } from '@/components/runtime-ui/CoordinatorPageScroll'

export default function OpsError({
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <CoordinatorPageScroll contentClassName="p-6">
      <div className="mx-auto max-w-lg space-y-4">
        <CoordinatorSafeErrorPanel
          title="This page could not load"
          backHref="/command-center"
          backLabel="Command center"
        />
        <button
          type="button"
          onClick={() => reset()}
          className="inline-flex h-8 items-center rounded-md border border-input bg-background px-3 text-xs font-medium hover:bg-accent"
        >
          Try again
        </button>
      </div>
    </CoordinatorPageScroll>
  )
}
