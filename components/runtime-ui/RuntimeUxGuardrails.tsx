import type { ReactNode } from 'react'

export function RuntimeUxGuardrails({
  compact,
  children,
}: {
  compact?: boolean
  children: ReactNode
}) {
  return (
    <div data-runtime-ui-compact={compact ? 'true' : 'false'}>
      {compact ? (
        <p className="mb-2 text-[10px] text-muted-foreground">
          Showing highest-priority runtime signals only — open Workflow tab for full queue.
        </p>
      ) : null}
      {children}
    </div>
  )
}
