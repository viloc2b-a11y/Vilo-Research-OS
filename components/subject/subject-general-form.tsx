'use client'

import { useActionState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  INITIAL_SUBJECT_GENERAL_STATE,
  updateSubjectGeneralAction,
} from '@/lib/subject/subject-chart/actions'

export type SubjectGeneralModel = {
  id: string
  organizationId: string
  subjectNumber: string
  randomizationNumber: string | null
  studyArm: string | null
  status: string
  firstName: string | null
  middleInitial: string | null
  lastName: string | null
  initials: string | null
  gender: string | null
  dateOfBirth: string | null
}

const statuses = [
  ['screening', 'Screening'],
  ['screen_failed', 'Screen failed'],
  ['enrolled', 'Enrolled'],
  ['randomized', 'Randomized'],
  ['completed', 'Completed'],
  ['withdrawn', 'Withdrawn'],
]

export function SubjectGeneralForm({
  subject,
  showUnblindedFields = false,
}: {
  subject: SubjectGeneralModel
  showUnblindedFields?: boolean
}) {
  const [state, action, pending] = useActionState(
    updateSubjectGeneralAction,
    INITIAL_SUBJECT_GENERAL_STATE,
  )

  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="subject_id" value={subject.id} />
      <input type="hidden" name="organization_id" value={subject.organizationId} />

      <div className="grid gap-4 md:grid-cols-3">
        <div className="space-y-1">
          <Label htmlFor="subject_number">Subject number</Label>
          <Input id="subject_number" name="subject_number" defaultValue={subject.subjectNumber} />
        </div>
        {showUnblindedFields ? (
          <div className="space-y-1">
            <Label htmlFor="randomization_number">Randomization number</Label>
            <Input
              id="randomization_number"
              name="randomization_number"
              defaultValue={subject.randomizationNumber ?? ''}
            />
          </div>
        ) : null}
        {showUnblindedFields ? (
          <div className="space-y-1">
            <Label htmlFor="study_arm">Study arm</Label>
            <Input id="study_arm" name="study_arm" defaultValue={subject.studyArm ?? ''} />
          </div>
        ) : null}
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <div className="space-y-1">
          <Label htmlFor="status">Status</Label>
          <select
            id="status"
            name="status"
            defaultValue={subject.status}
            className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
          >
            {statuses.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="first_name">First name</Label>
          <Input id="first_name" name="first_name" defaultValue={subject.firstName ?? ''} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="middle_initial">Middle initial</Label>
          <Input
            id="middle_initial"
            name="middle_initial"
            maxLength={4}
            defaultValue={subject.middleInitial ?? ''}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="last_name">Last name</Label>
          <Input id="last_name" name="last_name" defaultValue={subject.lastName ?? ''} />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="space-y-1">
          <Label htmlFor="initials">Initials</Label>
          <Input id="initials" name="initials" defaultValue={subject.initials ?? ''} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="gender">Gender</Label>
          <Input id="gender" name="gender" defaultValue={subject.gender ?? ''} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="date_of_birth">Date of birth</Label>
          <Input
            id="date_of_birth"
            name="date_of_birth"
            type="date"
            defaultValue={subject.dateOfBirth ?? ''}
          />
        </div>
      </div>

      {state.message ? (
        <p
          className={state.ok ? 'text-sm text-emerald-700' : 'text-sm text-destructive'}
          role="status"
        >
          {state.message}
        </p>
      ) : null}

      <Button type="submit" disabled={pending}>
        {pending ? 'Saving…' : 'Save general profile'}
      </Button>
    </form>
  )
}
