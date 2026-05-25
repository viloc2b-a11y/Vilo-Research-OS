import type { SupabaseClient } from '@supabase/supabase-js'
import type { OperationalCalendarEvent } from '@/lib/calendar/operational-calendar-read-model'
import { formatStudyDisplayLabel, getStudyDisplayBatch } from '@/lib/protocol-vault/study-display'
import { resolveOperationalDisplayMode } from '@/lib/protocol-vault/display-policy'

function one<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null
  return value ?? null
}

export async function enrichOperationalCalendarEvents(
  supabase: SupabaseClient,
  events: OperationalCalendarEvent[],
): Promise<OperationalCalendarEvent[]> {
  const studyIds = new Set<string>()
  const subjectIds = new Set<string>()
  const visitIds = new Set<string>()
  const userIds = new Set<string>()

  for (const event of events) {
    if (event.kind === 'manual_event' || event.kind === 'availability_block') {
      if (event.linkedStudyId || event.studyId) studyIds.add(event.linkedStudyId ?? event.studyId)
      if (event.linkedSubjectId) subjectIds.add(event.linkedSubjectId)
      const linkedVisit = event.linkedVisitId ?? (event.kind === 'manual_event' ? event.visitId : null)
      if (linkedVisit) visitIds.add(linkedVisit)
    }
    const userId = event.assignedUserId ?? event.affectedUserId
    if (userId) userIds.add(userId)
  }

  const operationalDisplayMode = resolveOperationalDisplayMode('coordinator_dashboard')

  const [studyDisplayById, subjects, visits, profiles] = await Promise.all([
    getStudyDisplayBatch(supabase, [...studyIds], operationalDisplayMode),
    subjectIds.size
      ? supabase
        .from('study_subjects')
        .select('id, subject_identifier')
        .in('id', [...subjectIds])
      : Promise.resolve({ data: [] }),
    visitIds.size
      ? supabase
        .from('visits')
        .select('id, visit_definitions(label, code)')
        .in('id', [...visitIds])
      : Promise.resolve({ data: [] }),
    userIds.size
      ? supabase.from('profiles').select('id, display_name').in('id', [...userIds])
      : Promise.resolve({ data: [] }),
  ])

  const studyLabelById = new Map<string, string>()
  for (const studyId of studyIds) {
    const display = studyDisplayById.get(studyId)
    if (!display) continue
    studyLabelById.set(studyId, formatStudyDisplayLabel(display))
  }

  const subjectLabelById = new Map<string, string>()
  for (const row of subjects.data ?? []) {
    subjectLabelById.set(row.id as string, row.subject_identifier as string)
  }

  const visitLabelById = new Map<string, string>()
  for (const row of visits.data ?? []) {
    const def = one(row.visit_definitions)
    visitLabelById.set(row.id as string, def?.label ?? def?.code ?? 'Visit')
  }

  const userLabelById = new Map<string, string>()
  for (const row of profiles.data ?? []) {
    const name = (row.display_name as string | null)?.trim()
    userLabelById.set(row.id as string, name || `User ${(row.id as string).slice(0, 8)}`)
  }

  return events.map((event) => {
    if (event.kind === 'protocol_visit') return event

    const studyKey = event.linkedStudyId ?? event.studyId
    const studyName = (studyKey && studyLabelById.get(studyKey))
      || event.studyName
    const subjectIdentifier = (event.linkedSubjectId && subjectLabelById.get(event.linkedSubjectId))
      || event.subjectIdentifier
    const linkedVisitId = event.linkedVisitId ?? (event.kind === 'manual_event' ? event.visitId : null)
    const linkedVisitLabel = (linkedVisitId && visitLabelById.get(linkedVisitId))
      ?? event.linkedVisitLabel
      ?? null
    const coordinatorId = event.assignedUserId ?? event.affectedUserId
    const coordinatorLabel = (coordinatorId && userLabelById.get(coordinatorId))
      || event.assignedCoordinator

    return {
      ...event,
      studyName,
      study_name: studyName,
      subjectIdentifier,
      subject_code: subjectIdentifier,
      subjectCode: subjectIdentifier,
      linkedVisitLabel,
      assignedCoordinator: coordinatorLabel,
    }
  })
}
