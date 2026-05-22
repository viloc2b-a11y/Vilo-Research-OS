import type { SubjectAdverseEventVisitOption } from '@/lib/subject/adverse-events/registry-types'

export type AdverseEventLifecycleStatus = 'open' | 'follow_up' | 'resolved' | 'closed'

export type AdverseEventSourceKind =
  | 'subject_registry'
  | 'source_capture'
  | 'validation_finding'
  | 'workflow_action'
  | 'operational_event'
  | 'allergy_record'
  | 'procedure_validation'

export type SubjectAdverseEventTimelineItem = {
  id: string
  sourceKind: AdverseEventSourceKind
  eventTerm: string
  preferredTerm: string | null
  severity: string | null
  seriousness: boolean
  relationship: string | null
  relationshipCode: string | null
  lifecycleStatus: AdverseEventLifecycleStatus
  onsetDate: string | null
  resolutionDate: string | null
  visitId: string | null
  visitLabel: string | null
  sourceAttribution: string
  lastUpdatedAt: string
  reporter: string | null
  isSeriousAdverseEvent: boolean
  href: string | null
  captureHref: string | null
  reviewHref: string | null
  /** Set when this row is editable in the subject AE registry. */
  registryId: string | null
  isEditable: boolean
  /** Registry-only notes (shown in edit form). */
  registryComments: string | null
}

export type AdverseEventTimelineSummary = {
  openAe: number
  sae: number
  followUpPending: number
  recentlyUpdated: number
  resolved: number
}

export type AdverseEventTimelineSection = {
  key: 'active' | 'follow_up' | 'resolved'
  title: string
  description: string
  items: SubjectAdverseEventTimelineItem[]
}

export type SubjectAdverseEventsTimelineModel = {
  hasStructuredAeRegistry: boolean
  summary: AdverseEventTimelineSummary
  sections: AdverseEventTimelineSection[]
  totalCount: number
  visitOptions: SubjectAdverseEventVisitOption[]
}
