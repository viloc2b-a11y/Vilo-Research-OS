'use client'

import { useState } from 'react'

type CreateReviewPanelProps = {
  organizationId: string
  studyId: string
  subjectId: string
  snapshotId: string
  hasReview: boolean
  reviewId: string | null
  reviewStatus: string | null
  onUpdated: () => void
}

export function CreateReviewPanel({
  organizationId,
  studyId,
  subjectId,
  snapshotId,
  hasReview,
  reviewId,
  reviewStatus,
  onUpdated,
}: CreateReviewPanelProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function post(url: string, body: Record<string, unknown>) {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = (await res.json()) as { error?: string }
      if (!res.ok) throw new Error(data.error || 'Request failed')
      onUpdated()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Request failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="rounded-md border border-slate-200 bg-white p-4">
      <h2 className="text-sm font-semibold text-slate-800">Operational review</h2>
      <div className="mt-3 flex flex-wrap gap-2">
        {!hasReview ? (
          <button
            type="button"
            className="rounded bg-slate-900 px-3 py-1.5 text-sm text-white disabled:opacity-50"
            disabled={loading}
            onClick={() =>
              void post('/api/operational-review/reviews', {
                organization_id: organizationId,
                study_id: studyId,
                subject_id: subjectId,
                snapshot_id: snapshotId,
                review_type: 'operational',
              })
            }
          >
            Create review
          </button>
        ) : null}
        {hasReview && reviewStatus === 'not_started' && reviewId ? (
          <button
            type="button"
            className="rounded bg-blue-700 px-3 py-1.5 text-sm text-white disabled:opacity-50"
            disabled={loading}
            onClick={() =>
              void post(`/api/operational-review/reviews/${encodeURIComponent(reviewId)}/start`, {
                organization_id: organizationId,
              })
            }
          >
            Start review
          </button>
        ) : null}
      </div>
      {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}
    </div>
  )
}
