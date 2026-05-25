import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

/**
 * Ops shell (`main` is overflow-hidden) requires each page to own vertical scroll.
 * Wrap coordinator workspace pages so lower sections remain reachable.
 */
export function CoordinatorPageScroll({
  children,
  className,
  contentClassName,
}: {
  children: ReactNode
  className?: string
  contentClassName?: string
}) {
  return (
    <div className={cn('flex h-full flex-col bg-accent', className)}>
      <div
        className={cn(
          'vilo-ops-scroll vilo-page-scroll min-h-0 min-w-0 flex-1 overflow-x-auto overflow-y-auto bg-accent scrollbar-thin',
          contentClassName,
        )}
      >
        {children}
      </div>
    </div>
  )
}
