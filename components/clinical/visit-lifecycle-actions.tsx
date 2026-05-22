'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import type { VisitLifecycleResult } from '@/lib/actions/visit-lifecycle.types'
import { checkInVisit } from '@/lib/actions/check-in-visit'
import { completeVisit } from '@/lib/actions/complete-visit'
import { lockVisit } from '@/lib/actions/lock-visit'
import { Button } from '@/components/ui/button'

type VisitLifecycleActionsProps = {
  visitId: string
  visitPath: string
  studyPath: string
  subjectPath: string
  visitStatus: string
}

export function VisitLifecycleActions({
  visitId,
  visitPath,
  studyPath,
  subjectPath,
  visitStatus,
}: VisitLifecycleActionsProps) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [checkInFb, setCheckInFb] = useState<{ ok: boolean; text: string } | null>(null)
  const [completeFb, setCompleteFb] = useState<{ ok: boolean; text: string } | null>(null)
  const [lockFb, setLockFb] = useState<{ ok: boolean; text: string } | null>(null)

  // F-09 fix: check-in is the first action on a scheduled visit
  const canCheckIn = visitStatus === 'scheduled'
  const canTryCompleteVisit =
    visitStatus === 'checked_in' || visitStatus === 'in_progress'
  const canTryLockVisit = visitStatus === 'completed'

  const invoke = (
    action: () => Promise<VisitLifecycleResult>,
    okIdle: string,
    okIdempotent: string,
    setFb: (v: { ok: boolean; text: string } | null) => void,
  ) => {
    setFb(null)
    startTransition(async () => {
      let result: VisitLifecycleResult = { ok: false, message: 'Unknown error' }
      try {
        result = await action()
      } catch (e) {
        result = { ok: false, message: e instanceof Error ? e.message : 'Request failed' }
      }
      if (result.ok) {
        setFb({ ok: true, text: result.idempotent ? okIdempotent : okIdle })
        router.refresh()
        return
      }
      setFb({ ok: false, text: result.message })
    })
  }

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-end">

      {/* F-01 + F-09 fix: Check In is the primary action on scheduled visits */}
      {canCheckIn && (
        <div className="flex flex-col items-end gap-1">
          <Button
            type="button"
            variant="default"
            size="sm"
            disabled={pending}
            onClick={() =>
              invoke(
                () => checkInVisit({ visitId, visitPath, studyPath, subjectPath }),
                'Subject checked in.',
                'Visit already active.',
                setCheckInFb,
              )
            }
          >
            {pending ? 'Working…' : 'Check in subject'}
          </Button>
          {checkInFb ? (
            <p className={`text-xs ${checkInFb.ok ? 'text-muted-foreground' : 'text-destructive'}`}>
              {checkInFb.text}
            </p>
          ) : null}
        </div>
      )}

      {/* Mark complete: only shown/enabled after check-in, not on scheduled */}
      <div className="flex flex-col items-end gap-1">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={pending || !canTryCompleteVisit}
          onClick={() =>
            invoke(
              () => completeVisit({ visitId, visitPath, studyPath, subjectPath }),
              'Marked visit complete.',
              'Visit already marked complete.',
              setCompleteFb,
            )
          }
          title={
            canCheckIn
              ? 'Check in the subject first before marking complete.'
              : !canTryCompleteVisit
                ? `Visit cannot be marked complete from status «${visitStatus}».`
                : undefined
          }
        >
          {pending ? 'Working…' : 'Mark visit complete'}
        </Button>
        {completeFb ? (
          <p className={`text-xs ${completeFb.ok ? 'text-muted-foreground' : 'text-destructive'}`}>
            {completeFb.text}
          </p>
        ) : null}
      </div>

      <div className="flex flex-col items-end gap-1">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={pending || !canTryLockVisit}
          onClick={() =>
            invoke(
              () => lockVisit({ visitId, visitPath, studyPath, subjectPath }),
              'Visit locked.',
              'Visit already locked.',
              setLockFb,
            )
          }
          title={!canTryLockVisit ? 'Complete the visit before locking.' : undefined}
        >
          {pending ? 'Working…' : 'Lock visit'}
        </Button>
        {lockFb ? (
          <p className={`text-xs ${lockFb.ok ? 'text-muted-foreground' : 'text-destructive'}`}>
            {lockFb.text}
          </p>
        ) : null}
      </div>
    </div>
  )
}
