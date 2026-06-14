'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { CapaActionRow } from '@/lib/capa-runtime/capa-types'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'

const VALID_TRANSITIONS: Record<string, string[]> = {
  open:         ['in_progress'],
  in_progress:  ['under_review', 'open'],
  under_review: ['completed', 'in_progress'],
  completed:    ['verified', 'under_review'],
  verified:     ['closed', 'completed'],
  closed:       [],
}

const STATUS_LABELS: Record<string, string> = {
  open: 'Open',
  in_progress: 'In Progress',
  under_review: 'Under Review',
  completed: 'Completed',
  verified: 'Verified',
  closed: 'Closed',
}

const STATUS_COLORS: Record<string, string> = {
  open: 'bg-yellow-100 text-yellow-800',
  in_progress: 'bg-blue-100 text-blue-800',
  under_review: 'bg-purple-100 text-purple-800',
  completed: 'bg-green-100 text-green-800',
  verified: 'bg-emerald-100 text-emerald-800',
  closed: 'bg-gray-100 text-gray-700',
}

type Props = {
  action: CapaActionRow
  organizationId: string
}

export function CapaTransitionPanel({ action, organizationId }: Props) {
  const router = useRouter()
  const [pending, setPending] = useState<string | null>(null)
  const [note, setNote] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const currentStatus = action.capaStatus
  const validNextStatuses = VALID_TRANSITIONS[currentStatus] ?? []

  async function handleTransition(toStatus: string) {
    if (!note.trim()) {
      setError('A transition note is required.')
      return
    }
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/capa-actions/${action.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organization_id: organizationId,
          capa_status: toStatus,
          note: note.trim(),
        }),
      })
      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        throw new Error((json as { error?: string }).error ?? 'Failed to update status')
      }
      setPending(null)
      setNote('')
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Status</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-3">
          <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_COLORS[currentStatus] ?? 'bg-gray-100 text-gray-700'}`}>
            {STATUS_LABELS[currentStatus] ?? currentStatus}
          </span>
          {currentStatus === 'closed' && (
            <span className="text-sm text-muted-foreground">This CAPA is closed and cannot be transitioned.</span>
          )}
        </div>

        {validNextStatuses.length > 0 && (
          <div className="space-y-3">
            <p className="text-sm font-medium">Transition to:</p>
            <div className="flex flex-wrap gap-2">
              {validNextStatuses.map((status) => (
                <Button
                  key={status}
                  variant={pending === status ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => {
                    setPending(status)
                    setNote('')
                    setError(null)
                  }}
                  disabled={loading}
                >
                  {STATUS_LABELS[status] ?? status}
                </Button>
              ))}
            </div>

            {pending && (
              <div className="space-y-2 pt-2 border-t">
                <label className="text-sm font-medium">
                  Transition note <span className="text-red-500">*</span>
                </label>
                <Textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder={`Describe reason for transitioning to ${STATUS_LABELS[pending] ?? pending}...`}
                  rows={3}
                  disabled={loading}
                />
                {error && <p className="text-sm text-red-500">{error}</p>}
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={() => handleTransition(pending)}
                    disabled={loading || !note.trim()}
                  >
                    {loading ? 'Saving…' : `Move to ${STATUS_LABELS[pending] ?? pending}`}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => { setPending(null); setNote(''); setError(null) }}
                    disabled={loading}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
