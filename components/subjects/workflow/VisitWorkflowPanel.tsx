import { SubjectWorkflowCreateForm } from '@/components/subjects/workflow/SubjectWorkflowCreateForm'
import { SubjectWorkflowList } from '@/components/subjects/workflow/SubjectWorkflowList'
import { filterUnresolvedWorkflowActions } from '@/lib/subject/workflow/data'
import type { SubjectWorkflowAction } from '@/lib/subject/workflow/types'

type VisitWorkflowPanelProps = {
  organizationId: string
  studyId: string
  subjectId: string
  visitId: string
  procedureExecutionId?: string | null
  sourceResponseSetId?: string | null
  sourceSectionKey?: string | null
  actions: SubjectWorkflowAction[]
}

export function VisitWorkflowPanel({
  organizationId,
  studyId,
  subjectId,
  visitId,
  procedureExecutionId = null,
  sourceResponseSetId = null,
  sourceSectionKey = null,
  actions,
}: VisitWorkflowPanelProps) {
  const unresolved = filterUnresolvedWorkflowActions(actions)
  const openCount = unresolved.length
  const queryCount = unresolved.filter((a) => a.actionType === 'query').length
  const signatureCount = unresolved.filter((a) => a.actionType === 'signature_request').length

  return (
    <section id="visit-workflow" className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(260px,340px)]">
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-lg font-semibold">Visit workflow</h2>
            <p className="text-sm text-muted-foreground">
              Actions for this visit, procedure, and source context only.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 text-xs">
            <span className="rounded bg-muted px-2 py-1">{openCount} open</span>
            <span className="rounded bg-muted px-2 py-1">{queryCount} queries</span>
            <span className="rounded bg-muted px-2 py-1">{signatureCount} signatures</span>
          </div>
        </div>

        <SubjectWorkflowCreateForm
          organizationId={organizationId}
          studyId={studyId}
          subjectId={subjectId}
          visitId={visitId}
          procedureExecutionId={procedureExecutionId}
          sourceResponseSetId={sourceResponseSetId}
          sourceSectionKey={sourceSectionKey}
        />
      </div>

      <SubjectWorkflowList
        title={`Unresolved (${openCount})`}
        actions={unresolved}
        organizationId={organizationId}
        studyId={studyId}
        subjectId={subjectId}
      />
    </section>
  )
}
