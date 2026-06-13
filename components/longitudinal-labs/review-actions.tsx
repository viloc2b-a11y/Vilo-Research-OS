'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { SignaturePinDialog } from './signature-pin-dialog'

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
  signatureRequestStatus,
  canReview,
  canClassify,
}: {
  reviewId: string
  organizationId: string
  studyId: string
  initialStatus: string
  initialClassification: string | null
  initialNotes: string | null
  signatureRequestId: string | null
  signatureRequestStatus: string | null
  canReview: boolean
  canClassify: boolean
}) {
  const router = useRouter()
  const [reviewStatus, setReviewStatus] = useState(initialStatus)
  const [piClassification, setPiClassification] = useState<string | null>(
    initialClassification,
  )
  const [reviewNotes, setReviewNotes] = useState(initialNotes ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showPinDialog, setShowPinDialog] = useState(false)

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

  const isTerminal = reviewStatus === 'reviewed' || reviewStatus === 'rejected'
  const canSign =
    reviewStatus === 'reviewed' &&
    signatureRequestId &&
    signatureRequestStatus === 'pending'
  const isSigned = signatureRequestStatus === 'signed'

  if (!canReview && !canClassify) {
    return (
      <div className="space-y-3 pt-3 border-t mt-3">
        {initialNotes ? (
          <div className="flex items-start gap-2">
            <span className="text-[11px] font-medium text-muted-foreground w-14 pt-0.5">
              Notes:
            </span>
            <span className="text-xs text-muted-foreground">{initialNotes}</span>
          </div>
        ) : null}
      </div>
    )
  }

  return (
    <div className="space-y-3 pt-3 border-t mt-3">
      {/* Status buttons */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[11px] font-medium text-muted-foreground w-14">
          Status:
        </span>
        {reviewStatus === 'pending_review' && canReview ? (
          <button
            onClick={() => setReviewStatus('under_review')}
            className="h-7 rounded-md border border-input bg-background px-2.5 text-[11px] font-medium text-foreground hover:bg-accent"
          >
            Start Review
          </button>
        ) : null}
        {reviewStatus === 'under_review' ? (
          <>
            {canClassify ? (
              <button
                onClick={() => setReviewStatus('reviewed')}
                className="h-7 rounded-md bg-green-600 px-2.5 text-[11px] font-medium text-white hover:bg-green-700"
              >
                Mark Reviewed
              </button>
            ) : null}
            {canClassify ? (
              <button
                onClick={() => setReviewStatus('rejected')}
                className="h-7 rounded-md border border-red-300 bg-background px-2.5 text-[11px] font-medium text-red-700 hover:bg-red-50"
              >
                Reject
              </button>
            ) : null}
          </>
        ) : null}
        {isTerminal ? (
          <span className="text-[11px] text-muted-foreground italic">
            {reviewStatus === 'reviewed' ? 'Reviewed' : 'Rejected'} —
            no further status changes
          </span>
        ) : null}
      </div>

      {/* PI Classification — only for users who can classify */}
      {canClassify ? (
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
      ) : null}

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

        {canSign ? (
          <button
            onClick={() => setShowPinDialog(true)}
            className="h-7 rounded-md border border-blue-300 bg-blue-50 px-3 text-[11px] font-medium text-blue-700 hover:bg-blue-100"
          >
            Sign Lab Report Review
          </button>
        ) : null}

        {isSigned ? (
          <span className="inline-flex items-center gap-1 text-[11px] text-green-700 font-medium">
            <svg
              className="h-3.5 w-3.5"
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
            Signed
          </span>
        ) : signatureRequestId && !canSign && !isSigned ? (
          <span className="text-[11px] text-muted-foreground italic">
            Signature request pending
          </span>
        ) : null}
      </div>

      <SignaturePinDialog
        open={showPinDialog}
        onClose={() => setShowPinDialog(false)}
        organizationId={organizationId}
        signatureRequestId={signatureRequestId ?? ''}
      />
    </div>
  )
}
