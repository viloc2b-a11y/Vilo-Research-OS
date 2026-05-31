import { Suspense } from 'react'
import { StudyWorkspaceShell } from '@/components/study-workspace/study-workspace-shell'
import { loadStudySetupDocuments } from '@/lib/study-workspace/load-study-setup-documents'
import { studyHasProtocolRuntimeVersion } from '@/lib/study-workspace/study-has-protocol-draft'
import {
  loadStudyWorkspaceSubjectPreviews,
  loadStudyWorkspaceSummary,
} from '@/lib/study-workspace/load-study-workspace-summary'

type StudyWorkspacePageProps = {
  params: Promise<{ studyId: string }>
}

function WorkspaceLoadingFallback() {
  return (
    <div className="space-y-6 p-6">
      <div className="h-8 w-64 animate-pulse rounded bg-slate-100" />
      <div className="h-10 w-full animate-pulse rounded bg-slate-100" />
      <div className="h-64 animate-pulse rounded-md bg-slate-100" />
    </div>
  )
}

async function StudyWorkspaceContent({ studyId }: { studyId: string }) {
  const summary = await loadStudyWorkspaceSummary(studyId)
  const subjects = await loadStudyWorkspaceSubjectPreviews(
    studyId,
    summary.study.organizationId,
  )
  const setupDocuments = await loadStudySetupDocuments(
    studyId,
    summary.study.organizationId,
  )
  const hasProtocolDraft = await studyHasProtocolRuntimeVersion(
    studyId,
    summary.study.organizationId,
  )

  return (
    <StudyWorkspaceShell
      summary={summary}
      subjects={subjects}
      setupDocuments={setupDocuments}
      hasProtocolDraft={hasProtocolDraft}
    />
  )
}

export default async function StudyWorkspacePage({ params }: StudyWorkspacePageProps) {
  const { studyId } = await params

  return (
    <Suspense fallback={<WorkspaceLoadingFallback />}>
      <StudyWorkspaceContent studyId={studyId} />
    </Suspense>
  )
}
