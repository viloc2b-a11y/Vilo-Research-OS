'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

const PI_OPTIONS = [
  { value: 'cs', label: 'CS' },
  { value: 'ncs', label: 'NCS' },
  { value: 'follow_up_required', label: 'Follow-Up Required' },
] as const

export function ReviewActions({
  reviewId,
  organizationId,
  studyId,
  initialStatus,
  initialClassification,
  initialNotes,
  signatureRequestId,
}: {
  reviewId: string
  organizationId: string
  studyId: string
  initialStatus: string
  initialClassification: string | null
  initialNotes: string | null
  signatureRequestId: string | null
}) {
  const router = useRouter()
  const [reviewStatus, setReviewStatus] = useState(initialStatus)
  const [piClassification, setPiClassification] = useState<string | null>(
    initialClassification,
  )
  const [reviewNotes, setReviewNotes] = useState(initialNotes ?? '')
  const [saving, setSaving] = useState(false)
  const [requestingSignature, setRequestingSignature] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function saveReview() {
    setSaving(true)
    setError(null)

    try {
      const res = await fetch(
        `/api/longitudinal-labs/reviews/${reviewId}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            organization_id: organizationId,
            study_id: studyId,
            review_status: reviewStatus,
            pi_classification: piClassification,
            review_notes: reviewNotes || null,
          }),
        },
      )

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error ?? 'Failed to save review')
      }

      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save review')
    } finally {
      setSaving(false)
    }
  }

  async function requestSignature() {
    setRequestingSignature(true)
    setError(null)

    try {
      const res = await fetch(
        `/api/longitudinal-labs/reviews/${reviewId}/request-signature`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        },
      )

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error ?? 'Failed to request signature')
      }

      router.refresh()
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to request signature',
      )
    } finally {
      setRequestingSignature(false)
    }
  }

  const isTerminal = reviewStatus === 'reviewed' || reviewStatus === 'rejected'
  const canRequestSignature =
    reviewStatus === 'reviewed' && !signatureRequestId

  return (
    <div className="space-y-3 pt-3 border-t mt-3">
      {/* Status buttons */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[11px] font-medium text-muted-foreground w-14">
          Status:
        </span>
        {reviewStatus === 'pending_review' ? (
          <button
            onClick={() => setReviewStatus('under_review')}
            className="h-7 rounded-md border border-input bg-background px-2.5 text-[11px] font-medium text-foreground hover:bg-accent"
          >
            Start Review
          </button>
        ) : null}
        {reviewStatus === 'under_review' ? (
          <>
            <button
              onClick={() => setReviewStatus('reviewed')}
              className="h-7 rounded-md bg-green-600 px-2.5 text-[11px] font-medium text-white hover:bg-green-700"
            >
              Mark Reviewed
            </button>
            <button
              onClick={() => setReviewStatus('rejected')}
              className="h-7 rounded-md border border-red-300 bg-background px-2.5 text-[11px] font-medium text-red-700 hover:bg-red-50"
            >
              Reject
            </button>
          </>
        ) : null}
        {isTerminal ? (
          <span className="text-[11px] text-muted-foreground italic">
            {reviewStatus === 'reviewed' ? 'Reviewed' : 'Rejected'} —
            no further status changes
          </span>
        ) : null}
      </div>

      {/* PI Classification */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[11px] font-medium text-muted-foreground w-14">
          PI Class:
        </span>
        {PI_OPTIONS.map((opt) => {
          const active = piClassification === opt.value
          return (
            <button
              key={opt.value}
              onClick={() =>
                setPiClassification(active ? null : opt.value)
              }
              className={`h-7 rounded-md border px-2.5 text-[11px] font-medium transition-colors ${
                active
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-card text-muted-foreground border-border hover:border-primary/50'
              }`}
            >
              {opt.label}
            </button>
          )
        })}
        {piClassification ? (
          <button
            onClick={() => setPiClassification(null)}
            className="h-7 rounded-md border border-input bg-background px-2 text-[11px] text-muted-foreground hover:bg-accent"
          >
            Clear
          </button>
        ) : null}
      </div>

      {/* Review notes */}
      <div className="flex items-start gap-2">
        <span className="text-[11px] font-medium text-muted-foreground w-14 pt-1.5">
          Notes:
        </span>
        <textarea
          value={reviewNotes}
          onChange={(e) => setReviewNotes(e.target.value)}
          placeholder="Add review notes..."
          rows={2}
          className="min-w-0 flex-1 rounded-md border border-input bg-background px-2.5 py-1.5 text-xs placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-ring"
        />
      </div>

      {/* Error */}
      {error ? (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-1.5 text-[11px] text-red-800">
          {error}
        </div>
      ) : null}

      {/* Save + Signature buttons */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={saveReview}
          disabled={saving}
          className="h-7 rounded-md bg-primary px-3 text-[11px] font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {saving ? 'Saving...' : 'Save'}
        </button>

        {canRequestSignature ? (
          <button
            onClick={requestSignature}
            disabled={requestingSignature}
            className="h-7 rounded-md border border-blue-300 bg-blue-50 px-3 text-[11px] font-medium text-blue-700 hover:bg-blue-100 disabled:opacity-50"
          >
            {requestingSignature
              ? 'Requesting...'
              : 'Request PI/Sub-I Signature'}
          </button>
        ) : null}

        {signatureRequestId ? (
          <span className="text-[11px] text-green-600 font-medium">
            Signature requested
          </span>
        ) : null}
      </div>
    </div>
  )
}
