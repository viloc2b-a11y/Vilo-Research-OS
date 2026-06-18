import { ClipboardList, Users, Activity } from 'lucide-react'
import { TodaysWorkPanel } from '@/app/(ops)/recruitment/_components/TodaysWorkPanel'
import { RecruitmentQueue } from '@/app/(ops)/recruitment/_components/RecruitmentQueue'
import { StudyPressureCards } from '@/app/(ops)/recruitment/_components/StudyPressureCards'
import type { RecruitmentViewModel } from '@/app/(ops)/recruitment/_lib/recruitment-view-model'
import type { RecruitmentFunnelSummary } from '@/lib/crm/recruitment-intelligence'
import type { SourceEffectivenessReport } from '@/lib/crm/recruitment-intelligence'
import type { CoordinatorRecruitmentStats } from '@/lib/crm/coordinator-recruitment-stats'
import type { RecruitmentForecast } from '@/lib/crm/recruitment-forecast'
import type { SiteBenchmarkReport } from '@/lib/benchmarking/score-against-benchmark'
import { RecruitmentFunnelPanel } from '@/components/recruitment-intelligence/RecruitmentFunnelPanel'
import { CoordinatorProductivityCard } from '@/components/recruitment-intelligence/CoordinatorProductivityCard'
import { PortfolioRecruitmentSummary } from '@/components/recruitment-intelligence/PortfolioRecruitmentSummary'
import { SourceEffectivenessCard } from '@/components/recruitment-intelligence/SourceEffectivenessCard'
import { PIStudyEnrollmentPanel } from '@/components/recruitment-intelligence/PIStudyEnrollmentPanel'

type StudyForecastEntry = {
  studyId: string
  studyName?: string
  forecast: RecruitmentForecast
}

type PIStudyEntry = {
  studyId: string
  studyName: string
  randomizedCount: number
  enrollmentTarget: number
  qualifiedCount: number
  scheduledCount: number
  forecastRisk?: 'on_track' | 'at_risk' | 'critical' | 'impossible' | null
  workspaceHref: string
}

export function RecruitmentCommandCenterShell({
  model,
  organizationId,
  result,
  reason,
  funnelSummary,
  coordinatorStats,
  sourceEffectiveness,
  studyForecasts,
  benchmarkReport,
  piStudies,
}: {
  model: RecruitmentViewModel
  organizationId: string
  result?: string
  reason?: string
  funnelSummary?: RecruitmentFunnelSummary
  coordinatorStats?: CoordinatorRecruitmentStats
  sourceEffectiveness?: SourceEffectivenessReport
  studyForecasts?: StudyForecastEntry[]
  benchmarkReport?: SiteBenchmarkReport | null
  piStudies?: PIStudyEntry[]
}) {
  const queueVisible =
    model.roleExperience === 'coordinator' ||
    model.roleExperience === 'owner' ||
    model.roleExperience === 'site_director'
  const canInteract = queueVisible

  return (
    <div className="space-y-6 p-6">
      <header className="max-w-4xl">
        <p className="text-xs font-semibold uppercase tracking-wide text-teal-700">Patient Acquisition</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">
          Recruitment Command Center
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          Read-only recruitment workspace for today&apos;s attention, operational lead queue, and study pressure.
        </p>
      </header>

      {result || reason ? (
        <div className={`rounded-md border px-4 py-3 text-sm ${result === 'error' ? 'border-red-200 bg-red-50 text-red-800' : 'border-teal-200 bg-teal-50 text-teal-800'}`}>
          <div className="font-medium">{result === 'error' ? 'Action needs attention' : 'Action complete'}</div>
          {reason ? <div className="mt-1 text-xs">{reason}</div> : null}
        </div>
      ) : null}

      <section className="grid gap-4 md:grid-cols-3">
        <SummaryCard label="Today&apos;s work" value={model.summary.todaysWorkCount} icon={ClipboardList} />
        <SummaryCard label="Visible queue" value={queueVisible ? model.summary.queueCount : model.summary.todaysWorkCount} icon={Users} />
        <SummaryCard label="Studies under pressure" value={model.summary.pressuredStudyCount} icon={Activity} />
      </section>

      <div className="grid gap-4 xl:grid-cols-[1fr_0.85fr]">
        <TodaysWorkPanel items={model.todaysWork} organizationId={organizationId} canInteract={canInteract} />
        <StudyPressureCards studies={model.studyPressure} />
      </div>

      {queueVisible ? (
        <RecruitmentQueue items={model.queue} organizationId={organizationId} canInteract={canInteract} />
      ) : model.roleExperience === 'pi' ? (
        <PIStudyEnrollmentPanel studies={piStudies ?? []} />
      ) : (
        <section className="rounded-md border border-slate-200 bg-white p-5">
          <h2 className="text-sm font-semibold text-slate-900">Recruitment queue</h2>
          <p className="mt-2 text-sm text-slate-600">
            This role receives a read-only summary view. Operational queue actions remain reserved for coordinators and owners.
          </p>
        </section>
      )}

      {/* Intelligence panels — added below existing sections */}

      {funnelSummary ? (
        <RecruitmentFunnelPanel funnel={funnelSummary} />
      ) : null}

      {model.roleExperience === 'coordinator' && coordinatorStats ? (
        <CoordinatorProductivityCard stats={coordinatorStats} />
      ) : null}

      {(model.roleExperience === 'owner' || model.roleExperience === 'site_director') &&
      studyForecasts &&
      funnelSummary ? (
        <PortfolioRecruitmentSummary
          forecasts={studyForecasts}
          funnelSummary={funnelSummary}
          benchmarkReport={benchmarkReport ?? null}
        />
      ) : null}

      {model.roleExperience === 'site_director' ? (
        <div className="mt-2">
          <a href="/performance/coordinators" className="text-sm text-teal-700 underline hover:text-teal-900">
            View coordinator workload →
          </a>
        </div>
      ) : null}

      {(model.roleExperience === 'owner' || model.roleExperience === 'site_director') ? (
        <div className="mt-2">
          <a href="/recruitment/campaigns" className="text-sm text-teal-700 underline hover:text-teal-900">
            Manage campaigns →
          </a>
        </div>
      ) : null}

      {(model.roleExperience === 'owner' || model.roleExperience === 'site_director') &&
      sourceEffectiveness ? (
        <SourceEffectivenessCard report={sourceEffectiveness} />
      ) : null}
    </div>
  )
}

function SummaryCard({
  label,
  value,
  icon: Icon,
}: {
  label: string
  value: number
  icon: React.ElementType
}) {
  return (
    <div className="rounded-md border border-slate-200 bg-white p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
        <Icon className="h-4 w-4 text-teal-700" />
      </div>
      <p className="mt-2 text-2xl font-semibold text-slate-900">{value}</p>
    </div>
  )
}
