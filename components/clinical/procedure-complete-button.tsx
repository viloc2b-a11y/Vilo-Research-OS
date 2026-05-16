'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import type { CompleteProcedureResult } from '@/lib/actions/complete-procedure-execution.types'
import { completeProcedureExecution } from '@/lib/actions/complete-procedure-execution'
import { Button } from '@/components/ui/button'

type ProcedureCompleteButtonProps = {
  procedureExecutionId: string
  visitPath: string
  studyPath: string
  subjectPath: string
  disabled?: boolean
}

export function ProcedureCompleteButton({
  procedureExecutionId,
  visitPath,
  studyPath,
  subjectPath,
  disabled,
}: ProcedureCompleteButtonProps) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [feedback, setFeedback] = useState<{ text: string; ok: boolean } | null>(null)

  const onComplete = () => {
    setFeedback(null)
    startTransition(async () => {
      let result: CompleteProcedureResult = { ok: false, message: 'Unknown error' }
      try {
        result = await completeProcedureExecution({
          procedureExecutionId,
          revalidateVisitPath: visitPath,
          revalidateStudyPath: studyPath,
          revalidateSubjectPath: subjectPath,
        })
      } catch (e) {
        result = { ok: false, message: e instanceof Error ? e.message : 'Request failed' }
      }

      if (result.ok) {
        setFeedback({
          ok: true,
          text: result.idempotent ? 'Already completed.' : 'Marked completed.',
        })
        router.refresh()
        return
      }
      setFeedback({ ok: false, text: result.message })
    })
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={disabled || pending}
        onClick={onComplete}
      >
        {pending ? 'Working…' : 'Mark completed'}
      </Button>
      {feedback ? (
        <p
          className={
            feedback.ok ? 'text-xs text-muted-foreground' : 'text-xs text-destructive'
          }
        >
          {feedback.text}
        </p>
      ) : null}
    </div>
  )
}
