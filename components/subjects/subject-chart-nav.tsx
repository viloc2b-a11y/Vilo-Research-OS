'use client'

// components/subjects/subject-chart-nav.tsx
// Phase 7D — Subject Chart Navigation (horizontal tabs, Vilo OS style)
// Replaces vertical sidebar with horizontal tab strip matching the workspace pattern.

import Link from 'next/link'
import { subjectChartTabHref } from '@/lib/subject/chart-paths'
import { subjectChartTabs } from '@/lib/subject/chart-tabs'

export { subjectChartTabs }

type SubjectChartNavProps = {
  studyId: string | null
  subjectId: string
  activeTab: string
}

export function SubjectChartNav({ studyId, subjectId, activeTab }: SubjectChartNavProps) {
  return (
    <div
      className="flex gap-0.5 overflow-x-auto scrollbar-thin border-b"
      style={{ borderColor: '#e5e5e5', backgroundColor: '#ffffff' }}
    >
      {subjectChartTabs.map((item) => {
        const href = subjectChartTabHref(studyId, subjectId, item.key)
        const isActive = activeTab === item.key

        return (
          <Link
            key={item.key}
            href={href}
            className={`
              flex-shrink-0 px-4 py-3 text-sm font-medium border-b-2 whitespace-nowrap transition-colors
              ${isActive
                ? 'border-[#34a090] text-[#34a090]'
                : 'border-transparent text-[#98a5ad] hover:text-[#10253e]'
              }
            `}
          >
            {item.label}
          </Link>
        )
      })}
    </div>
  )
}
