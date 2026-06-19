import { Suspense } from 'react'
import { StudyWorkspaceShell } from '@/components/study-workspace/study-workspace-shell'
import { loadStudyOperationsSurface } from '@/lib/coordinator-operations/load-study-operations'
import { loadProtocolSetupModel } from '@/lib/studies/load-protocol-setup'
import { loadStudySetupDocuments } from '@/lib/study-workspace/load-study-setup-documents'
import { studyHasProtocolRuntimeVersion } from '@/lib/study-workspace/study-has-protocol-draft'
import {
  loadStudyWorkspaceSummary,
} from '@/lib/study-workspace/load-study-workspace-summary'
import { loadStudySubjectRoster } from '@/lib/study-workspace/load-study-subject-roster'
import { loadStudyCommandCenterMetrics } from '@/lib/study-workspace/load-study-command-center-metrics'
import { loadStudyRegulatoryDocuments } from '@/lib/study-workspace/load-regulatory-documents'
import { loadStudyOperationalDocuments } from '@/lib/study-workspace/load-study-documents'
import { loadStudyBudgetEvidenceSummary } from '@/lib/study-workspace/load-budget-evidence-summary'
import { loadActivityCodeCatalog } from '@/lib/cliniq-core/activity-code-library'
import { loadStudyPatientAcquisitionSummary } from '@/lib/study-workspace/load-patient-acquisition-summary'
import { loadStudyGovernanceSummary } from '@/lib/study-workspace/load-governance-summary'
import { loadEnrollmentVelocity } from '@/lib/crm/enrollment-velocity'
import { loadRecruitmentForecastForStudy } from '@/lib/crm/recruitment-forecast'
import { loadRecruitmentFunnelSummary, loadSourceEffectiveness } from '@/lib/crm/recruitment-intelligence'
import type { EnrollmentVelocityResult } from '@/lib/crm/enrollment-velocity'
import type { RecruitmentForecast } from '@/lib/crm/recruitment-forecast'
import type { RecruitmentFunnelSummary, SourceEffectivenessReport } from '@/lib/crm/recruitment-intelligence'
import { loadStudyCloseoutSummary } from '@/lib/study-workspace/load-study-closeout-summary'
import { loadStudyFinancialRuntimeSummary } from '@/lib/study-workspace/load-financial-runtime-summary'
import { loadStudyInvoiceSummary } from '@/lib/financial-runtime/study-invoice-summary'
import type { StudyInvoiceSummary } from '@/lib/financial-runtime/study-invoice-summary'
import { loadStudyWorkflowSummary } from '@/lib/study-workspace/load-workflow-summary'
import { loadStudyVisits } from '@/lib/visits/loadStudyVisits'
import { loadProtocolRuntimeStudy } from '@/lib/protocol-intake-runtime/load-protocol-runtime-study'
import { loadDeviations } from '@/lib/protocol-deviations/load-deviations'
import { loadCapaActions } from '@/lib/capa-runtime/load-capa-actions'
import { canExecuteStudyRuntime } from '@/lib/studies/runtime-readiness'
import { createServerClient } from '@/lib/supabase/server'

type StudyWorkspacePageProps = {
  params: Promise<{ studyId: string }>
  searchParams: Promise<{ section?: string; subject_q?: string; visit_q?: string; docs_q?: string; binder_q?: string }>
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

async function StudyWorkspaceContent({
  studyId,
  subjectSearchQuery,
  visitSearchQuery,
  docsSearchQuery,
  binderSearchQuery,
}: {
  studyId: string
  subjectSearchQuery: string | null
  visitSearchQuery: string | null
  docsSearchQuery: string | null
  binderSearchQuery: string | null
}) {
  const summary = await loadStudyWorkspaceSummary(studyId)
  const supabase = await createServerClient()
  const subjects = await loadStudySubjectRoster(
    studyId,
    summary.study.organizationId,
    undefined,
    subjectSearchQuery,
  )
  const setupDocuments = await loadStudySetupDocuments(
    studyId,
    summary.study.organizationId,
  )
  const protocolSetup = await loadProtocolSetupModel({
    studyId,
    organizationId: summary.study.organizationId,
  })
  const hasProtocolDraft = await studyHasProtocolRuntimeVersion(
    studyId,
    summary.study.organizationId,
  )
  const regulatoryDocuments = await loadStudyRegulatoryDocuments(
    studyId,
    summary.study.organizationId,
    binderSearchQuery,
  )
  const studyDocuments = await loadStudyOperationalDocuments(
    studyId,
    summary.study.organizationId,
    docsSearchQuery,
  )
  const visitsResponse = await loadStudyVisits(
    studyId,
    summary.study.organizationId,
    undefined,
    visitSearchQuery,
  )
  const commandCenterMetrics = await loadStudyCommandCenterMetrics(
    studyId,
    summary.study.organizationId,
  )
  // Surfaced via budgetEvidenceSummary.unavailable so a catalog-load failure is
  // observable to operators instead of silently degrading FMV enrichment.
  const activityCodeUnavailable: string[] = []
  const [
    activityCodeCatalog,
    patientAcquisitionSummary,
    enrollmentVelocity,
    recruitmentForecast,
    recruitmentFunnel,
    sourceEffectiveness,
  ] = await Promise.all([
    loadActivityCodeCatalog(supabase, summary.study.organizationId, activityCodeUnavailable),
    loadStudyPatientAcquisitionSummary(studyId, summary.study.organizationId),
    loadEnrollmentVelocity(supabase, summary.study.organizationId, studyId),
    loadRecruitmentForecastForStudy(supabase, summary.study.organizationId, studyId),
    loadRecruitmentFunnelSummary(supabase, summary.study.organizationId, { studyId }),
    loadSourceEffectiveness(supabase, summary.study.organizationId, { studyId }),
  ])
  const budgetEvidenceSummary = await loadStudyBudgetEvidenceSummary(
    studyId,
    summary.study.organizationId,
    protocolSetup,
    supabase,
    activityCodeCatalog,
  )
  if (activityCodeUnavailable.length > 0) {
    budgetEvidenceSummary.unavailable.push(...activityCodeUnavailable)
  }
  const governanceSummary = await loadStudyGovernanceSummary(
    studyId,
    summary.study.organizationId,
  )
  const closeoutSummary = await loadStudyCloseoutSummary(
    studyId,
    summary.study.organizationId,
  )
  const financialRuntimeSummary = await loadStudyFinancialRuntimeSummary(
    studyId,
    summary.study.organizationId,
  )
  const invoiceSummary = await loadStudyInvoiceSummary(supabase, studyId)
  const workflowSummary = await loadStudyWorkflowSummary(
    studyId,
    summary.study.organizationId,
  )
  const studyOperationsSurface = await loadStudyOperationsSurface(studyId)
  // Access control: protocol_runtime_studies is org-scoped; row visibility is
  // enforced by Supabase RLS per active organization membership, with the
  // organization_id filter below as defense-in-depth. Read-only, no
  // subject-identifiable data.
  // Error handling: a failed lookup degrades gracefully — protocolRuntimeStudyId
  // stays null and the optional protocol-runtime panel is omitted (there is no
  // runtime study to show), so the error is intentionally non-fatal and not
  // surfaced as an unavailable evidence signal.
  const { data: protocolRuntimeStudyRows } = await supabase
    .from('protocol_runtime_studies')
    .select('id')
    .eq('study_id', studyId)
    .eq('organization_id', summary.study.organizationId)
    .order('updated_at', { ascending: false })
    .limit(1)
  const protocolRuntimeStudyId = protocolRuntimeStudyRows?.[0]?.id ? String(protocolRuntimeStudyRows[0].id) : null
  const protocolRuntimeStudy = protocolRuntimeStudyId
    ? await loadProtocolRuntimeStudy(supabase, summary.study.organizationId, protocolRuntimeStudyId)
    : null
  const readiness = await canExecuteStudyRuntime({
    supabase,
    studyId,
    organizationId: summary.study.organizationId,
  })

  const deviations = await loadDeviations(supabase, {
    organizationId: summary.study.organizationId,
    studyId,
  })

  const capaActions = await loadCapaActions(supabase, {
    organizationId: summary.study.organizationId,
    studyId,
  })

  const capaByDeviationId: Record<string, typeof capaActions[0]> = {}
  for (const ca of capaActions) {
    capaByDeviationId[ca.deviationId] = ca
  }

  const subjectMap: Record<string, string> = {}
  for (const s of subjects) {
    subjectMap[s.subjectId] = s.subjectIdentifier
  }

  return (
    <StudyWorkspaceShell
      summary={summary}
      subjects={subjects}
      subjectSearchQuery={subjectSearchQuery ?? ''}
      visitSearchQuery={visitSearchQuery ?? ''}
      docsSearchQuery={docsSearchQuery ?? ''}
      binderSearchQuery={binderSearchQuery ?? ''}
      setupDocuments={setupDocuments}
      hasProtocolDraft={hasProtocolDraft}
      regulatoryDocuments={regulatoryDocuments}
      studyDocuments={studyDocuments}
      visits={visitsResponse.rows}
      commandCenterMetrics={commandCenterMetrics}
      budgetEvidenceSummary={budgetEvidenceSummary}
      patientAcquisitionSummary={patientAcquisitionSummary}
      enrollmentVelocity={enrollmentVelocity}
      recruitmentForecast={recruitmentForecast}
      recruitmentFunnel={recruitmentFunnel}
      sourceEffectiveness={sourceEffectiveness}
      governanceSummary={governanceSummary}
      closeoutSummary={closeoutSummary}
      financialRuntimeSummary={financialRuntimeSummary}
      invoiceSummary={invoiceSummary}
      workflowSummary={workflowSummary}
      protocolRuntimeStudy={protocolRuntimeStudy}
      studyOperationsSurface={studyOperationsSurface}
      continuityRows={readiness.continuityRows}
      deviations={deviations}
      subjectMap={subjectMap}
      capaByDeviationId={capaByDeviationId}
      activityCodeCatalog={activityCodeCatalog}
    />
  )
}

export default async function StudyWorkspacePage({ params, searchParams }: StudyWorkspacePageProps) {
  const { studyId } = await params
  const {
    subject_q: subjectSearchQueryParam,
    visit_q: visitSearchQueryParam,
    docs_q: docsSearchQueryParam,
    binder_q: binderSearchQueryParam,
  } = await searchParams
  const subjectSearchQuery = subjectSearchQueryParam?.trim() || null
  const visitSearchQuery = visitSearchQueryParam?.trim() || null
  const docsSearchQuery = docsSearchQueryParam?.trim() || null
  const binderSearchQuery = binderSearchQueryParam?.trim() || null

  return (
    <Suspense fallback={<WorkspaceLoadingFallback />}>
      <StudyWorkspaceContent
        studyId={studyId}
        subjectSearchQuery={subjectSearchQuery}
        visitSearchQuery={visitSearchQuery}
        docsSearchQuery={docsSearchQuery}
        binderSearchQuery={binderSearchQuery}
      />
    </Suspense>
  )
}
