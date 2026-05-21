import { getOrganizationMemberships, getSessionUser } from '@/lib/auth/session'
import type { OrganizationMembership } from '@/lib/auth/session'
import { loadSubjectAdverseEventsRegistry } from '@/lib/subject/adverse-events/load-subject-adverse-events-registry'
import { loadSourceAeCaptures } from '@/lib/subject/adverse-events/load-source-ae-captures'
import { mapSafetySignalToTimelineItem } from '@/lib/subject/adverse-events/map-safety-signal'
import {
  groupAdverseEventTimeline,
  summarizeAdverseEventTimeline,
} from '@/lib/subject/adverse-events/group-timeline'
import type { SubjectAdverseEventsTimelineModel } from '@/lib/subject/adverse-events/types'
import { loadSubjectSafetySignals } from '@/lib/subject/safety-signals/load-subject-safety-signals'

function dedupeTimeline(
  items: ReturnType<typeof mapSafetySignalToTimelineItem>[],
): ReturnType<typeof mapSafetySignalToTimelineItem>[] {
  const seen = new Set<string>()
  const out: ReturnType<typeof mapSafetySignalToTimelineItem>[] = []
  for (const item of items) {
    if (seen.has(item.id)) continue
    seen.add(item.id)
    out.push(item)
  }
  return out
}

export async function loadSubjectAdverseEventsTimeline(input: {
  subjectId: string
  studyId: string
  organizationId: string
  memberships?: OrganizationMembership[]
}): Promise<SubjectAdverseEventsTimelineModel> {
  const user = await getSessionUser()
  const memberships =
    input.memberships ??
    (user ? await getOrganizationMemberships(user.id) : [])

  const [safetyModel, sourceCaptures, registry] = await Promise.all([
    loadSubjectSafetySignals({
      subjectId: input.subjectId,
      studyId: input.studyId,
      organizationId: input.organizationId,
    }),
    loadSourceAeCaptures({
      subjectId: input.subjectId,
      studyId: input.studyId,
      organizationId: input.organizationId,
      memberships,
    }),
    loadSubjectAdverseEventsRegistry({
      subjectId: input.subjectId,
      organizationId: input.organizationId,
    }),
  ])

  const signalItems = safetyModel.items.map(mapSafetySignalToTimelineItem)

  const merged = dedupeTimeline([
    ...registry.timelineItems,
    ...sourceCaptures,
    ...signalItems.filter((item) => item.sourceKind !== 'source_capture'),
  ])

  const summary = summarizeAdverseEventTimeline(merged)
  const sections = groupAdverseEventTimeline(merged)

  return {
    hasStructuredAeRegistry: true,
    summary,
    sections,
    totalCount: merged.length,
    visitOptions: registry.visitOptions,
  }
}
