'use client'

import type { StudyWorkspaceSectionId } from '@/lib/study-workspace/study-workspace-types'

export type StudyWorkspaceNavItem = {
  id: StudyWorkspaceSectionId
  label: string
}

export const STUDY_WORKSPACE_NAV_ITEMS: StudyWorkspaceNavItem[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'study-setup', label: 'Study Setup' },
  { id: 'subjects', label: 'Subjects' },
  { id: 'source-runtime', label: 'Source Runtime' },
  { id: 'published-source', label: 'Published Source' },
  { id: 'visit-runtime', label: 'Visit Runtime' },
  { id: 'regulatory-binder', label: 'Regulatory Binder' },
  { id: 'governance', label: 'Governance' },
  { id: 'training', label: 'Training' },
  { id: 'delegation', label: 'Delegation Log' },
  { id: 'documents', label: 'Study Documents' },
  { id: 'monitoring', label: 'Monitoring View' },
  { id: 'activity', label: 'Activity Feed' },
]

type StudyWorkspaceNavProps = {
  activeSection: StudyWorkspaceSectionId
  onSelect: (section: StudyWorkspaceSectionId) => void
}

export function StudyWorkspaceNav({ activeSection, onSelect }: StudyWorkspaceNavProps) {
  return (
    <nav
      className="vilo-scroll-contained flex gap-1 overflow-x-auto border-b border-slate-200 pb-px"
      aria-label="Study workspace sections"
    >
      {STUDY_WORKSPACE_NAV_ITEMS.map((item) => {
        const active = item.id === activeSection
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onSelect(item.id)}
            className={
              active
                ? 'vilo-surface-active shrink-0 rounded-t-md border border-b-0 border-slate-200 px-3 py-2 text-sm font-medium text-slate-900'
                : 'shrink-0 rounded-t-md px-3 py-2 text-sm text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-800'
            }
          >
            {item.label}
          </button>
        )
      })}
    </nav>
  )
}
