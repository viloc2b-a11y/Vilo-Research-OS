import type { ReactNode } from 'react'
import { CoordinatorPageScroll } from '@/components/runtime-ui/CoordinatorPageScroll'

export default function SourceBuilderLayout({ children }: { children: ReactNode }) {
  return <CoordinatorPageScroll contentClassName="p-6 pb-24">{children}</CoordinatorPageScroll>
}
