import { SubjectWorkflowCreateForm } from '@/components/subjects/workflow/SubjectWorkflowCreateForm'
import { SubjectWorkflowEscalationList } from '@/components/subjects/workflow/SubjectWorkflowEscalationList'
import { SubjectWorkflowEscalationSummary } from '@/components/subjects/workflow/SubjectWorkflowEscalationSummary'
import { SubjectWorkflowList } from '@/components/subjects/workflow/SubjectWorkflowList'
import { subjectVisitsPath } from '@/lib/subject/chart-paths'
import { buildSubjectWorkflowEscalation } from '@/lib/subject/workflow-escalation'
import type { SubjectOperationalIntelligence } from '@/lib/subject/operations/types'
import type { SubjectWorkflowAction } from '@/lib/subject/workflow/types'

type SubjectWorkflowPanelProps = {
  organizationId: string
  studyId: string
  subjectId: string
  actions: SubjectWorkflowAction[]
  operationalIntelligence: SubjectOperationalIntelligence | null
}

export function SubjectWorkflowPanel({
  organizationId,
  studyId,
  subjectId,
  actions,
  operationalIntelligence,
}: SubjectWorkflowPanelProps) {
  const escalation = buildSubjectWorkflowEscalation({
    actions,
    intelligence: operationalIntelligence,
    moreHref: subjectVisitsPath(studyId, subjectId),
  })

  const actionsById = new Map(actions.map((a) => [a.id, a]))
  const recentlyResolved = actions
    .filter((action) => action.status === 'resolved')
    .slice(0, 6)

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold" style={{ color: '#10253e' }}>
          Workflow & escalation
        </h2>
        <p className="text-sm" style={{ color: '#98a5ad' }}>
          Coordinator queue for overdue tasks, signatures, and source follow-up. For protocol
          compliance risk indicators, use the Deviations tab.
        </p>
      </div>

      <SubjectWorkflowEscalationSummary summary={escalation.summary} />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(280px,360px)]">
        <SubjectWorkflowEscalationList
          sections={escalation.sections}
          actionsById={actionsById}
          organizationId={organizationId}
          studyId={studyId}
          subjectId={subjectId}
        />

        <div className="space-y-4 lg:sticky lg:top-4 lg:self-start">
          <SubjectWorkflowCreateForm
            organizationId={organizationId}
            studyId={studyId}
            subjectId={subjectId}
          />
          {recentlyResolved.length > 0 ? (
            <SubjectWorkflowList
              title="Recently resolved"
              actions={recentlyResolved}
              organizationId={organizationId}
              studyId={studyId}
              subjectId={subjectId}
            />
          ) : null}
        </div>
      </div>
    </div>
  )
}
