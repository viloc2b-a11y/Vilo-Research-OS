import { OPERATIONAL_EVENT_TYPES } from '@/lib/operations/event-types'
import { PROJECTION_KINDS } from '@/lib/projections/constants'

export type ProjectionKind =
  | typeof PROJECTION_KINDS.VISIT_READINESS
  | typeof PROJECTION_KINDS.SUBJECT_RUNTIME
  | typeof PROJECTION_KINDS.STUDY_EXECUTION

export type EventProjectionRule = {
  eventTypes: string[]
  refreshVisit: boolean
  refreshSubject: boolean
  refreshStudy: boolean
  notes?: string
}

/**
 * Maps operational event types to projection refresh scope.
 * Used for targeted/cascade refresh — does not replay events into projections.
 */
export const EVENT_PROJECTION_RULES: EventProjectionRule[] = [
  {
    eventTypes: [
      OPERATIONAL_EVENT_TYPES.VISIT_CHECKED_IN,
      OPERATIONAL_EVENT_TYPES.VISIT_RESCHEDULED,
      OPERATIONAL_EVENT_TYPES.VISIT_COMPLETED,
      OPERATIONAL_EVENT_TYPES.VISIT_LOCKED,
      OPERATIONAL_EVENT_TYPES.COORDINATOR_SIGNED,
      OPERATIONAL_EVENT_TYPES.INVESTIGATOR_SIGNED,
      OPERATIONAL_EVENT_TYPES.CLOSEOUT_REOPENED,
      OPERATIONAL_EVENT_TYPES.NOTE_ADDED,
    ],
    refreshVisit: true,
    refreshSubject: true,
    refreshStudy: true,
    notes: 'Visit lifecycle and closeout',
  },
  {
    eventTypes: [
      OPERATIONAL_EVENT_TYPES.PROCEDURE_COMPLETED,
      OPERATIONAL_EVENT_TYPES.PROCEDURE_SIGNED,
      OPERATIONAL_EVENT_TYPES.PROCEDURE_REOPENED,
      OPERATIONAL_EVENT_TYPES.VALIDATION_EXECUTED,
      OPERATIONAL_EVENT_TYPES.CONDITIONAL_PROCEDURE_INSTANTIATED,
      OPERATIONAL_EVENT_TYPES.FIELD_LOCKED,
      OPERATIONAL_EVENT_TYPES.FIELD_UNLOCKED,
      OPERATIONAL_EVENT_TYPES.SECTION_DISABLED,
      OPERATIONAL_EVENT_TYPES.SECTION_ENABLED,
    ],
    refreshVisit: true,
    refreshSubject: true,
    refreshStudy: true,
    notes: 'Procedure execution',
  },
  {
    eventTypes: [
      OPERATIONAL_EVENT_TYPES.SOURCE_RESPONSE_SET_SUBMITTED,
      OPERATIONAL_EVENT_TYPES.SOURCE_RESPONSE_CORRECTED,
      OPERATIONAL_EVENT_TYPES.SOURCE_RESPONSE_ADDENDUM_ADDED,
      OPERATIONAL_EVENT_TYPES.SOURCE_VALIDATION_FINDING_CREATED,
      OPERATIONAL_EVENT_TYPES.SOURCE_VALIDATION_FINDING_ACKNOWLEDGED,
      OPERATIONAL_EVENT_TYPES.SOURCE_VALIDATION_FINDING_RESOLVED,
      OPERATIONAL_EVENT_TYPES.SOURCE_VALIDATION_FINDING_WAIVED,
    ],
    refreshVisit: true,
    refreshSubject: true,
    refreshStudy: true,
    notes: 'Source capture and findings',
  },
  {
    eventTypes: [
      OPERATIONAL_EVENT_TYPES.QUERY_CREATED,
      OPERATIONAL_EVENT_TYPES.QUERY_RESOLVED,
      OPERATIONAL_EVENT_TYPES.SIGNATURE_REQUESTED,
      OPERATIONAL_EVENT_TYPES.FOLLOW_UP_CREATED,
    ],
    refreshVisit: true,
    refreshSubject: true,
    refreshStudy: true,
    notes: 'Workflow actions',
  },
  {
    eventTypes: [
      OPERATIONAL_EVENT_TYPES.ADVERSE_EVENT_CREATED,
      OPERATIONAL_EVENT_TYPES.ADVERSE_EVENT_UPDATED,
    ],
    refreshVisit: false,
    refreshSubject: true,
    refreshStudy: true,
    notes: 'Subject safety (visit refresh when visit_id on event)',
  },
  {
    eventTypes: [
      OPERATIONAL_EVENT_TYPES.SCHEDULE_MATERIALIZED,
      OPERATIONAL_EVENT_TYPES.SUBJECT_COMPLETED,
      OPERATIONAL_EVENT_TYPES.SUBJECT_WITHDRAWN,
      OPERATIONAL_EVENT_TYPES.SUBJECT_SCREEN_FAILED,
      OPERATIONAL_EVENT_TYPES.SUBJECT_LOST_TO_FOLLOW_UP,
      OPERATIONAL_EVENT_TYPES.EXTERNAL_RANDOMIZATION_RECORDED,
    ],
    refreshVisit: true,
    refreshSubject: true,
    refreshStudy: true,
    notes: 'Subject lifecycle and schedule',
  },
  {
    eventTypes: [OPERATIONAL_EVENT_TYPES.SOURCE_PACKAGE_PUBLISHED],
    refreshVisit: false,
    refreshSubject: false,
    refreshStudy: true,
    notes: 'Protocol publication affects study bindings',
  },
]

const eventTypeIndex = new Map<string, EventProjectionRule>()
for (const rule of EVENT_PROJECTION_RULES) {
  for (const type of rule.eventTypes) {
    eventTypeIndex.set(type, rule)
  }
}

export function projectionScopesForEventType(eventType: string): {
  refreshVisit: boolean
  refreshSubject: boolean
  refreshStudy: boolean
} {
  const rule = eventTypeIndex.get(eventType)
  if (!rule) {
    return { refreshVisit: false, refreshSubject: false, refreshStudy: false }
  }
  return {
    refreshVisit: rule.refreshVisit,
    refreshSubject: rule.refreshSubject,
    refreshStudy: rule.refreshStudy,
  }
}

export function projectionKindsForEventType(eventType: string): ProjectionKind[] {
  const scopes = projectionScopesForEventType(eventType)
  const kinds: ProjectionKind[] = []
  if (scopes.refreshVisit) kinds.push(PROJECTION_KINDS.VISIT_READINESS)
  if (scopes.refreshSubject) kinds.push(PROJECTION_KINDS.SUBJECT_RUNTIME)
  if (scopes.refreshStudy) kinds.push(PROJECTION_KINDS.STUDY_EXECUTION)
  return kinds
}
