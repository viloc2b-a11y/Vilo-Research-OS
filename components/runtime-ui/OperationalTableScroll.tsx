import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

type OperationalTableScrollProps = {
  children: ReactNode
  /** Minimum table width before horizontal scroll engages. */
  minTableWidth?: number
  id?: string
  className?: string
}

/**
 * Wide operational tables must not be clipped by flex/grid parents (min-w-0 + overflow-x-auto).
 */
export function OperationalTableScroll({
  children,
  minTableWidth = 900,
  id,
  className,
}: OperationalTableScrollProps) {
  return (
    <div
      id={id}
      data-operational-table-scroll
      className={cn('w-full min-w-0 overflow-x-auto scrollbar-thin', className)}
    >
      <div className="inline-block min-w-full align-top" style={{ minWidth: minTableWidth }}>
        {children}
      </div>
    </div>
  )
}
