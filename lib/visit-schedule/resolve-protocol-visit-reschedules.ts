export type ProtocolVisitReschedulePayload = {
  calendar_event_type?: unknown
  scheduled_visit_id?: unknown
  visit_id?: unknown
  study_id?: unknown
  subject_id?: unknown
  visit_definition_id?: unknown
  original_target_date?: unknown
  rescheduled_date?: unknown
  rescheduled_time?: unknown
  assigned_user_id?: unknown
  reason?: unknown
  notes?: unknown
  cancelled_at?: unknown
  cancel_reason?: unknown
}

export type ProtocolVisitRescheduleRow = {
  id: string
  organization_id?: string | null
  event_type: string
  payload: ProtocolVisitReschedulePayload | null
  occurred_at: string
}

export type ResolvedProtocolVisitReschedule = {
  scheduledVisitId: string
  visitId: string | null
  studyId: string | null
  subjectId: string | null
  visitDefinitionId: string | null
  originalTargetDate: string
  rescheduledDate: string
  rescheduledTime: string | null
  assignedUserId: string | null
  reason: string | null
  notes: string | null
}

function isRescheduleCreation(row: ProtocolVisitRescheduleRow): boolean {
  return row.event_type === 'protocol_visit_rescheduled'
    && row.payload?.calendar_event_type === 'protocol_visit_reschedule'
    && typeof row.payload.scheduled_visit_id === 'string'
}

function rescheduleLookupKey(payload: ProtocolVisitReschedulePayload): string | null {
  if (typeof payload.scheduled_visit_id === 'string' && payload.scheduled_visit_id) {
    return payload.scheduled_visit_id
  }
  if (typeof payload.visit_id === 'string' && payload.visit_id) {
    return `visit:${payload.visit_id}`
  }
  return null
}

export function resolveProtocolVisitReschedules(
  rows: ProtocolVisitRescheduleRow[],
): Map<string, ResolvedProtocolVisitReschedule> {
  const resolved = new Map<string, ResolvedProtocolVisitReschedule>()
  const visitIdToKey = new Map<string, string>()

  for (const row of rows) {
    const payload = row.payload ?? {}

    if (isRescheduleCreation(row)) {
      const key = rescheduleLookupKey(payload)
      if (!key) continue
      const entry: ResolvedProtocolVisitReschedule = {
        scheduledVisitId: payload.scheduled_visit_id as string,
        visitId: typeof payload.visit_id === 'string' ? payload.visit_id : null,
        studyId: typeof payload.study_id === 'string' ? payload.study_id : null,
        subjectId: typeof payload.subject_id === 'string' ? payload.subject_id : null,
        visitDefinitionId: typeof payload.visit_definition_id === 'string' ? payload.visit_definition_id : null,
        originalTargetDate: typeof payload.original_target_date === 'string' ? payload.original_target_date : '',
        rescheduledDate: typeof payload.rescheduled_date === 'string' ? payload.rescheduled_date : '',
        rescheduledTime: typeof payload.rescheduled_time === 'string' ? payload.rescheduled_time : null,
        assignedUserId: typeof payload.assigned_user_id === 'string' ? payload.assigned_user_id : null,
        reason: typeof payload.reason === 'string' ? payload.reason : null,
        notes: typeof payload.notes === 'string' ? payload.notes : null,
      }
      resolved.set(key, entry)
      if (entry.visitId) visitIdToKey.set(entry.visitId, key)
      continue
    }

    if (row.event_type === 'protocol_visit_reschedule_cancelled') {
      let key = rescheduleLookupKey(payload)
      if (!key && typeof payload.visit_id === 'string') {
        key = visitIdToKey.get(payload.visit_id) ?? null
      }
      if (key) resolved.delete(key)
    }
  }

  return resolved
}

export function getRescheduleForScheduledVisit(
  map: Map<string, ResolvedProtocolVisitReschedule>,
  scheduledVisitId: string,
  visitId: string | null,
): ResolvedProtocolVisitReschedule | null {
  const direct = map.get(scheduledVisitId)
  if (direct) return direct
  if (visitId) {
    const byVisit = map.get(`visit:${visitId}`)
    if (byVisit) return byVisit
  }
  return null
}
