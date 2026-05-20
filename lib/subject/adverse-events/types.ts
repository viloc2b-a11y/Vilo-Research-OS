export type AdverseEventLifecycleStatus = 'open' | 'follow_up' | 'resolved' | 'closed'

export type AdverseEventSourceKind =
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
  hasStructuredAeRegistry: false
  summary: AdverseEventTimelineSummary
  sections: AdverseEventTimelineSection[]
  totalCount: number
}
