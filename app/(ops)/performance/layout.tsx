import type { ReactNode } from 'react'
import { PerformanceCommandNav } from '@/app/(ops)/performance/_components/PerformanceCommandNav'
import { CoordinatorPageScroll } from '@/components/runtime-ui/CoordinatorPageScroll'

export default function PerformanceLayout({ children }: { children: ReactNode }) {
  return (
    <CoordinatorPageScroll contentClassName="p-6 pb-24">
      <div className="space-y-4">
        <PerformanceCommandNav />
        {children}
      </div>
    </CoordinatorPageScroll>
  )
}
