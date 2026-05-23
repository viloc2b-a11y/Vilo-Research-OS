'use client'

import { useActionState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { SubjectProtocolFields, type AnchorSubjectOption } from '@/components/subject/SubjectProtocolFields'
import {
  INITIAL_EXTERNAL_RANDOMIZATION_STATE,
  INITIAL_SUBJECT_GENERAL_STATE,
  recordExternalRandomizationAction,
  updateSubjectGeneralAction,
} from '@/lib/subject/subject-chart/actions'
import type { SubjectRoleKind } from '@/lib/subject/visits/types'

export type SubjectGeneralModel = {
  id: string
  organizationId: string
  subjectNumber: string
  randomizationNumber: string | null
  studyArm: string | null
  randomizationDateTime: string | null
  externalIwrsRtsmReference: string | null
  status: string
  subjectRole: SubjectRoleKind
  householdId: string | null
  anchorSubjectId: string | null
  firstName: string | null
  middleInitial: string | null
  lastName: string | null
  initials: string | null
  gender: string | null
  dateOfBirth: string | null
  updatedAt: string
}

const statuses = [
  ['screening', 'Screening'],
  ['enrolled', 'Enrolled'],
]

function datetimeLocalValue(value: string | null) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toISOString().slice(0, 16)
}

export function SubjectGeneralForm({
  subject,
  showUnblindedFields = false,
  anchorOptions = [],
  isReadOnly = false,
}: {
  subject: SubjectGeneralModel
  showUnblindedFields?: boolean
  anchorOptions?: AnchorSubjectOption[]
  isReadOnly?: boolean
}) {
  const [state, action, pending] = useActionState(
    updateSubjectGeneralAction,
    INITIAL_SUBJECT_GENERAL_STATE,
  )
  const [randomizationState, randomizationAction, randomizationPending] = useActionState(
    recordExternalRandomizationAction,
    INITIAL_EXTERNAL_RANDOMIZATION_STATE,
  )
  const randomizationRecorded = subject.status === 'randomized' || Boolean(subject.randomizationNumber)

  return (
    <div className="space-y-6">
    <form action={action} className="space-y-5">
      <fieldset disabled={isReadOnly} className="space-y-5">
        <input type="hidden" name="subject_id" value={subject.id} />
        <input type="hidden" name="organization_id" value={subject.organizationId} />
        <input type="hidden" name="expected_updated_at" value={subject.updatedAt} />

        <div className="grid gap-4 md:grid-cols-3">
          <div className="space-y-1">
            <Label htmlFor="subject_number">Subject number</Label>
            <Input id="subject_number" name="subject_number" defaultValue={subject.subjectNumber} />
          </div>
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
              {subject.status === 'randomized' ? (
                <option value="randomized">Randomized</option>
              ) : null}
              {statuses.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground">
              Randomized status is set by recording an external IWRS/RTSM confirmation below.
            </p>
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

        <SubjectProtocolFields
          subjectRole={subject.subjectRole}
          householdId={subject.householdId ?? ''}
          anchorSubjectId={subject.anchorSubjectId ?? ''}
          anchorOptions={anchorOptions}
        />

        {state.message ? (
          <p
            className={state.ok ? 'text-sm text-emerald-700' : 'text-sm text-destructive'}
            role="status"
          >
            {state.message}
          </p>
        ) : null}

        {!isReadOnly && (
          <Button type="submit" disabled={pending}>
            {pending ? 'Saving…' : 'Save general profile'}
          </Button>
        )}
      </fieldset>
    </form>

    {showUnblindedFields ? (
      <form action={randomizationAction} className="space-y-4 rounded-md border p-4">
        <fieldset disabled={isReadOnly || randomizationRecorded || randomizationPending} className="space-y-4">
          <input type="hidden" name="subject_id" value={subject.id} />
          <input type="hidden" name="organization_id" value={subject.organizationId} />
          <input type="hidden" name="expected_updated_at" value={subject.updatedAt} />
          <div>
            <p className="text-sm font-medium">Record External Randomization</p>
            <p className="text-xs text-muted-foreground">
              Randomization is performed in the external IWRS/RTSM. Vilo OS records the confirmation only.
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="external_randomization_number">Randomization number</Label>
              <Input
                id="external_randomization_number"
                name="randomization_number"
                defaultValue={subject.randomizationNumber ?? ''}
                required
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="randomization_date_time">Randomization date/time</Label>
              <Input
                id="randomization_date_time"
                name="randomization_date_time"
                type="datetime-local"
                defaultValue={datetimeLocalValue(subject.randomizationDateTime)}
                required
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="external_iwrs_rtsm_reference">External IWRS/RTSM reference</Label>
              <Input
                id="external_iwrs_rtsm_reference"
                name="external_iwrs_rtsm_reference"
                defaultValue={subject.externalIwrsRtsmReference ?? ''}
                required
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="randomization_arm">Treatment arm, if externally provided</Label>
              <Input
                id="randomization_arm"
                name="randomization_arm"
                defaultValue={subject.studyArm ?? ''}
              />
            </div>
          </div>
          {randomizationState.message ? (
            <p
              className={randomizationState.ok ? 'text-sm text-emerald-700' : 'text-sm text-destructive'}
              role="status"
            >
              {randomizationState.message}
            </p>
          ) : null}

          {!isReadOnly && (
            <Button type="submit">
              {randomizationRecorded
                ? 'External randomization recorded'
                : randomizationPending
                  ? 'Recording…'
                  : 'Record external randomization'}
            </Button>
          )}
        </fieldset>
      </form>
    ) : null}
    </div>
  )
}
