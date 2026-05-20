import { SubjectSafetySignalsSummary } from '@/components/subject/safety-signals/SubjectSafetySignalsSummary'
import { SubjectSafetyTimeline } from '@/components/subject/safety-signals/SubjectSafetyTimeline'
import type { SubjectSafetySignalsModel } from '@/lib/subject/safety-signals/types'

type SubjectSafetySurfaceProps = {
  model: SubjectSafetySignalsModel
}

export function SubjectSafetySurface({ model }: SubjectSafetySurfaceProps) {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold" style={{ color: 'var(--foreground)' }}>
          AE / Safety
        </h2>
        <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
          Safety / AE signals — longitudinal view of source-backed operational items. No structured
          AE case registry is available in this release.
        </p>
      </div>

      <SubjectSafetySignalsSummary summary={model.summary} />
      <SubjectSafetyTimeline
        items={model.items}
        hiddenCount={model.hiddenCount}
        moreHref={model.moreHref}
      />
    </div>
  )
}
