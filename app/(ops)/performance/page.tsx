import { PerformanceHeader } from '@/app/(ops)/performance/_components/PerformanceHeader'
import { PerformanceStatusBanner } from '@/app/(ops)/performance/_components/PerformanceStatusBanner'
import { PerformanceStudyFilter } from '@/app/(ops)/performance/_components/PerformanceStudyFilter'
import { PortfolioStateBanner } from '@/app/(ops)/performance/_components/PortfolioStateBanner'
import { StudyHealthTable } from '@/app/(ops)/performance/_components/StudyHealthTable'
import { SubjectRiskQueue } from '@/app/(ops)/performance/_components/SubjectRiskQueue'
import { VisitExecutionSnapshot } from '@/app/(ops)/performance/_components/VisitExecutionSnapshot'
import {
  loadPerformancePageModel,
  sectionLoadFailed,
} from '@/app/(ops)/performance/_lib/load-performance-page'

type PerformancePageProps = {
  searchParams: Promise<{ studyId?: string }>
}

export default async function PerformancePage({ searchParams }: PerformancePageProps) {
  const { studyId: studyIdParam } = await searchParams
  const { model } = await loadPerformancePageModel(studyIdParam)

  const studiesFailed = sectionLoadFailed(model.errors, ['studies', 'study_card_counts'])
  const studyMetricsFailed = sectionLoadFailed(model.errors, [
    'study_subjects',
    'visits_active',
    'visits_missed',
    'workflow_queries',
    'procedures_blocked',
  ])
  const visitsFailed = sectionLoadFailed(model.errors, ['visits'])
  const riskFailed = sectionLoadFailed(model.errors, [
    'risk_visits',
    'overdue_workflow',
    'blocked_detail',
  ])

  return (
    <div className="p-6">
      <div className="space-y-6">
        <PerformanceHeader
        organizationCount={model.organizationCount}
        selectedStudyName={model.studyFilter.selectedStudyName}
      />

      <PerformanceStudyFilter
        options={model.studyFilter.options}
        selectedStudyId={model.studyFilter.selectedStudyId}
        selectedStudyName={model.studyFilter.selectedStudyName}
      />

      <PerformanceStatusBanner status={model.status} errors={model.errors} />

      <PortfolioStateBanner summary={model.portfolioSummary} />

      <StudyHealthTable
        cards={model.studyCards}
        status={model.status}
        loadFailed={studiesFailed || studyMetricsFailed}
        selectedStudyName={model.studyFilter.selectedStudyName}
      />

      <SubjectRiskQueue
        items={model.riskQueue}
        status={model.status}
        loadFailed={riskFailed}
        selectedStudyName={model.studyFilter.selectedStudyName}
      />

      <details className="rounded-lg border bg-card px-4 py-3">
        <summary className="cursor-pointer text-sm font-medium text-foreground">
          Visit execution snapshot
        </summary>
        <div className="mt-4">
          <VisitExecutionSnapshot
            snapshot={model.visitSnapshot}
            status={model.status}
            loadFailed={visitsFailed}
            selectedStudyName={model.studyFilter.selectedStudyName}
          />
        </div>
        </details>
      </div>
    </div>
  )
}
