'use client'

import { useActionState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import type { SubjectCloseoutReadiness } from '@/lib/subject/closeout/types'
import {
  completeSubjectAction,
  withdrawSubjectAction,
  screenFailSubjectAction,
  lostToFollowUpSubjectAction,
} from '@/lib/subject/subject-chart/actions'
import { INITIAL_SUBJECT_GENERAL_STATE } from '@/lib/subject/subject-chart/action-state'

function datetimeLocalValue(date?: Date) {
  const d = date || new Date()
  return d.toISOString().slice(0, 10) // Just date YYYY-MM-DD
}

export function SubjectCloseoutForms({
  subjectId,
  organizationId,
  currentStatus,
  subjectUpdatedAt,
  readiness,
}: {
  subjectId: string
  organizationId: string
  currentStatus: string
  subjectUpdatedAt: string
  readiness: SubjectCloseoutReadiness | null
}) {
  const canComplete = readiness?.canMarkCompleted ?? false
  const canTerminate = readiness?.canTerminateWithReason ?? false
  const isTerminal = ['completed', 'withdrawn', 'screen_failed', 'lost_to_follow_up'].includes(currentStatus)

  const [completeState, completeAction, completePending] = useActionState(completeSubjectAction, INITIAL_SUBJECT_GENERAL_STATE)
  const [withdrawState, withdrawAction, withdrawPending] = useActionState(withdrawSubjectAction, INITIAL_SUBJECT_GENERAL_STATE)
  const [sfState, sfAction, sfPending] = useActionState(screenFailSubjectAction, INITIAL_SUBJECT_GENERAL_STATE)
  const [ltfuState, ltfuAction, ltfuPending] = useActionState(lostToFollowUpSubjectAction, INITIAL_SUBJECT_GENERAL_STATE)

  if (isTerminal) {
    return (
      <Card className="border-emerald-700/20 bg-emerald-50/50 dark:bg-emerald-950/20">
        <CardHeader>
          <CardTitle className="text-lg">Subject Closed</CardTitle>
          <CardDescription>
            This subject is in a terminal state ({currentStatus.replace(/_/g, ' ')}). Closeout actions cannot be performed.
          </CardDescription>
        </CardHeader>
      </Card>
    )
  }

  const isScreening = currentStatus === 'screening'

  return (
    <div className="space-y-6">
      {/* Completed */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Mark Subject Completed</CardTitle>
          <CardDescription>
            Requires all visits and procedures to be completed and signed.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={completeAction} className="space-y-4">
            <input type="hidden" name="subject_id" value={subjectId} />
            <input type="hidden" name="organization_id" value={organizationId} />
            <input type="hidden" name="subject_updated_at" value={subjectUpdatedAt} />
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="complete_date">Completion Date</Label>
                <Input
                  id="complete_date"
                  name="date"
                  type="date"
                  defaultValue={datetimeLocalValue()}
                  required
                />
              </div>
            </div>
            {completeState.message ? (
              <p className={completeState.ok ? 'text-sm text-emerald-700' : 'text-sm text-destructive'} role="status">
                {completeState.message}
              </p>
            ) : null}
            <Button type="submit" disabled={completePending || !canComplete} variant="default">
              {completePending ? 'Processing...' : 'Mark Completed'}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Screen Failed */}
      {isScreening && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Screen Fail</CardTitle>
            <CardDescription>
              Record a screen fail during the screening process.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form action={sfAction} className="space-y-4">
              <input type="hidden" name="subject_id" value={subjectId} />
              <input type="hidden" name="organization_id" value={organizationId} />
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-1">
                  <Label htmlFor="sf_date">Screen Fail Date</Label>
                  <Input
                    id="sf_date"
                    name="date"
                    type="date"
                    defaultValue={datetimeLocalValue()}
                    required
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="sf_reason">Reason (min 10 chars)</Label>
                  <Input
                    id="sf_reason"
                    name="reason"
                    minLength={10}
                    placeholder="Subject did not meet inclusion criteria..."
                    required
                  />
                </div>
              </div>
              {sfState.message ? (
                <p className={sfState.ok ? 'text-sm text-emerald-700' : 'text-sm text-destructive'} role="status">
                  {sfState.message}
                </p>
              ) : null}
              <Button type="submit" disabled={sfPending} variant="destructive">
                {sfPending ? 'Processing...' : 'Screen Fail Subject'}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Withdrawn */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Withdraw Subject</CardTitle>
          <CardDescription>
            Record an early withdrawal (e.g. subject withdrew consent).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={withdrawAction} className="space-y-4">
            <input type="hidden" name="subject_id" value={subjectId} />
            <input type="hidden" name="organization_id" value={organizationId} />
            <input type="hidden" name="subject_updated_at" value={subjectUpdatedAt} />
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="wd_date">Withdrawal Date</Label>
                <Input
                  id="wd_date"
                  name="date"
                  type="date"
                  defaultValue={datetimeLocalValue()}
                  required
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="wd_reason">Reason (min 10 chars)</Label>
                <Input
                  id="wd_reason"
                  name="reason"
                  minLength={10}
                  placeholder="Subject withdrew consent..."
                  required
                />
              </div>
            </div>
            {withdrawState.message ? (
              <p className={withdrawState.ok ? 'text-sm text-emerald-700' : 'text-sm text-destructive'} role="status">
                {withdrawState.message}
              </p>
            ) : null}
            <Button type="submit" disabled={withdrawPending || !canTerminate} variant="destructive">
              {withdrawPending ? 'Processing...' : 'Withdraw Subject'}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Lost to Follow Up */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Lost to Follow-Up</CardTitle>
          <CardDescription>
            Subject is unreachable. Document contact attempts.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={ltfuAction} className="space-y-4">
            <input type="hidden" name="subject_id" value={subjectId} />
            <input type="hidden" name="organization_id" value={organizationId} />
            <input type="hidden" name="subject_updated_at" value={subjectUpdatedAt} />
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="ltfu_date">Date Declared LTFU</Label>
                <Input
                  id="ltfu_date"
                  name="date"
                  type="date"
                  defaultValue={datetimeLocalValue()}
                  required
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="ltfu_reason">Summary / Attempts (min 10 chars)</Label>
                <Input
                  id="ltfu_reason"
                  name="reason"
                  minLength={10}
                  placeholder="Called 3 times, certified letter sent..."
                  required
                />
              </div>
            </div>
            {ltfuState.message ? (
              <p className={ltfuState.ok ? 'text-sm text-emerald-700' : 'text-sm text-destructive'} role="status">
                {ltfuState.message}
              </p>
            ) : null}
            <Button type="submit" disabled={ltfuPending || !canTerminate} variant="destructive">
              {ltfuPending ? 'Processing...' : 'Mark Lost to Follow-Up'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
