import { ClipboardList, Users, Activity } from 'lucide-react'
import { TodaysWorkPanel } from '@/app/(ops)/recruitment/_components/TodaysWorkPanel'
import { RecruitmentQueue } from '@/app/(ops)/recruitment/_components/RecruitmentQueue'
import { StudyPressureCards } from '@/app/(ops)/recruitment/_components/StudyPressureCards'
import type { RecruitmentViewModel } from '@/app/(ops)/recruitment/_lib/recruitment-view-model'

export function RecruitmentCommandCenterShell({
  model,
  organizationId,
  result,
  reason,
}: {
  model: RecruitmentViewModel
  organizationId: string
  result?: string
  reason?: string
}) {
  const queueVisible = model.roleExperience === 'coordinator' || model.roleExperience === 'owner'
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
      ) : (
        <section className="rounded-md border border-slate-200 bg-white p-5">
          <h2 className="text-sm font-semibold text-slate-900">Recruitment queue</h2>
          <p className="mt-2 text-sm text-slate-600">
            This role receives a read-only summary view. Operational queue actions remain reserved for coordinators and owners.
          </p>
        </section>
      )}
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
