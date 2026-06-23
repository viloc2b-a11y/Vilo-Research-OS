'use client'

import { useCallback, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { buildStudyWorkspaceRuntimeLinks } from '@/lib/study-workspace/study-workspace-links'
import type { StudySetupDocument } from '@/lib/study-workspace/load-study-setup-documents'
import type {
  StudyWorkspaceSectionId,
  StudyWorkspaceSummary,
} from '@/lib/study-workspace/study-workspace-types'
import { StudyActivityFeed } from './study-activity-feed'
import { StudyDelegationPanel } from './study-delegation-panel'
import { StudyMonitoringViewPanel } from './study-monitoring-view-panel'
import { StudyRegulatoryBinderView } from './study-regulatory-binder-view'
import { StudyDocumentsView } from './study-documents-view'
import { StudyVisitMatrixView } from './study-visit-matrix-view'
import { StudySetupPanel } from './study-setup-panel'
import { StudySourcePanel } from './study-source-panel'
import { StudySubjectRosterView } from './study-subject-roster-view'
import { StudyTrainingPanel } from './study-training-panel'
import { StudyGovernancePanel } from './study-governance-panel'
import { StudyCommandCenterView } from './study-command-center-view'
import { StudyOperationsPanel } from '@/components/coordinator-operations/StudyOperationsPanel'
import { StudyVisitSourceContinuityPanel } from '@/components/coordinator-operations/StudyVisitSourceContinuityPanel'
import { STUDY_WORKSPACE_NAV_ITEMS, StudyWorkspaceNav } from './study-workspace-nav'
import type { RuntimeReadinessContinuityRow } from '@/lib/studies/runtime-readiness'
import type { StudyOperationsSurface } from '@/lib/coordinator-operations/types'

const VALID_SECTIONS = new Set<string>(STUDY_WORKSPACE_NAV_ITEMS.map((item) => item.id))

function parseSection(value: string | null): StudyWorkspaceSectionId {
  if (value && VALID_SECTIONS.has(value)) return value as StudyWorkspaceSectionId
  return 'overview'
}

import type { ComplianceRuntimeDocument } from '@/lib/document-intake/compliance-types'
import type { StudyVisitRow } from '@/lib/visits/loadStudyVisits'
import type { StudySubjectRosterRow } from '@/lib/study-workspace/load-study-subject-roster'
import type { StudyCommandCenterMetrics } from '@/lib/study-workspace/load-study-command-center-metrics'
import type { StudyBudgetEvidenceSummary } from '@/lib/study-workspace/load-budget-evidence-summary'
import type { StudyPatientAcquisitionSummary } from '@/lib/study-workspace/load-patient-acquisition-summary'
import type { StudyGovernanceSummary } from '@/lib/study-workspace/load-governance-summary'
import type { EnrollmentVelocityResult } from '@/lib/crm/enrollment-velocity'
import type { RecruitmentForecast } from '@/lib/crm/recruitment-forecast'
import type { RecruitmentFunnelSummary, SourceEffectivenessReport } from '@/lib/crm/recruitment-intelligence'
import type { StudyCloseoutSummary } from '@/lib/study-workspace/load-study-closeout-summary'
import type { StudyFinancialRuntimeSummary } from '@/lib/study-workspace/load-financial-runtime-summary'
import type { StudyWorkflowSummary } from '@/lib/study-workspace/load-workflow-summary'
import type { LoadedProtocolRuntimeStudy } from '@/lib/protocol-intake-runtime/protocol-intake-types'
import type { StudyInvoiceSummary } from '@/lib/financial-runtime/study-invoice-summary'
import type { ProtocolDeviationRow } from '@/lib/protocol-deviations/deviation-types'
import type { CapaActionRow } from '@/lib/capa-runtime/capa-types'
import { DeviationCenter } from '@/components/site-intelligence/DeviationCenter'
import type { ActivityCodeEntry } from '@/lib/cliniq-core/activity-code-library'
import type { SystemLibraryEntry } from '@/lib/study-workspace/system-library'
import type { StudySystemsWithUsage, StudyAccessData } from '@/lib/study-workspace/load-study-systems-with-usage'
import type { TechnologyStack } from '@/lib/study-workspace/load-study-technology-stack'
import type { ActivitySystemMapWithSystem } from '@/lib/study-workspace/activity-system-map'
import type { SystemRecommendationWithDetails } from '@/lib/study-workspace/system-recommendations'
import { StudySystemsPanel } from './study-systems-panel'
import { StudyAccessReadinessPanel } from './study-access-readiness-panel'
import { StudyTechnologyStackView, TechStackSummaryCard } from './study-technology-stack-view'
import { StudyStartupWorkspaceView, StartupReadinessCard } from './study-startup-workspace-view'
import type { StartupReadinessResult } from '@/lib/study-workspace/study-startup-readiness'
import { ReadyToStartCard, ReadyToStartSummaryCard } from './ready-to-start-view'
import type { ReadyToStartDecision } from '@/lib/study-workspace/ready-to-start-decision'
import type { RegulatorySignal } from '@/lib/regulatory-center/regulatory-signals'
import type { StudyReadiness } from '@/lib/study-readiness/study-readiness'

type StudyWorkspaceShellProps = {
  summary: StudyWorkspaceSummary
  subjects: StudySubjectRosterRow[]
  subjectSearchQuery: string
  visitSearchQuery: string
  docsSearchQuery: string
  binderSearchQuery: string
  setupDocuments: StudySetupDocument[]
  hasProtocolDraft: boolean
  regulatoryDocuments: ComplianceRuntimeDocument[]
  studyDocuments: ComplianceRuntimeDocument[]
  visits: StudyVisitRow[]
  commandCenterMetrics: StudyCommandCenterMetrics
  budgetEvidenceSummary: StudyBudgetEvidenceSummary
  patientAcquisitionSummary: StudyPatientAcquisitionSummary
  enrollmentVelocity: EnrollmentVelocityResult
  recruitmentForecast: RecruitmentForecast
  recruitmentFunnel: RecruitmentFunnelSummary
  sourceEffectiveness: SourceEffectivenessReport
  governanceSummary: StudyGovernanceSummary
  closeoutSummary: StudyCloseoutSummary
  financialRuntimeSummary: StudyFinancialRuntimeSummary
  invoiceSummary: StudyInvoiceSummary | null
  workflowSummary: StudyWorkflowSummary
  protocolRuntimeStudy: LoadedProtocolRuntimeStudy | null
  studyOperationsSurface: StudyOperationsSurface
  continuityRows: RuntimeReadinessContinuityRow[]
  deviations: ProtocolDeviationRow[]
  subjectMap: Record<string, string>
  capaByDeviationId: Record<string, CapaActionRow>
  activityCodeCatalog?: ActivityCodeEntry[]
  studySystemsUsage: StudySystemsWithUsage
  systemLibrary: SystemLibraryEntry[]
  accessData: StudyAccessData
  activitySystemMappings: ActivitySystemMapWithSystem[]
  allRecommendations: SystemRecommendationWithDetails[]
  techStack: TechnologyStack
  startupReadiness: StartupReadinessResult
  readyToStart: ReadyToStartDecision
  regulatorySignals: { signals: RegulatorySignal[]; critical: number; warning: number; total: number }
  studyReadiness: StudyReadiness
}

export function StudyWorkspaceShell({
  summary,
  subjects,
  subjectSearchQuery,
  visitSearchQuery,
  docsSearchQuery,
  binderSearchQuery,
  setupDocuments,
  hasProtocolDraft,
  regulatoryDocuments,
  studyDocuments,
  visits,
  commandCenterMetrics,
  budgetEvidenceSummary,
  patientAcquisitionSummary,
  enrollmentVelocity,
  recruitmentForecast,
  recruitmentFunnel,
  sourceEffectiveness,
  governanceSummary,
  closeoutSummary,
  financialRuntimeSummary,
  invoiceSummary,
  workflowSummary,
  protocolRuntimeStudy,
  studyOperationsSurface,
  continuityRows,
  deviations,
  subjectMap,
  capaByDeviationId,
  activityCodeCatalog,
  studySystemsUsage,
  systemLibrary,
  accessData,
  activitySystemMappings,
  allRecommendations,
  techStack,
  startupReadiness,
  readyToStart,
  regulatorySignals,
  studyReadiness,
}: StudyWorkspaceShellProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const initialSection = parseSection(searchParams.get('section'))
  const [activeSection, setActiveSection] = useState<StudyWorkspaceSectionId>(initialSection)

  const links = useMemo(
    () => buildStudyWorkspaceRuntimeLinks(summary.study.id),
    [summary.study.id],
  )

  const onSelectSection = useCallback(
    (section: StudyWorkspaceSectionId) => {
      setActiveSection(section)
      const params = new URLSearchParams(searchParams.toString())
      params.set('section', section)
      router.replace(`/studies/${summary.study.id}/workspace?${params.toString()}`, {
        scroll: false,
      })
    },
    [router, searchParams, summary.study.id],
  )

  return (
    <div className="min-h-0 space-y-6 p-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <nav className="mb-2 flex items-center gap-2 text-xs font-medium text-slate-500">
            <Link href="/studies" className="hover:text-slate-700 hover:underline">
              Studies
            </Link>
            <span>/</span>
            <span className="text-slate-400">{summary.study.name}</span>
            <span>/</span>
            <span className="text-slate-400">Workspace</span>
          </nav>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">{summary.study.name}</h1>
          {summary.study.status ? (
            <p className="mt-1 text-sm text-slate-500">Status: {summary.study.status}</p>
          ) : null}
        </div>
        <div className="flex items-center gap-4">
          <Link
            href={`/document-intelligence?study_id=${summary.study.id}`}
            className="text-sm font-medium text-teal-700 hover:underline flex items-center gap-1.5"
          >
            Study Copilot
          </Link>
          <Link
            href={`/studies/${summary.study.id}/amendments`}
            className="text-sm font-medium text-slate-600 hover:text-slate-900 hover:underline"
          >
            Amendments
          </Link>
          <Link
            href={links.studyDetail}
            className="text-sm font-medium text-slate-600 hover:text-slate-900 hover:underline"
          >
            Study detail
          </Link>
        </div>
      </header>

      <StudyWorkspaceNav activeSection={activeSection} onSelect={onSelectSection} />

      <div className="min-h-[320px] rounded-md border border-slate-200 bg-white p-5">
        {activeSection === 'overview' ? (
          <div className="space-y-6">
            {/* Ready To Start — top-level decision */}
            <ReadyToStartCard decision={readyToStart} />

            <StudyOperationsPanel surface={studyOperationsSurface} />
            <StudyCommandCenterView
              studyId={summary.study.id}
              studyName={summary.study.name}
              studyStatus={summary.study.status}
              links={links}
              metrics={commandCenterMetrics}
              budgetEvidenceSummary={budgetEvidenceSummary}
              patientAcquisitionSummary={patientAcquisitionSummary}
              enrollmentVelocity={enrollmentVelocity}
              recruitmentForecast={recruitmentForecast}
              recruitmentFunnel={recruitmentFunnel}
              sourceEffectiveness={sourceEffectiveness}
              governanceSummary={governanceSummary}
              financialRuntimeSummary={financialRuntimeSummary}
              invoiceSummary={invoiceSummary}
              workflowSummary={workflowSummary}
              activityCodeCatalog={activityCodeCatalog}
              quickLaunchPinned={studySystemsUsage.pinnedSystems}
              quickLaunchMostUsed={studySystemsUsage.mostUsed}
              accessBlockers={accessData.readinessSummary.blockers}
              accessScore={accessData.readinessSummary.score}
              techStack={techStack}
              startupReadiness={startupReadiness}
              readyToStart={readyToStart}
              regulatorySignals={regulatorySignals.signals}
              studyReadiness={studyReadiness}
            />
            <StudyVisitSourceContinuityPanel rows={continuityRows} embedded />
          </div>
        ) : null}

        {activeSection === 'study-setup' ? (
          <StudySetupPanel
            documents={setupDocuments}
            links={links}
            studyId={summary.study.id}
            hasProtocolDraft={hasProtocolDraft}
            hasPublishedSource={(summary.counts.publishedSourceCount ?? 0) > 0}
          />
        ) : null}

        {activeSection === 'subjects' ? (
          <StudySubjectRosterView
            studyId={summary.study.id}
            subjects={subjects}
            searchQuery={subjectSearchQuery}
          />
        ) : null}

        {activeSection === 'source-runtime' ? <StudySourcePanel links={links} /> : null}

        {activeSection === 'published-source' ? (
          <PublishedSourceSection links={links} count={summary.counts.publishedSourceCount} />
        ) : null}

        {activeSection === 'visit-runtime' ? (
          <StudyVisitMatrixView
            studyId={summary.study.id}
            visits={visits}
            searchQuery={visitSearchQuery}
          />
        ) : null}

        {activeSection === 'regulatory-binder' ? (
          <StudyRegulatoryBinderView
            studyId={summary.study.id}
            links={links}
            documents={regulatoryDocuments}
            searchQuery={binderSearchQuery}
          />
        ) : null}

        {activeSection === 'governance' ? (
          <StudyGovernancePanel
            studyId={summary.study.id}
            links={links}
            governanceSummary={governanceSummary}
            closeoutSummary={closeoutSummary}
            protocolRuntimeStudy={protocolRuntimeStudy}
          />
        ) : null}

        {activeSection === 'training' ? (
          <StudyTrainingPanel links={links} studyId={summary.study.id} />
        ) : null}

        {activeSection === 'delegation' ? (
          <StudyDelegationPanel links={links} studyId={summary.study.id} />
        ) : null}

        {activeSection === 'documents' ? (
          <StudyDocumentsView
            studyId={summary.study.id}
            links={links}
            documents={studyDocuments}
            searchQuery={docsSearchQuery}
          />
        ) : null}

        {activeSection === 'site-intelligence' ? (
          <DeviationCenter
            deviations={deviations}
            organizationId={summary.study.organizationId}
            studyId={summary.study.id}
            subjectMap={subjectMap}
            capaByDeviationId={capaByDeviationId}
          />
        ) : null}

        {activeSection === 'monitoring' ? (
          <StudyMonitoringViewPanel counts={summary.counts} />
        ) : null}

        {activeSection === 'activity' ? <StudyActivityFeed studyId={summary.study.id} /> : null}

        {activeSection === 'startup' ? (
          <div className="space-y-6">
            <ReadyToStartCard decision={readyToStart} />
            <StudyStartupWorkspaceView readiness={startupReadiness} />
          </div>
        ) : null}

        {activeSection === 'technology-stack' ? (
          <StudyTechnologyStackView techStack={techStack} />
        ) : null}

        {activeSection === 'systems' ? (
          <StudySystemsPanel
            studyId={summary.study.id}
            allSystems={studySystemsUsage.allSystems}
            recentlyUsed={studySystemsUsage.recentlyUsed}
            pinnedSystems={studySystemsUsage.pinnedSystems}
            library={systemLibrary}
            accessData={accessData}
            activitySystemMappings={activitySystemMappings}
            allRecommendations={allRecommendations}
          />
        ) : null}
      </div>
    </div>
  )
}

function PublishedSourceSection({
  links,
  count,
}: {
  links: ReturnType<typeof buildStudyWorkspaceRuntimeLinks>
  count: number | null
}) {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-sm font-semibold text-slate-800">Published Source</h2>
        <p className="mt-1 text-sm text-slate-500">
          Versioned published source packages used as the execution truth for visit workspaces.
          {count !== null ? ` ${count} published version(s).` : ''}
        </p>
      </div>
      <Link
        href={links.publishedSource}
        className="inline-flex rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800"
      >
        Open published source module
      </Link>
    </div>
  )
}


