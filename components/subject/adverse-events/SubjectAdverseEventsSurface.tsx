import { SubjectAdverseEventsWorkspace } from '@/components/subject/adverse-events/SubjectAdverseEventsWorkspace'
import type { SubjectAdverseEventsTimelineModel } from '@/lib/subject/adverse-events/types'

type SubjectAdverseEventsSurfaceProps = {
  model: SubjectAdverseEventsTimelineModel
  studySubjectId: string
}

export function SubjectAdverseEventsSurface({
  model,
  studySubjectId,
}: SubjectAdverseEventsSurfaceProps) {
  return (
    <SubjectAdverseEventsWorkspace
      model={model}
      studySubjectId={studySubjectId}
      visitOptions={model.visitOptions}
    />
  )
}
