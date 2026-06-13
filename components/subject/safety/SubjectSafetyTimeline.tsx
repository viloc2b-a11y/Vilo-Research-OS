'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { SafetyEventRow } from '@/lib/safety-runtime/safety-types'

const EVENT_TYPE_LABELS: Record<string, string> = {
  ae: 'AE',
  sae: 'SAE',
}

const STATUS_STYLES: Record<string, string> = {
  candidate: 'bg-purple-50 text-purple-700 border-purple-200',
  open: 'bg-blue-50 text-blue-700 border-blue-200',
  under_review: 'bg-yellow-50 text-yellow-700 border-yellow-200',
  closed: 'bg-green-50 text-green-700 border-green-200',
}

const SEVERITY_STYLES: Record<string, string> = {
  mild: 'text-green-700',
  moderate: 'text-yellow-700',
  severe: 'text-red-700',
}

const SOURCE_LABELS: Record<string, string> = {
  manual: 'Manual Entry',
  lab_signal: 'Created from Lab Review',
  protocol_deviation: 'Protocol Deviation',
  source_review: 'Source Review',
}

function formatDate(d: string | null): string {
  if (!d) return '—'
  try {
    return new Date(d).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  } catch {
    return d
  }
}

type SubjectSafetyTimelineProps = {
  events: SafetyEventRow[]
  canManageSafety: boolean
  organizationId: string
  studyId: string
}

export function SubjectSafetyTimeline({
  events,
  canManageSafety,
  organizationId,
  studyId: _studyId,
}: SubjectSafetyTimelineProps) {
  const router = useRouter()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<{
    severity: string
    relatedness: string
    description: string
    requiresFollowUp: boolean
  }>({ severity: '', relatedness: '', description: '', requiresFollowUp: false })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [closingId, setClosingId] = useState<string | null>(null)
  const [classifyingId, setClassifyingId] = useState<string | null>(null)

  function startEdit(event: SafetyEventRow) {
    setEditingId(event.id)
    setEditForm({
      severity: event.severity ?? '',
      relatedness: event.relatedness ?? '',
      description: event.description,
      requiresFollowUp: event.requiresFollowUp,
    })
    setError(null)
  }

  function cancelEdit() {
    setEditingId(null)
    setError(null)
  }

  async function saveEdit(eventId: string) {
    setSaving(true)
    setError(null)

    try {
      const res = await fetch(`/api/safety-events/${eventId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organization_id: organizationId,
          severity: editForm.severity || null,
          relatedness: editForm.relatedness || null,
          description: editForm.description,
          requires_follow_up: editForm.requiresFollowUp,
        }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to update safety event')

      setEditingId(null)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update safety event')
    } finally {
      setSaving(false)
    }
  }

  async function classifyEvent(eventId: string, eventType: 'ae' | 'sae') {
    setClassifyingId(eventId)
    setError(null)

    try {
      const res = await fetch(`/api/safety-events/${eventId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organization_id: organizationId,
          event_type: eventType,
        }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to classify safety event')

      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to classify safety event')
    } finally {
      setClassifyingId(null)
    }
  }

  async function closeEvent(eventId: string) {
    setClosingId(eventId)
    setError(null)

    try {
      const res = await fetch(`/api/safety-events/${eventId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organization_id: organizationId,
          event_status: 'closed',
        }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to close safety event')

      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to close safety event')
    } finally {
      setClosingId(null)
    }
  }

  if (events.length === 0) {
    return (
      <div className="rounded-lg border bg-card p-8 text-center">
        <p className="text-sm font-medium text-muted-foreground">No safety events</p>
        <p className="text-xs text-muted-foreground mt-1">
          No safety events or candidates recorded for this subject.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {error ? (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-xs text-red-800">
          {error}
        </div>
      ) : null}

      {events.map((event) => {
        const isEditing = editingId === event.id
        const isClosed = event.eventStatus === 'closed'
        const isCandidate = event.eventStatus === 'candidate'
        const isLabSignal = event.sourceType === 'lab_signal'

        return (
          <div
            key={event.id}
            className={`rounded-lg border p-4 space-y-3 ${
              isCandidate ? 'bg-purple-50/30 border-purple-200' : 'bg-card'
            }`}
          >
            {/* Header row */}
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                {event.eventType ? (
                  <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase ${
                    event.eventType === 'sae' ? 'bg-red-50 text-red-700 border-red-200' : 'bg-amber-50 text-amber-700 border-amber-200'
                  }`}>
                    {EVENT_TYPE_LABELS[event.eventType]}
                  </span>
                ) : (
                  <span className="inline-flex items-center rounded-full border border-purple-300 bg-purple-100 px-2 py-0.5 text-[10px] font-semibold text-purple-800 uppercase">
                    Candidate
                  </span>
                )}
                <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium ${STATUS_STYLES[event.eventStatus] ?? ''}`}>
                  {event.eventStatus.replace('_', ' ')}
                </span>
                {event.severity ? (
                  <span className={`text-xs font-medium ${SEVERITY_STYLES[event.severity] ?? 'text-muted-foreground'}`}>
                    {event.severity.charAt(0).toUpperCase() + event.severity.slice(1)}
                  </span>
                ) : null}
              </div>
              <div className="flex items-center gap-1">
                {isLabSignal ? (
                  <span className="text-[10px] text-purple-600 font-medium bg-purple-50 border border-purple-200 rounded-full px-2 py-0.5">
                    {SOURCE_LABELS.lab_signal}
                  </span>
                ) : null}
              </div>
            </div>

            {/* Body */}
            {isEditing ? (
              /* Edit form */
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[11px] font-medium text-muted-foreground">Severity</label>
                    <select
                      value={editForm.severity}
                      onChange={(e) => setEditForm((f) => ({ ...f, severity: e.target.value }))}
                      className="h-7 w-full rounded-md border border-input bg-background px-2 text-xs"
                    >
                      <option value="">—</option>
                      <option value="mild">Mild</option>
                      <option value="moderate">Moderate</option>
                      <option value="severe">Severe</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] font-medium text-muted-foreground">Relatedness</label>
                    <select
                      value={editForm.relatedness}
                      onChange={(e) => setEditForm((f) => ({ ...f, relatedness: e.target.value }))}
                      className="h-7 w-full rounded-md border border-input bg-background px-2 text-xs"
                    >
                      <option value="">—</option>
                      <option value="unrelated">Unrelated</option>
                      <option value="unlikely">Unlikely</option>
                      <option value="possible">Possible</option>
                      <option value="probable">Probable</option>
                      <option value="definite">Definite</option>
                    </select>
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-medium text-muted-foreground">Description</label>
                  <textarea
                    value={editForm.description}
                    onChange={(e) => setEditForm((f) => ({ ...f, description: e.target.value }))}
                    rows={2}
                    className="min-w-0 w-full rounded-md border border-input bg-background px-2.5 py-1.5 text-xs placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                </div>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={editForm.requiresFollowUp}
                    onChange={(e) => setEditForm((f) => ({ ...f, requiresFollowUp: e.target.checked }))}
                    className="h-3.5 w-3.5 rounded border-gray-300"
                  />
                  <span className="text-xs font-medium text-muted-foreground">Requires Follow-Up</span>
                </label>
                <div className="flex justify-end gap-2">
                  <button
                    onClick={cancelEdit}
                    disabled={saving}
                    className="h-7 rounded-md border border-input bg-background px-3 text-xs font-medium text-foreground hover:bg-accent disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => saveEdit(event.id)}
                    disabled={saving}
                    className="h-7 rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                  >
                    {saving ? 'Saving...' : 'Save'}
                  </button>
                </div>
              </div>
            ) : (
              /* View mode */
              <div className="space-y-2">
                {event.description ? (
                  <p className="text-xs text-foreground">{event.description}</p>
                ) : null}

                <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs text-muted-foreground">
                  {event.relatedness ? (
                    <div>
                      <span className="font-medium text-foreground">Relatedness:</span>{' '}
                      {event.relatedness.charAt(0).toUpperCase() + event.relatedness.slice(1)}
                    </div>
                  ) : null}
                  {event.sourceType ? (
                    <div>
                      <span className="font-medium text-foreground">Source:</span>{' '}
                      {SOURCE_LABELS[event.sourceType] ?? event.sourceType}
                    </div>
                  ) : null}
                  <div>
                    <span className="font-medium text-foreground">Opened:</span>{' '}
                    {formatDate(event.openedAt)}
                  </div>
                  {event.closedAt ? (
                    <div>
                      <span className="font-medium text-foreground">Closed:</span>{' '}
                      {formatDate(event.closedAt)}
                    </div>
                  ) : null}
                  {event.requiresFollowUp ? (
                    <div className="col-span-2">
                      <span className="inline-flex items-center rounded-full border border-orange-200 bg-orange-50 px-2 py-0.5 text-[10px] font-medium text-orange-700">
                        Requires Follow-Up
                      </span>
                    </div>
                  ) : null}
                </div>

                {/* Actions */}
                {canManageSafety && !isClosed ? (
                  <div className="flex items-center gap-2 pt-1 border-t">
                    {isCandidate ? (
                      <>
                        <button
                          onClick={() => classifyEvent(event.id, 'ae')}
                          disabled={classifyingId === event.id}
                          className="h-6 rounded-md border border-amber-300 bg-amber-50 px-2 text-[10px] font-medium text-amber-700 hover:bg-amber-100 disabled:opacity-50"
                        >
                          {classifyingId === event.id ? '...' : 'Classify as AE'}
                        </button>
                        <button
                          onClick={() => classifyEvent(event.id, 'sae')}
                          disabled={classifyingId === event.id}
                          className="h-6 rounded-md border border-red-300 bg-red-50 px-2 text-[10px] font-medium text-red-700 hover:bg-red-100 disabled:opacity-50"
                        >
                          {classifyingId === event.id ? '...' : 'Classify as SAE'}
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => startEdit(event)}
                        className="h-6 rounded-md border border-input bg-background px-2 text-[10px] font-medium text-foreground hover:bg-accent"
                      >
                        Edit
                      </button>
                    )}
                    <button
                      onClick={() => closeEvent(event.id)}
                      disabled={closingId === event.id}
                      className="h-6 rounded-md border border-green-300 bg-green-50 px-2 text-[10px] font-medium text-green-700 hover:bg-green-100 disabled:opacity-50"
                    >
                      {isCandidate ? 'Dismiss' : closingId === event.id ? 'Closing...' : 'Close'}
                    </button>
                  </div>
                ) : null}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
