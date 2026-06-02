'use client'

import { useParams } from 'next/navigation'
import { CoordinatorSafeErrorPanel } from '@/components/runtime-ui/CoordinatorSafeErrorPanel'
import { CoordinatorPageScroll } from '@/components/runtime-ui/CoordinatorPageScroll'

export default function SubjectWorkspaceError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const params = useParams()
  const subjectId = (params.subjectId as string) || ''
  
  // If the route has studyId, use it; otherwise use the generic subject path
  const studyId = params.studyId as string | undefined
  const backHref = studyId ? `/studies/${studyId}/subjects/${subjectId}` : `/subjects/${subjectId}`

  return (
    <div className="flex flex-col h-full bg-accent">
      <CoordinatorPageScroll contentClassName="p-6">
        <div className="mx-auto max-w-lg space-y-4">
          <CoordinatorSafeErrorPanel
            title="Unable to load this section"
            detail="This section could not be loaded. Your work was not lost."
            backHref={backHref}
            backLabel="Return to Subject Overview"
          />
          <button
            type="button"
            onClick={() => reset()}
            className="inline-flex h-8 items-center rounded-md border border-input bg-background px-3 text-xs font-medium hover:bg-accent"
          >
            Retry Section
          </button>
        </div>
      </CoordinatorPageScroll>
    </div>
  )
}
