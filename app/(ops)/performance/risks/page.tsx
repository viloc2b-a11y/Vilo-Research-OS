import { OwnerWorkflowQueue } from '@/app/(ops)/performance/_components/OwnerWorkflowQueue'
import { PerformanceHeader } from '@/app/(ops)/performance/_components/PerformanceHeader'
import { PerformanceStatusBanner } from '@/app/(ops)/performance/_components/PerformanceStatusBanner'
import { PerformanceStudyFilter } from '@/app/(ops)/performance/_components/PerformanceStudyFilter'
import { SubjectRiskQueue } from '@/app/(ops)/performance/_components/SubjectRiskQueue'
import {
  loadPerformancePageModel,
  sectionLoadFailed,
} from '@/app/(ops)/performance/_lib/load-performance-page'

type RisksPageProps = {
  searchParams: Promise<{ studyId?: string }>
}

export default async function PerformanceRisksPage({ searchParams }: RisksPageProps) {
  const { studyId: studyIdParam } = await searchParams
  const { model, userId } = await loadPerformancePageModel(studyIdParam)

  const riskFailed = sectionLoadFailed(model.errors, [
    'risk_visits',
    'overdue_workflow',
    'blocked_detail',
    'vpi_rpc',
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

      <OwnerWorkflowQueue
        coordinatorLoad={model.coordinatorLoad}
        currentUserId={userId}
        status={model.status}
        loadFailed={riskFailed}
        selectedStudyName={model.studyFilter.selectedStudyName}
      />

      <SubjectRiskQueue
        items={model.riskQueue}
        status={model.status}
        loadFailed={riskFailed}
        selectedStudyName={model.studyFilter.selectedStudyName}
      />
    </div>
  )
}
