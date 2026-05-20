import { SubjectAdverseEventsSummary } from '@/components/subject/adverse-events/SubjectAdverseEventsSummary'
import { SubjectAdverseEventsTimeline } from '@/components/subject/adverse-events/SubjectAdverseEventsTimeline'
import type { SubjectAdverseEventsTimelineModel } from '@/lib/subject/adverse-events/types'

type SubjectAdverseEventsSurfaceProps = {
  model: SubjectAdverseEventsTimelineModel
}

export function SubjectAdverseEventsSurface({ model }: SubjectAdverseEventsSurfaceProps) {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold" style={{ color: 'var(--foreground)' }}>
          Adverse events / Safety
        </h2>
        <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
          Longitudinal operational AE awareness from source capture, workflow, and site events.
          Not a formal AE case registry or pharmacovigilance workflow.
        </p>
      </div>

      <SubjectAdverseEventsSummary summary={model.summary} />
      <SubjectAdverseEventsTimeline sections={model.sections} />
    </div>
  )
}
