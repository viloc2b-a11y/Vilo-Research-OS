'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { CalendarPlus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { generateSubjectVisitScheduleAction } from '@/lib/visits/actions'

type SubjectVisitScheduleGenerateButtonProps = {
  studySubjectId: string
  organizationId: string
  expectedUpdatedAt?: string
}

export function SubjectVisitScheduleGenerateButton({
  studySubjectId,
  organizationId,
  expectedUpdatedAt,
}: SubjectVisitScheduleGenerateButtonProps) {
  const router = useRouter()
  const [message, setMessage] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  return (
    <div className="space-y-2">
      <Button
        type="button"
        size="sm"
        disabled={pending}
        onClick={() => {
          setMessage(null)
          startTransition(async () => {
            const result = await generateSubjectVisitScheduleAction({
              studySubjectId,
              organizationId,
              expectedUpdatedAt: expectedUpdatedAt ?? null,
            })
            if (!result.ok) {
              setMessage(result.error ?? 'Could not generate the visit schedule.')
              return
            }
            setMessage(
              result.createdCount && result.createdCount > 0
                ? `Created ${result.createdCount} protocol visit(s). Opening schedule…`
                : 'Schedule is already up to date. Opening visits…',
            )
            router.refresh()
          })
        }}
      >
        <CalendarPlus className="size-3.5" />
        {pending ? 'Generating…' : 'Generate protocol visit schedule'}
      </Button>
      {message ? (
        <p className="text-xs text-muted-foreground" role="status">
          {message}
        </p>
      ) : null}
    </div>
  )
}
