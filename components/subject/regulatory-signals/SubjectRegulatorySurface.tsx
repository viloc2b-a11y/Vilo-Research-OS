import { SubjectRegulatorySignalsSummary } from '@/components/subject/regulatory-signals/SubjectRegulatorySignalsSummary'
import { SubjectRegulatoryTimeline } from '@/components/subject/regulatory-signals/SubjectRegulatoryTimeline'
import type { SubjectRegulatorySignalsModel } from '@/lib/subject/regulatory-signals/types'

type SubjectRegulatorySurfaceProps = {
  model: SubjectRegulatorySignalsModel
}

export function SubjectRegulatorySurface({ model }: SubjectRegulatorySurfaceProps) {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold" style={{ color: '#10253e' }}>
          Regulatory / Deviation Signals
        </h2>
        <p className="text-sm" style={{ color: '#98a5ad' }}>
          Protocol execution and source-compliance risks derived from operational data. These are
          not final adjudicated protocol deviations unless a formal deviation record exists in the
          system.
        </p>
      </div>

      <SubjectRegulatorySignalsSummary summary={model.summary} />
      <SubjectRegulatoryTimeline
        items={model.items}
        hiddenCount={model.hiddenCount}
        moreHref={model.moreHref}
      />
    </div>
  )
}
