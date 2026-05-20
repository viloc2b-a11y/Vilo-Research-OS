import { CoordinatorTodayInbox } from '@/app/(ops)/performance/_components/CoordinatorTodayInbox'
import { PerformanceHeader } from '@/app/(ops)/performance/_components/PerformanceHeader'
import { PerformanceStatusBanner } from '@/app/(ops)/performance/_components/PerformanceStatusBanner'
import { PerformanceStudyFilter } from '@/app/(ops)/performance/_components/PerformanceStudyFilter'
import { PortfolioStateBanner } from '@/app/(ops)/performance/_components/PortfolioStateBanner'
import {
  loadPerformancePageModel,
  sectionLoadFailed,
} from '@/app/(ops)/performance/_lib/load-performance-page'

type TodayPageProps = {
  searchParams: Promise<{ studyId?: string }>
}

export default async function PerformanceTodayPage({ searchParams }: TodayPageProps) {
  const { studyId: studyIdParam } = await searchParams
  const { model } = await loadPerformancePageModel(studyIdParam)

  const riskFailed = sectionLoadFailed(model.errors, [
    'risk_visits',
    'overdue_workflow',
    'blocked_detail',
  ])

  return (
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

      <CoordinatorTodayInbox
        items={model.riskQueue}
        status={model.status}
        loadFailed={riskFailed}
        selectedStudyName={model.studyFilter.selectedStudyName}
      />
    </div>
  )
}
