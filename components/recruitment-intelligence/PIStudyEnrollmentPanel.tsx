import Link from 'next/link'
import { ForecastRiskBadge } from '@/components/recruitment-intelligence/ForecastRiskBadge'

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

type PIStudyEnrollmentPanelProps = {
  studies: PIStudyEntry[]
}

export function PIStudyEnrollmentPanel({ studies }: PIStudyEnrollmentPanelProps) {
  return (
    <section className="rounded-md border border-slate-200 bg-white p-5">
      <h2 className="text-sm font-semibold text-slate-900">Study Enrollment Overview</h2>

      {studies.length === 0 ? (
        <div className="mt-4 rounded-md border border-dashed border-slate-300 p-6 text-sm text-slate-500">
          No active study recruitment data
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          {studies.map((study) => (
            <div
              key={study.studyId}
              className="rounded-md border border-slate-100 bg-slate-50 px-4 py-3"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Link
                  href={study.workspaceHref}
                  className="text-sm font-medium text-teal-700 underline hover:text-teal-900"
                >
                  {study.studyName}
                </Link>
                <ForecastRiskBadge risk={study.forecastRisk ?? null} />
              </div>

              <div className="mt-2 flex flex-wrap gap-4 text-xs text-slate-600">
                <span>
                  {study.enrollmentTarget === 0
                    ? `${study.randomizedCount} enrolled`
                    : `${study.randomizedCount} / ${study.enrollmentTarget} enrolled`}
                </span>
                <span>{study.qualifiedCount} qualified</span>
                <span>{study.scheduledCount} scheduled</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
