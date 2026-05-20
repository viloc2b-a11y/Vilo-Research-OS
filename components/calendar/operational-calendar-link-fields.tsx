'use client'

import { useMemo, useState } from 'react'
import {
  formatStudyOptionLabel,
  formatSubjectOptionLabel,
  formatVisitOptionLabel,
  type OperationalCalendarCoordinatorOption,
  type OperationalCalendarStudyOption,
  type OperationalCalendarSubjectOption,
  type OperationalCalendarVisitOption,
} from '@/lib/calendar/operational-calendar-selector-options'

export type CalendarLinkFieldValues = {
  studyId: string
  subjectId: string
  visitId: string
  assignedUserId: string
}

type SelectorModel = {
  studies: OperationalCalendarStudyOption[]
  subjects: OperationalCalendarSubjectOption[]
  visits: OperationalCalendarVisitOption[]
  coordinators: OperationalCalendarCoordinatorOption[]
}

function emptyLinkValues(): CalendarLinkFieldValues {
  return { studyId: '', subjectId: '', visitId: '', assignedUserId: '' }
}

export function useCalendarLinkFields(
  model: SelectorModel,
  initial?: Partial<CalendarLinkFieldValues>,
) {
  const [studyId, setStudyId] = useState(initial?.studyId ?? '')
  const [subjectId, setSubjectId] = useState(initial?.subjectId ?? '')
  const [visitId, setVisitId] = useState(initial?.visitId ?? '')
  const [assignedUserId, setAssignedUserId] = useState(initial?.assignedUserId ?? '')

  const subjectById = useMemo(
    () => new Map(model.subjects.map((subject) => [subject.id, subject])),
    [model.subjects],
  )
  const visitById = useMemo(
    () => new Map(model.visits.map((visit) => [visit.id, visit])),
    [model.visits],
  )

  const filteredSubjects = useMemo(() => {
    if (!studyId) return model.subjects
    return model.subjects.filter((subject) => subject.studyId === studyId)
  }, [model.subjects, studyId])

  const filteredVisits = useMemo(() => {
    let list = model.visits
    if (studyId) list = list.filter((visit) => visit.studyId === studyId)
    if (subjectId) list = list.filter((visit) => visit.subjectId === subjectId)
    return list
  }, [model.visits, studyId, subjectId])

  function onStudyChange(nextStudyId: string) {
    setStudyId(nextStudyId)
    if (!nextStudyId) return
    if (subjectId) {
      const subject = subjectById.get(subjectId)
      if (subject && subject.studyId !== nextStudyId) {
        setSubjectId('')
        setVisitId('')
      }
    }
    if (visitId) {
      const visit = visitById.get(visitId)
      if (visit && visit.studyId !== nextStudyId) setVisitId('')
    }
  }

  function onSubjectChange(nextSubjectId: string) {
    setSubjectId(nextSubjectId)
    if (!nextSubjectId) return
    const subject = subjectById.get(nextSubjectId)
    if (subject) {
      if (!studyId) setStudyId(subject.studyId)
      if (visitId) {
        const visit = visitById.get(visitId)
        if (visit && visit.subjectId !== nextSubjectId) setVisitId('')
      }
    }
  }

  function onVisitChange(nextVisitId: string) {
    setVisitId(nextVisitId)
    if (!nextVisitId) return
    const visit = visitById.get(nextVisitId)
    if (visit) {
      setStudyId(visit.studyId)
      setSubjectId(visit.subjectId)
    }
  }

  return {
    studyId,
    subjectId,
    visitId,
    assignedUserId,
    setAssignedUserId,
    filteredSubjects,
    filteredVisits,
    onStudyChange,
    onSubjectChange,
    onVisitChange,
    subjectById,
  }
}

export function CalendarStudySelect({
  studies,
  value,
  onChange,
  required = false,
  allowEmpty = true,
  emptyLabel = 'No study link',
}: {
  studies: OperationalCalendarStudyOption[]
  value: string
  onChange: (value: string) => void
  required?: boolean
  allowEmpty?: boolean
  emptyLabel?: string
}) {
  return (
    <label className="grid gap-1 text-sm">
      <span className="font-medium">Study</span>
      <select
        name="study_id"
        className="h-9 rounded-md border bg-background px-2"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        required={required}
      >
        {allowEmpty ? <option value="">{emptyLabel}</option> : null}
        {studies.map((study) => (
          <option key={study.id} value={study.id}>
            {formatStudyOptionLabel(study)}
          </option>
        ))}
      </select>
    </label>
  )
}

export function CalendarSubjectSelect({
  subjects,
  value,
  onChange,
  studyId,
}: {
  subjects: OperationalCalendarSubjectOption[]
  value: string
  onChange: (value: string) => void
  studyId: string
}) {
  return (
    <label className="grid gap-1 text-sm">
      <span className="font-medium">Subject</span>
      <select
        name="subject_id"
        className="h-9 rounded-md border bg-background px-2"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="">No subject link</option>
        {subjects.map((subject) => (
          <option key={subject.id} value={subject.id}>
            {formatSubjectOptionLabel(subject)}
          </option>
        ))}
      </select>
      {studyId && subjects.length === 0 ? (
        <span className="text-xs text-muted-foreground">No subjects for this study.</span>
      ) : null}
    </label>
  )
}

export function CalendarVisitSelect({
  visits,
  subjects,
  value,
  onChange,
  studyId,
  subjectId,
}: {
  visits: OperationalCalendarVisitOption[]
  subjects: OperationalCalendarSubjectOption[]
  value: string
  onChange: (value: string) => void
  studyId: string
  subjectId: string
}) {
  const subjectById = useMemo(
    () => new Map(subjects.map((subject) => [subject.id, subject])),
    [subjects],
  )

  return (
    <label className="grid gap-1 text-sm">
      <span className="font-medium">Related visit</span>
      <select
        name="visit_id"
        className="h-9 rounded-md border bg-background px-2"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="">No visit link</option>
        {visits.map((visit) => {
          const subject = subjectById.get(visit.subjectId)
          return (
            <option key={visit.id} value={visit.id}>
              {formatVisitOptionLabel(visit, subject?.subjectCode)}
            </option>
          )
        })}
      </select>
      {(studyId || subjectId) && visits.length === 0 ? (
        <span className="text-xs text-muted-foreground">No visits match the current filters.</span>
      ) : null}
    </label>
  )
}

export function CalendarCoordinatorSelect({
  coordinators,
  value,
  onChange,
  name = 'assigned_user_id',
  label = 'Assigned coordinator',
  required = false,
  allowEmpty = true,
}: {
  coordinators: OperationalCalendarCoordinatorOption[]
  value: string
  onChange: (value: string) => void
  name?: string
  label?: string
  required?: boolean
  allowEmpty?: boolean
}) {
  return (
    <label className="grid gap-1 text-sm">
      <span className="font-medium">{label}</span>
      <select
        name={name}
        className="h-9 rounded-md border bg-background px-2"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        required={required}
      >
        {allowEmpty ? <option value="">Unassigned</option> : null}
        {coordinators.map((coordinator) => (
          <option key={coordinator.id} value={coordinator.id}>
            {coordinator.displayName} · {coordinator.role}
          </option>
        ))}
      </select>
    </label>
  )
}

export function CalendarBlockScopeFields({
  model,
  scope,
  onScopeChange,
  studyId,
  onStudyChange,
  affectedUserId,
  onAffectedUserChange,
  initialResourceName,
}: {
  model: SelectorModel
  scope: string
  onScopeChange: (scope: string) => void
  studyId: string
  onStudyChange: (value: string) => void
  affectedUserId: string
  onAffectedUserChange: (value: string) => void
  initialResourceName?: string
}) {
  const showUser = scope === 'user'
  const showStudy = scope === 'study'
  const showResource = scope === 'resource'

  return (
    <>
      <label className="grid gap-1 text-sm">
        <span className="font-medium">Scope</span>
        <select
          name="scope"
          className="h-9 rounded-md border bg-background px-2"
          value={scope}
          onChange={(event) => onScopeChange(event.target.value)}
          required
        >
          <option value="user">User</option>
          <option value="site">Site</option>
          <option value="study">Study</option>
          <option value="resource">Resource</option>
        </select>
      </label>

      {showUser ? (
        <CalendarCoordinatorSelect
          coordinators={model.coordinators}
          value={affectedUserId}
          onChange={onAffectedUserChange}
          name="affected_user_id"
          label="Affected coordinator"
          required
          allowEmpty={false}
        />
      ) : null}

      {showStudy ? (
        <CalendarStudySelect
          studies={model.studies}
          value={studyId}
          onChange={onStudyChange}
          required
          allowEmpty={false}
          emptyLabel="Select study"
        />
      ) : null}

      {showResource ? (
        <label className="grid gap-1 text-sm">
          <span className="font-medium">Resource name</span>
          <input
            name="resource_name"
            className="h-9 rounded-md border bg-background px-2"
            placeholder="Required for resource scope"
            defaultValue={initialResourceName ?? ''}
            required
          />
        </label>
      ) : null}
    </>
  )
}

export { emptyLinkValues }
