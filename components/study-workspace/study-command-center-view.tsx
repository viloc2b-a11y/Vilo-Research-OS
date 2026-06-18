import Link from 'next/link'
import { AlertTriangle, Clock, Activity, FileCheck, CheckCircle2, FileText, ChevronRight } from 'lucide-react'
import type { StudyWorkspaceRuntimeLinks } from '@/lib/study-workspace/study-workspace-links'
import type { StudyCommandCenterMetrics } from '@/lib/study-workspace/load-study-command-center-metrics'
import type { StudyBudgetEvidenceSummary } from '@/lib/study-workspace/load-budget-evidence-summary'
import type { StudyPatientAcquisitionSummary } from '@/lib/study-workspace/load-patient-acquisition-summary'
import type { StudyGovernanceSummary } from '@/lib/study-workspace/load-governance-summary'
import type { StudyFinancialRuntimeSummary } from '@/lib/study-workspace/load-financial-runtime-summary'
import type { StudyWorkflowSummary } from '@/lib/study-workspace/load-workflow-summary'
import type { EnrollmentVelocityResult } from '@/lib/crm/enrollment-velocity'
import type { RecruitmentForecast } from '@/lib/crm/recruitment-forecast'
import type { RecruitmentFunnelSummary, SourceEffectivenessReport } from '@/lib/crm/recruitment-intelligence'
import { BudgetNegotiationLedgerPanel } from './budget-negotiation-ledger-panel'
import { EnrollmentVelocityIndicator } from '@/components/recruitment-intelligence/EnrollmentVelocityIndicator'
import { RecruitmentForecastCard } from '@/components/recruitment-intelligence/RecruitmentForecastCard'
import { FunnelSnapshotCard } from '@/components/recruitment-intelligence/FunnelSnapshotCard'

type StudyCommandCenterViewProps = {
  studyName: string
  studyStatus: string | null
  studyId: string
  links: StudyWorkspaceRuntimeLinks
  metrics: StudyCommandCenterMetrics
  budgetEvidenceSummary: StudyBudgetEvidenceSummary
  patientAcquisitionSummary: StudyPatientAcquisitionSummary
  enrollmentVelocity: EnrollmentVelocityResult
  recruitmentForecast: RecruitmentForecast
  recruitmentFunnel: RecruitmentFunnelSummary
  sourceEffectiveness: SourceEffectivenessReport
  governanceSummary: StudyGovernanceSummary
  financialRuntimeSummary: StudyFinancialRuntimeSummary
  workflowSummary: StudyWorkflowSummary
}

export function StudyCommandCenterView({
  studyName,
  studyStatus,
  studyId,
  links,
  metrics,
  budgetEvidenceSummary,
  patientAcquisitionSummary,
  enrollmentVelocity,
  recruitmentForecast,
  recruitmentFunnel,
  sourceEffectiveness,
  governanceSummary,
  financialRuntimeSummary,
  workflowSummary,
}: StudyCommandCenterViewProps) {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="rounded-md border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-800">Study Command Center</h2>
        <p className="mt-2 text-sm text-slate-600">
          Operational overview for <span className="font-medium text-slate-900">{studyName}</span>
          {studyStatus ? (
            <span className="text-slate-500"> · {studyStatus}</span>
          ) : null}
        </p>
      </div>

      <div className="rounded-md border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h3 className="font-semibold text-slate-900">Coordinator execution</h3>
            <p className="mt-1 text-sm text-slate-500">
              Open the approved source and the visit workspace from the same study context.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href={links.publishedSource}
              className="inline-flex items-center justify-center rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-900 hover:bg-slate-50"
            >
              Open approved source
            </Link>
            <Link
              href={links.visitRuntime}
              className="inline-flex items-center justify-center rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800"
            >
              Open visit runtime
            </Link>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        
        {/* Action Required */}
        <div className="flex flex-col gap-4 rounded-md border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-600" />
            <h3 className="font-semibold text-slate-900">Action Required</h3>
          </div>
          
          <div className="space-y-3">
            <div className="flex items-center justify-between rounded border border-slate-100 bg-slate-50 p-3">
              <span className="text-sm font-medium text-slate-700">Pending Signatures</span>
              {metrics.actionRequired.pendingSignatures > 0 ? (
                <span className="inline-flex rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-800">
                  {metrics.actionRequired.pendingSignatures}
                </span>
              ) : (
                <span className="text-sm text-slate-400">0</span>
              )}
            </div>
            
            <div className="flex items-center justify-between rounded border border-slate-100 bg-slate-50 p-3">
              <span className="text-sm font-medium text-slate-700">Regulatory Expirations</span>
              {metrics.actionRequired.regulatoryExpirations > 0 ? (
                <span className="inline-flex rounded-full bg-rose-100 px-2.5 py-0.5 text-xs font-semibold text-rose-800">
                  {metrics.actionRequired.regulatoryExpirations}
                </span>
              ) : (
                <span className="text-sm text-slate-400">0</span>
              )}
            </div>
            
            <div className="flex items-center justify-between rounded border border-slate-100 bg-slate-50 p-3">
              <span className="text-sm font-medium text-slate-700">Open Obligations</span>
              {metrics.actionRequired.pendingSignatures > 0 ? (
                <span className="inline-flex rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-semibold text-blue-800">
                  {metrics.actionRequired.pendingSignatures}
                </span>
              ) : (
                <span className="text-sm text-slate-400">0</span>
              )}
            </div>
          </div>
        </div>

        {/* Visit Horizon */}
        <div className="flex flex-col gap-4 rounded-md border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-teal-600" />
            <h3 className="font-semibold text-slate-900">Visit Horizon</h3>
          </div>
          
          <div className="space-y-3">
            <div className="flex items-center justify-between rounded border border-slate-100 bg-slate-50 p-3">
              <span className="text-sm font-medium text-slate-700">Visits next 7 days</span>
              <span className="text-sm font-semibold text-slate-900">{metrics.visitHorizon.next7Days}</span>
            </div>
            
            <div className="flex items-center justify-between rounded border border-slate-100 bg-slate-50 p-3">
              <span className="text-sm font-medium text-slate-700">Visits next 14 days</span>
              <span className="text-sm font-semibold text-slate-900">{metrics.visitHorizon.next14Days}</span>
            </div>
            
            <div className="flex items-center justify-between rounded border border-slate-100 bg-slate-50 p-3">
              <span className="text-sm font-medium text-slate-700">Overdue Visits</span>
              {metrics.visitHorizon.overdue > 0 ? (
                <span className="inline-flex rounded-full bg-rose-100 px-2.5 py-0.5 text-xs font-semibold text-rose-800">
                  {metrics.visitHorizon.overdue}
                </span>
              ) : (
                <span className="text-sm font-semibold text-slate-900">0</span>
              )}
            </div>
          </div>
          
          <div className="mt-auto pt-2">
            <Link 
              href={links.visitRuntime} 
              className="inline-flex w-full items-center justify-center gap-1 rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800"
            >
              Open Visit Matrix <ChevronRight className="h-4 w-4" />
            </Link>
          </div>
        </div>

        {/* Subject Attention */}
        <div className="flex flex-col gap-4 rounded-md border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-blue-600" />
            <h3 className="font-semibold text-slate-900">Subject Attention</h3>
          </div>
          
          <div className="space-y-3">
            <div className="flex items-center justify-between rounded border border-slate-100 bg-slate-50 p-3">
              <span className="text-sm font-medium text-slate-700">Active AE records</span>
              {metrics.subjectAttention.withActiveAEs > 0 ? (
                <span className="inline-flex rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-800">
                  {metrics.subjectAttention.withActiveAEs}
                </span>
              ) : (
                <span className="text-sm font-semibold text-slate-900">0</span>
              )}
            </div>
            
            <div className="flex items-center justify-between rounded border border-slate-100 bg-slate-50 p-3">
              <span className="text-sm font-medium text-slate-700">Overdue visit records</span>
              {metrics.subjectAttention.withOverdueVisits > 0 ? (
                <span className="inline-flex rounded-full bg-rose-100 px-2.5 py-0.5 text-xs font-semibold text-rose-800">
                  {metrics.subjectAttention.withOverdueVisits}
                </span>
              ) : (
                <span className="text-sm font-semibold text-slate-900">0</span>
              )}
            </div>
            
            <div className="flex items-center justify-between rounded border border-slate-100 bg-slate-50 p-3">
              <span className="text-sm font-medium text-slate-700">Subjects requiring review</span>
              {metrics.subjectAttention.requiringReview > 0 ? (
                <span className="inline-flex rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-semibold text-blue-800">
                  {metrics.subjectAttention.requiringReview}
                </span>
              ) : (
                <span className="text-sm font-semibold text-slate-900">0</span>
              )}
            </div>
          </div>
          
          <div className="mt-auto pt-2">
            <Link 
              href={links.studySubjects} 
              className="inline-flex w-full items-center justify-center gap-1 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-900 hover:bg-slate-50"
            >
              Open Subject Roster <ChevronRight className="h-4 w-4 text-slate-500" />
            </Link>
          </div>
        </div>
      </div>

      <section className="space-y-4">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">Runtime Intelligence</h3>
          <p className="mt-1 text-sm text-slate-500">
            Read-only signals from native runtime modules. Use these to decide what needs attention
            without leaving the study workspace.
          </p>
        </div>
        <div className="grid gap-4">
          <WorkflowCard links={links} summary={workflowSummary} />
          <GovernanceCard links={links} summary={governanceSummary} />
          <FinancialRuntimeCard links={links} summary={financialRuntimeSummary} />
          <PatientAcquisitionCard links={links} summary={patientAcquisitionSummary} />
          <RecruitmentIntelligenceCard
            enrollmentVelocity={enrollmentVelocity}
            recruitmentForecast={recruitmentForecast}
            recruitmentFunnel={recruitmentFunnel}
            sourceEffectiveness={sourceEffectiveness}
          />
          <BudgetEvidenceCard studyId={studyId} links={links} summary={budgetEvidenceSummary} financialRuntime={financialRuntimeSummary} />
        </div>
      </section>

      {/* Recent Activity */}
      <div className="rounded-md border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="font-semibold text-slate-900">Recent Activity</h3>
        <div className="mt-4 space-y-4">
          {metrics.recentActivity.length > 0 ? (
            metrics.recentActivity.map((activity, idx) => (
              <div key={`${activity.id}-${idx}`} className="flex items-start gap-3">
                <div className="mt-0.5 rounded-full bg-slate-100 p-1.5">
                  {activity.type === 'visit_completed' && <CheckCircle2 className="h-4 w-4 text-teal-600" />}
                  {activity.type === 'document_uploaded' && <FileText className="h-4 w-4 text-slate-600" />}
                  {activity.type === 'signature_completed' && <FileCheck className="h-4 w-4 text-blue-600" />}
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-900">{activity.description}</p>
                  <p className="text-xs text-slate-500">
                    {new Date(activity.date).toLocaleDateString()} at {new Date(activity.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>
            ))
          ) : (
            <div className="py-4 text-center text-sm text-slate-500">
              No recent activity recorded for this study.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function WorkflowCard({
  links,
  summary,
}: {
  links: StudyWorkspaceRuntimeLinks
  summary: StudyWorkflowSummary
}) {
  const hasOverdue = (summary.overdueActionCount ?? 0) > 0
  const hasUnassigned = (summary.unassignedActionCount ?? 0) > 0

  return (
    <div className="rounded-md border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h3 className="font-semibold text-slate-900">Work Queue</h3>
          <p className="mt-1 text-sm text-slate-500">
            Open runtime work from the existing subject workflow action backbone.
          </p>
        </div>
        <Link
          href={links.studySubjects}
          className="inline-flex rounded-md border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Open subjects
        </Link>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
        <EvidenceMetric label="Open work" value={summary.openActionCount} />
        <EvidenceMetric label="Overdue" value={summary.overdueActionCount} />
        <EvidenceMetric label="Due today" value={summary.dueTodayActionCount} />
        <EvidenceMetric label="High priority" value={summary.highPriorityActionCount} />
        <EvidenceMetric label="Unassigned" value={summary.unassignedActionCount} />
        <EvidenceMetric label="Query tasks" value={summary.queryActionCount} />
      </div>

      <div className="mt-3 flex flex-wrap gap-2 text-xs">
        <span
          className={
            hasOverdue
              ? 'rounded-full bg-rose-50 px-2.5 py-1 font-medium text-rose-800'
              : 'rounded-full bg-teal-50 px-2.5 py-1 font-medium text-teal-800'
          }
        >
          {hasOverdue ? 'Overdue work active' : 'No overdue workflow'}
        </span>
        <span
          className={
            hasUnassigned
              ? 'rounded-full bg-amber-50 px-2.5 py-1 font-medium text-amber-800'
              : 'rounded-full bg-teal-50 px-2.5 py-1 font-medium text-teal-800'
          }
        >
          {hasUnassigned ? 'Assignment cleanup needed' : 'Work assigned'}
        </span>
      </div>

      {summary.unavailable.length > 0 ? (
        <p className="mt-3 text-xs text-amber-700">
          Some workflow counts are unavailable. Open the subject roster for details.
        </p>
      ) : null}
    </div>
  )
}

function FinancialRuntimeCard({
  links,
  summary,
}: {
  links: StudyWorkspaceRuntimeLinks
  summary: StudyFinancialRuntimeSummary
}) {
  const hasLeakage = (summary.leakageVisitCount ?? 0) > 0 || (summary.leakageItemCount ?? 0) > 0
  const earnedRate =
    summary.averageEarnedRateBasisPoints === null
      ? null
      : Math.round(summary.averageEarnedRateBasisPoints / 100)

  return (
    <div className="rounded-md border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h3 className="font-semibold text-slate-900">Financial Runtime</h3>
          <p className="mt-1 text-sm text-slate-500">
            Runtime-derived expected, executed, earned, and leakage visibility. Not accounting or AR.
          </p>
        </div>
        <Link
          href={links.visitRuntime}
          className="inline-flex rounded-md border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Open visits
        </Link>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
        <EvidenceMetric label="Projected visits" value={summary.projectionCount} />
        <EvidenceMetric label="Leakage visits" value={summary.leakageVisitCount} />
        <EvidenceMetric label="Expected proc" value={summary.expectedProcedureCount} />
        <EvidenceMetric label="Executed proc" value={summary.executedProcedureCount} />
        <EvidenceMetric label="Earned proc" value={summary.earnedProcedureCount} />
        <EvidenceMetric label="Leakage items" value={summary.leakageItemCount} />
      </div>

      <div className="mt-3 flex flex-wrap gap-2 text-xs">
        <span
          className={
            hasLeakage
              ? 'rounded-full bg-amber-50 px-2.5 py-1 font-medium text-amber-800'
              : 'rounded-full bg-teal-50 px-2.5 py-1 font-medium text-teal-800'
          }
        >
          {hasLeakage ? 'Revenue protection needed' : 'No leakage detected'}
        </span>
        <span className="rounded-full bg-slate-100 px-2.5 py-1 font-medium text-slate-600">
          Earned rate: {earnedRate === null ? '—' : `${earnedRate}%`}
        </span>
        <span className="rounded-full bg-slate-100 px-2.5 py-1 font-medium text-slate-600">
          Max leakage score: {summary.maxLeakageScore ?? '—'}
        </span>
      </div>

      {summary.projectionCount && summary.projectionCount > summary.sampleLimit ? (
        <p className="mt-3 text-xs text-slate-500">
          Rollup uses the latest {summary.sampleLimit} visit financial projections.
        </p>
      ) : null}

      {summary.unavailable.length > 0 ? (
        <p className="mt-3 text-xs text-amber-700">
          Some financial runtime counts are unavailable. Open visit runtime for details.
        </p>
      ) : null}
    </div>
  )
}

function GovernanceCard({
  links,
  summary,
}: {
  links: StudyWorkspaceRuntimeLinks
  summary: StudyGovernanceSummary
}) {
  const hasBlockers = (summary.blockerSignalCount ?? 0) > 0
  const hasOpenQueries = (summary.openSnapshotQueryCount ?? 0) > 0

  return (
    <div className="rounded-md border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h3 className="font-semibold text-slate-900">Governance & Queries</h3>
          <p className="mt-1 text-sm text-slate-500">
            Runtime-derived blockers, review queries, and formal deviation workload.
          </p>
        </div>
        <Link
          href={links.operationalReview}
          className="inline-flex rounded-md border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Open review
        </Link>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
        <EvidenceMetric label="Signals" value={summary.openGovernanceSignalCount} />
        <EvidenceMetric label="Blockers" value={summary.blockerSignalCount} />
        <EvidenceMetric label="Warnings" value={summary.warningSignalCount} />
        <EvidenceMetric label="Open queries" value={summary.openSnapshotQueryCount} />
        <EvidenceMetric label="High queries" value={summary.criticalSnapshotQueryCount} />
        <EvidenceMetric label="Deviations" value={summary.activeDeviationCount} />
      </div>

      <div className="mt-3 flex flex-wrap gap-2 text-xs">
        <span
          className={
            hasBlockers
              ? 'rounded-full bg-rose-50 px-2.5 py-1 font-medium text-rose-800'
              : 'rounded-full bg-teal-50 px-2.5 py-1 font-medium text-teal-800'
          }
        >
          {hasBlockers ? 'Governance blocker active' : 'No governance blockers'}
        </span>
        <span
          className={
            hasOpenQueries
              ? 'rounded-full bg-amber-50 px-2.5 py-1 font-medium text-amber-800'
              : 'rounded-full bg-teal-50 px-2.5 py-1 font-medium text-teal-800'
          }
        >
          {hasOpenQueries ? 'Query review needed' : 'No open review queries'}
        </span>
      </div>

      {summary.unavailable.length > 0 ? (
        <p className="mt-3 text-xs text-amber-700">
          Some governance counts are unavailable. Open operational review for details.
        </p>
      ) : null}
    </div>
  )
}

function PatientAcquisitionCard({
  links,
  summary,
}: {
  links: StudyWorkspaceRuntimeLinks
  summary: StudyPatientAcquisitionSummary
}) {
  const missingSourceCount = summary.unattributedSubjectCount ?? 0
  const hasMissingSources = missingSourceCount > 0

  return (
    <div className="rounded-md border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h3 className="font-semibold text-slate-900">Patient Acquisition</h3>
          <p className="mt-1 text-sm text-slate-500">
            Native attribution from enrolled study subjects. Lead/vendor pipeline is not active in
            this G1 view.
          </p>
        </div>
        <Link
          href={links.studySubjects}
          className="inline-flex rounded-md border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Open roster
        </Link>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
        <EvidenceMetric label="Subjects" value={summary.subjectCount} />
        <EvidenceMetric label="Attributed" value={summary.attributedSubjectCount} />
        <EvidenceMetric label="Source missing" value={summary.unattributedSubjectCount} />
        <EvidenceMetric label="Screening" value={summary.screeningCount} />
        <EvidenceMetric label="Randomized" value={summary.randomizedCount} />
        <EvidenceMetric label="Screen failed" value={summary.screenFailedCount} />
      </div>

      {summary.topSources.length > 0 ? (
        <div className="mt-4 rounded border border-slate-100 bg-slate-50 p-3">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Top recruitment sources
          </p>
          <div className="mt-3 grid gap-2 text-xs sm:grid-cols-2 lg:grid-cols-5">
            {summary.topSources.map((source) => (
              <div key={source.source} className="rounded bg-white px-2.5 py-2">
                <p className="truncate font-medium text-slate-700" title={source.source}>
                  {source.source}
                </p>
                <p className="mt-1 text-slate-500">
                  {source.subjectCount} subjects · {source.randomizedCount} randomized
                </p>
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs text-slate-500">
            Source mix is capped to the latest {summary.sourceSampleLimit} attributed subjects.
          </p>
        </div>
      ) : null}

      <div className="mt-3 flex flex-wrap gap-2 text-xs">
        <span
          className={
            hasMissingSources
              ? 'rounded-full bg-amber-50 px-2.5 py-1 font-medium text-amber-800'
              : 'rounded-full bg-teal-50 px-2.5 py-1 font-medium text-teal-800'
          }
        >
          {hasMissingSources ? 'Attribution cleanup needed' : 'Sources attributed'}
        </span>
      </div>

      {summary.unavailable.length > 0 ? (
        <p className="mt-3 text-xs text-amber-700">
          Some acquisition counts are unavailable. Open the subject roster for details.
        </p>
      ) : null}
    </div>
  )
}

function BudgetEvidenceCard({
  studyId,
  links,
  summary,
  financialRuntime,
}: {
  studyId: string
  links: StudyWorkspaceRuntimeLinks
  summary: StudyBudgetEvidenceSummary
  financialRuntime: StudyFinancialRuntimeSummary
}) {
  const hasBudgetEvidence =
    (summary.budgetDocumentCount ?? 0) > 0 || (summary.contractDocumentCount ?? 0) > 0
  const hasActiveReference =
    (summary.activeBudgetReferenceCount ?? 0) > 0 ||
    (summary.activeContractReferenceCount ?? 0) > 0
  const readinessTone =
    summary.negotiationReadiness === 'ready'
      ? 'bg-teal-50 text-teal-800'
      : summary.negotiationReadiness === 'review_needed'
        ? 'bg-amber-50 text-amber-800'
        : 'bg-rose-50 text-rose-800'

  return (
    <div className="rounded-md border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h3 className="font-semibold text-slate-900">Budget / CTA Evidence</h3>
          <p className="mt-1 text-sm text-slate-500">
            Evidence available for budget review before negotiation or financial interpretation.
          </p>
        </div>
        <Link
          href={links.documentIntelligence}
          className="inline-flex rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800"
        >
          Open review
        </Link>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <EvidenceMetric label="Budget docs" value={summary.budgetDocumentCount} />
        <EvidenceMetric label="CTA docs" value={summary.contractDocumentCount} />
        <EvidenceMetric label="Budget chunks" value={summary.budgetChunkCount} />
        <EvidenceMetric label="CTA chunks" value={summary.contractChunkCount} />
      </div>

      <div className="mt-4 rounded border border-slate-100 bg-slate-50 p-3">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
          Candidate term language
        </p>
        <div className="mt-3 grid gap-2 text-xs sm:grid-cols-2 lg:grid-cols-5">
          <TermHint label="Payment terms" value={summary.paymentTermsHintCount} />
          <TermHint label="Invoice due" value={summary.invoiceDueHintCount} />
          <TermHint label="Pass-through" value={summary.passThroughHintCount} />
          <TermHint label="Screen failure" value={summary.screenFailureHintCount} />
          <TermHint label="Invoiceable procedures" value={summary.invoiceableProcedureHintCount} />
        </div>
        <p className="mt-3 text-xs text-slate-500">
          These are read-only evidence hints from indexed Budget/CTA text. Review the source chunks
          before using them for negotiation or financial interpretation.
        </p>
      </div>

      <div className="mt-3 flex flex-wrap gap-2 text-xs">
        <span
          className={
            hasBudgetEvidence
              ? 'rounded-full bg-teal-50 px-2.5 py-1 font-medium text-teal-800'
              : 'rounded-full bg-amber-50 px-2.5 py-1 font-medium text-amber-800'
          }
        >
          {hasBudgetEvidence ? 'Evidence available' : 'Budget/CTA evidence missing'}
        </span>
        <span
          className={
            hasActiveReference
              ? 'rounded-full bg-teal-50 px-2.5 py-1 font-medium text-teal-800'
              : 'rounded-full bg-slate-100 px-2.5 py-1 font-medium text-slate-600'
          }
        >
          {hasActiveReference ? 'Active reference set' : 'No active reference'}
        </span>
      </div>

      <div className="mt-4 rounded border border-slate-100 bg-slate-50 p-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Negotiation readiness
          </p>
          <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${readinessTone}`}>
            {summary.negotiationReadiness.replace('_', ' ')}
          </span>
        </div>
        <p className="mt-2 text-sm text-slate-700">{summary.negotiationReason}</p>
        <p className="mt-1 text-xs text-slate-500">
          Next: {summary.negotiationNextStep}
        </p>
        <div className="mt-3 rounded border border-slate-100 bg-white p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Negotiation sequence
            </p>
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-700">
              Current: {summary.negotiationState.label}
            </span>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {summary.negotiationState.sequence.map((step) => (
              <span
                key={step.key}
                className={
                  step.status === 'current'
                    ? 'rounded-full bg-teal-50 px-2.5 py-1 text-[11px] font-semibold text-teal-800'
                    : step.status === 'complete'
                      ? 'rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-700'
                      : 'rounded-full bg-slate-50 px-2.5 py-1 text-[11px] text-slate-500'
                }
              >
                {step.label}
              </span>
            ))}
          </div>
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          <DerivedSignal label="FMV gap" value={summary.budgetIntelligence.fmvGap.summary} />
          <DerivedSignal
            label="Operational burden"
            value={summary.budgetIntelligence.operationalBurdenGap.summary}
          />
          <DerivedSignal
            label="Payment term risk"
            value={summary.budgetIntelligence.paymentTermRisk.summary}
          />
          <DerivedSignal
            label="Pass-through risk"
            value={summary.budgetIntelligence.passThroughRisk.summary}
          />
          <DerivedSignal
            label="Screen fail gap"
            value={summary.budgetIntelligence.screenFailureProtectionGap.summary}
          />
          <DerivedSignal
            label="Projected revenue"
            value={summary.budgetIntelligence.projectedRevenueImpact.summary}
          />
        </div>

        {summary.negotiationFocusAreas.length > 0 ? (
          <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {summary.negotiationFocusAreas.map((area) => (
              <div key={area.label} className="rounded bg-white px-3 py-2 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium text-slate-700">{area.label}</span>
                  <span className="font-semibold text-slate-900">
                    {area.count === null ? '—' : area.count}
                  </span>
                </div>
                <p className="mt-1 text-slate-500">{area.nextStep}</p>
              </div>
            ))}
          </div>
        ) : null}
      </div>

      <div className="mt-4 rounded border border-slate-100 bg-white p-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Draft counteroffer response
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-700">
              Documented response
            </span>
            <Link
              href={`/api/study-workspace/${studyId}/budget-negotiation-export`}
              download
              className="rounded border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
            >
              Export counteroffer
            </Link>
          </div>
        </div>
        <p className="mt-2 text-sm font-medium text-slate-900">
          {summary.counterofferDraft.title}
        </p>
        <p className="mt-1 text-sm text-slate-700">{summary.counterofferDraft.summary}</p>
        <ol className="mt-3 space-y-2 text-xs text-slate-600">
          {summary.counterofferDraft.items.map((item) => (
            <li key={item.label} className="rounded border border-slate-100 bg-slate-50 p-3">
              <p className="font-medium text-slate-800">{item.label}</p>
              <p className="mt-1 text-slate-700">
                <span className="font-medium text-slate-900">Ask: </span>
                {item.ask}
              </p>
              <p className="mt-1 text-slate-500">{item.rationale}</p>
            </li>
          ))}
        </ol>
      </div>

      <BudgetNegotiationLedgerPanel studyId={studyId} summary={summary} financialRuntime={financialRuntime} />

      {summary.unavailable.length > 0 ? (
        <p className="mt-3 text-xs text-amber-700">
          Some evidence counts are unavailable. Open Document Intelligence for details.
        </p>
      ) : null}
    </div>
  )
}

function RecruitmentIntelligenceCard({
  enrollmentVelocity,
  recruitmentForecast,
  recruitmentFunnel,
  sourceEffectiveness,
}: {
  enrollmentVelocity: EnrollmentVelocityResult
  recruitmentForecast: RecruitmentForecast
  recruitmentFunnel: RecruitmentFunnelSummary
  sourceEffectiveness: SourceEffectivenessReport
}) {
  // Source concentration warning: any source with >80% of total leads
  const totalLeads = sourceEffectiveness.sources.reduce((sum, s) => sum + s.total_leads, 0)
  const concentratedSource =
    totalLeads > 0
      ? sourceEffectiveness.sources.find((s) => s.total_leads / totalLeads > 0.8)
      : null

  return (
    <div className="rounded-md border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h3 className="font-semibold text-slate-900">Recruitment Intelligence</h3>
          <p className="mt-1 text-sm text-slate-500">
            Velocity, forecast, and funnel signals from the CRM pipeline.
          </p>
        </div>
      </div>

      {concentratedSource ? (
        <div className="mt-4 rounded border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <AlertTriangle className="mb-1 inline-block h-4 w-4 text-amber-600" />{' '}
          <strong>Source concentration risk:</strong>{' '}
          {((concentratedSource.total_leads / totalLeads) * 100).toFixed(0)}% of leads from{' '}
          <span className="font-medium">{concentratedSource.source_channel}</span>
        </div>
      ) : null}

      <div className="mt-4 space-y-4">
        <EnrollmentVelocityIndicator
          currentVelocity={enrollmentVelocity.current_velocity}
          velocityTrend={enrollmentVelocity.velocity_trend}
          compact={false}
        />
        <RecruitmentForecastCard {...recruitmentForecast} />
        <FunnelSnapshotCard {...recruitmentFunnel} />
      </div>
    </div>
  )
}

function EvidenceMetric({ label, value }: { label: string; value: number | null }) {
  return (
    <div className="rounded border border-slate-100 bg-slate-50 p-3">
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className="mt-1 text-lg font-semibold text-slate-900">
        {value === null ? '—' : value}
      </p>
    </div>
  )
}

function TermHint({ label, value }: { label: string; value: number | null }) {
  return (
    <div className="flex items-center justify-between gap-2 rounded bg-white px-2.5 py-2">
      <span className="text-slate-600">{label}</span>
      <span className="font-semibold text-slate-900">{value === null ? '—' : value}</span>
    </div>
  )
}

function DerivedSignal({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded bg-slate-50 px-3 py-2 text-xs">
      <p className="font-medium text-slate-700">{label}</p>
      <p className="mt-1 text-slate-600">{value}</p>
    </div>
  )
}
