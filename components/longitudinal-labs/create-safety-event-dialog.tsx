'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

const EVENT_TYPE_OPTIONS = [
  { value: 'ae', label: 'AE' },
  { value: 'sae', label: 'SAE' },
] as const

const SEVERITY_OPTIONS = [
  { value: '', label: '—' },
  { value: 'mild', label: 'Mild' },
  { value: 'moderate', label: 'Moderate' },
  { value: 'severe', label: 'Severe' },
] as const

const RELATEDNESS_OPTIONS = [
  { value: '', label: '—' },
  { value: 'unrelated', label: 'Unrelated' },
  { value: 'unlikely', label: 'Unlikely' },
  { value: 'possible', label: 'Possible' },
  { value: 'probable', label: 'Probable' },
  { value: 'definite', label: 'Definite' },
] as const

export type CreateSafetyEventDialogProps = {
  open: boolean
  onClose: () => void
  organizationId: string
  studyId: string
  subjectId: string
  visitId?: string | null
  prefilledDescription?: string
  labTestCode?: string | null
  labTestName?: string | null
  piClassification?: string | null
  sourceReferenceId?: string | null
  sourceDocumentId?: string | null
}

export function CreateSafetyEventDialog({
  open,
  onClose,
  organizationId,
  studyId,
  subjectId,
  visitId,
  prefilledDescription,
  labTestCode,
  labTestName,
  piClassification,
  sourceReferenceId,
  sourceDocumentId,
}: CreateSafetyEventDialogProps) {
  const router = useRouter()

  const [eventType, setEventType] = useState<'ae' | 'sae'>('ae')
  const [severity, setSeverity] = useState('')
  const [relatedness, setRelatedness] = useState('')
  const [requiresFollowUp, setRequiresFollowUp] = useState(false)
  const [description, setDescription] = useState(prefilledDescription ?? '')
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [createdId, setCreatedId] = useState<string | null>(null)

  if (!open) return null

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setCreating(true)
    setError(null)

    try {
      const res = await fetch('/api/safety-events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organization_id: organizationId,
          study_id: studyId,
          subject_id: subjectId,
          visit_id: visitId ?? null,
          event_type: eventType,
          description,
          severity: severity || null,
          relatedness: relatedness || null,
          requires_follow_up: requiresFollowUp,
          source_type: 'lab_signal',
          source_reference_id: sourceReferenceId ?? null,
          lab_test_code: labTestCode ?? null,
          lab_test_name: labTestName ?? null,
          pi_classification: piClassification ?? null,
          source_document_id: sourceDocumentId ?? null,
          metadata: {},
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error ?? 'Failed to create safety event')
      }

      setCreatedId(data.event.id)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create safety event')
    } finally {
      setCreating(false)
    }
  }

  function handleClose() {
    setCreatedId(null)
    setError(null)
    setEventType('ae')
    setSeverity('')
    setRelatedness('')
    setRequiresFollowUp(false)
    setDescription(prefilledDescription ?? '')
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose()
      }}
    >
      <div className="w-full max-w-md rounded-lg border bg-card p-5 shadow-lg">
        {createdId ? (
          /* Success state */
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <svg
                className="h-5 w-5 text-green-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <h3 className="text-sm font-semibold">Safety Event Created</h3>
            </div>
            <p className="text-xs text-muted-foreground">
              {eventType === 'ae' ? 'Adverse Event' : 'Serious Adverse Event'} has been created.
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={handleClose}
                className="h-7 rounded-md border border-input bg-background px-3 text-xs font-medium text-foreground hover:bg-accent"
              >
                Close
              </button>
            </div>
          </div>
        ) : (
          /* Form */
          <form onSubmit={handleSubmit} className="space-y-4">
            <h3 className="text-sm font-semibold">Create Safety Event</h3>

            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Event Type</label>
              <div className="flex gap-2">
                {EVENT_TYPE_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setEventType(opt.value)}
                    className={`h-7 flex-1 rounded-md border text-xs font-medium transition-colors ${
                      eventType === opt.value
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-card text-muted-foreground border-border hover:border-primary/50'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Severity</label>
              <select
                value={severity}
                onChange={(e) => setSeverity(e.target.value)}
                className="h-7 w-full rounded-md border border-input bg-background px-2 text-xs"
              >
                {SEVERITY_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Relatedness</label>
              <select
                value={relatedness}
                onChange={(e) => setRelatedness(e.target.value)}
                className="h-7 w-full rounded-md border border-input bg-background px-2 text-xs"
              >
                {RELATEDNESS_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="requires_follow_up"
                checked={requiresFollowUp}
                onChange={(e) => setRequiresFollowUp(e.target.checked)}
                className="h-3.5 w-3.5 rounded border-gray-300"
              />
              <label htmlFor="requires_follow_up" className="text-xs font-medium text-muted-foreground">
                Requires Follow-Up
              </label>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                required
                rows={3}
                placeholder="Describe the event..."
                className="min-w-0 w-full rounded-md border border-input bg-background px-2.5 py-1.5 text-xs placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>

            {error ? (
              <div className="rounded-md border border-red-200 bg-red-50 px-3 py-1.5 text-xs text-red-800">
                {error}
              </div>
            ) : null}

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={handleClose}
                disabled={creating}
                className="h-7 rounded-md border border-input bg-background px-3 text-xs font-medium text-foreground hover:bg-accent disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={creating}
                className="h-7 rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {creating ? 'Creating...' : `Create ${eventType === 'ae' ? 'AE' : 'SAE'}`}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
