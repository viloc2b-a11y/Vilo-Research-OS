import type { StudyPressureView } from '@/app/(ops)/recruitment/_lib/recruitment-view-model'

const PRESSURE_CLASS: Record<StudyPressureView['pressure_state'], string> = {
  low: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  moderate: 'border-amber-200 bg-amber-50 text-amber-700',
  high: 'border-red-200 bg-red-50 text-red-700',
}

export function StudyPressureCards({ studies }: { studies: StudyPressureView[] }) {
  return (
    <section className="rounded-md border border-slate-200 bg-white p-5">
      <div>
        <h2 className="text-sm font-semibold text-slate-900">Study Pressure</h2>
        <p className="mt-1 text-sm text-slate-600">
          Recruiting studies with open leads, qualified leads, screenings, and conversions.
        </p>
      </div>

      <div className="mt-4 space-y-3">
        {studies.map((study) => (
          <article key={study.study_id} className="rounded-md border border-slate-200 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">{study.study_name || 'Untitled study'}</h3>
                <p className="mt-1 text-xs text-slate-500">
                  Target leads: {study.target_leads ?? 'Not set'}
                </p>
              </div>
              <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold capitalize ${PRESSURE_CLASS[study.pressure_state]}`}>
                {study.pressure_state}
              </span>
            </div>

            <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <Metric label="Open leads" value={study.open_leads} />
              <Metric label="Qualified" value={study.qualified_count} />
              <Metric label="Screenings" value={study.scheduled_count} />
              <Metric label="Converted" value={study.randomized_count} />
            </dl>
          </article>
        ))}
        {studies.length === 0 ? (
          <div className="rounded-md border border-dashed border-slate-300 p-6 text-sm text-slate-500">
            No active recruiting studies are available.
          </div>
        ) : null}
      </div>
    </section>
  )
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md bg-slate-50 p-3">
      <dt className="text-xs font-medium text-slate-500">{label}</dt>
      <dd className="mt-1 text-lg font-semibold text-slate-900">{value}</dd>
    </div>
  )
}
