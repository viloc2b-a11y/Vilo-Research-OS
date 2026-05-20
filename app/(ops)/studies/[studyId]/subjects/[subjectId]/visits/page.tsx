import { notFound } from 'next/navigation'
import { SubjectVisitHealthTimeline } from '@/components/subjects/operations/SubjectVisitHealthTimeline'
import { SubjectChartHeader } from '@/components/subjects/subject-chart-header'
import { SubjectChartNav } from '@/components/subjects/subject-chart-nav'
import { SubjectVisitCalendar } from '@/components/subjects/visits/SubjectVisitCalendar'
import { SubjectVisitChronologySummary } from '@/components/subjects/visits/SubjectVisitChronologySummary'
import { VisitsTable } from '@/components/subjects/visits/VisitsTable'
import { buildVisitHealthTimeline } from '@/lib/subject/operations/buildVisitHealthTimeline'
import { loadSubjectOperationalIntelligence } from '@/lib/subject/operations'
import { getOrganizationMemberships, getSessionUser } from '@/lib/auth/session'
import { canViewUnblindedData } from '@/lib/rbac/permissions'
import { loadSubjectVisitsPage } from '@/lib/subject/visits/load-subject-visits'
import { loadSubjectWorkflowActions } from '@/lib/subject/workflow/data'

type SubjectVisitsPageProps = {
  params: Promise<{ studyId: string; subjectId: string }>
}

export default async function SubjectVisitsPage({ params }: SubjectVisitsPageProps) {
  const { studyId, subjectId } = await params
  const data = await loadSubjectVisitsPage(subjectId, studyId)

  if (!data) {
    notFound()
  }

  const { header, visits, error } = data

  const user = await getSessionUser()
  const memberships = user ? await getOrganizationMemberships(user.id) : []
  const canViewUnblinded = canViewUnblindedData(memberships, header.organizationId)

  const workflowResult = await loadSubjectWorkflowActions(subjectId, header.organizationId)
  const operationalResult =
    workflowResult.ok
      ? await loadSubjectOperationalIntelligence({
          subjectId,
          studyId,
          organizationId: header.organizationId,
          workflowActions: workflowResult.actions,
        })
      : { ok: false as const, error: 'Could not load workflow.' }

  const operationalHealth = operationalResult.ok ? operationalResult.data.health : null
  const validationIssues = operationalResult.ok ? operationalResult.data.validationIssues : []
  const visitTimeline = operationalResult.ok
    ? operationalResult.data.visitTimeline
    : buildVisitHealthTimeline(visits, [])

  return (
    <div className="flex flex-col h-full bg-accent">
      <SubjectChartHeader
        header={header}
        operationalHealth={operationalHealth}
        showUnblindedFields={canViewUnblinded}
      />

      <SubjectChartNav studyId={studyId} subjectId={subjectId} activeTab="visits" />

      <div className="flex-1 overflow-y-auto bg-accent scrollbar-thin">
        <div className="p-6 max-w-[1100px] space-y-5">
          <div>
            <h2 className="text-lg font-semibold" >
              Visits
            </h2>
            <p className="text-sm" >
              Longitudinal visit chronology and operational grid for coordinator execution.
            </p>
          </div>

          {error ? (
            <p className="text-sm text-destructive">Could not load visits: {error}</p>
          ) : null}

          {!error && visits.length > 0 ? (
            <>
              <SubjectVisitChronologySummary
                visits={visits}
                validationIssues={validationIssues}
              />
              <SubjectVisitHealthTimeline
                items={visitTimeline}
                studyId={studyId}
                subjectId={subjectId}
                showGridLink={false}
                title="Visit chronology"
              />
            </>
          ) : null}

          <div>
            <h3 className="text-sm font-semibold mb-2" >
              Schedule calendar
            </h3>
            <SubjectVisitCalendar visits={visits} studyId={studyId} subjectId={subjectId} />
          </div>

          <div>
            <h3 className="text-sm font-semibold mb-2" >
              Operational grid
            </h3>
            <VisitsTable visits={visits} />
          </div>
        </div>
      </div>
    </div>
  )
}
