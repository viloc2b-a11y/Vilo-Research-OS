'use client'

import { useState } from 'react'
import { DRAFT_SUGGESTION_STATUS } from '@/lib/source-blueprint-drafting/draft-suggestion-types'
import type {
  DraftSuggestionStatus,
  SourceBlueprintDraftSuggestionRow,
} from '@/lib/source-blueprint-drafting/draft-suggestion-types'

type SuggestionReviewActionBarProps = {
  organizationId: string
  studyId: string
  suggestion: SourceBlueprintDraftSuggestionRow
  onReviewed: () => void
}

export function SuggestionReviewActionBar({
  organizationId,
  studyId,
  suggestion,
  onReviewed,
}: SuggestionReviewActionBarProps) {
  const [notes, setNotes] = useState(suggestion.reviewNotes ?? '')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const canReview = suggestion.suggestionStatus === DRAFT_SUGGESTION_STATUS.DRAFT

  async function review(nextStatus: DraftSuggestionStatus) {
    setLoading(true)
    setError(null)
    setMessage(null)
    try {
      const res = await fetch(
        `/api/source-blueprint-drafting/${encodeURIComponent(suggestion.id)}/review`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            organization_id: organizationId,
            study_id: studyId,
            suggestion_status: nextStatus,
            review_notes: notes || null,
          }),
        },
      )
      const data = (await res.json()) as { error?: string }
      if (!res.ok) throw new Error(data.error || 'Review failed')
      setMessage(
        nextStatus === DRAFT_SUGGESTION_STATUS.ACCEPTED_FOR_MANUAL_USE
          ? 'Marked for manual drafting use.'
          : 'Draft suggestion reviewed.',
      )
      onReviewed()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Review failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="rounded border border-slate-200 p-3">
      <label className="block text-xs font-medium text-slate-700">
        Review notes
        <textarea
          className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
          rows={2}
          value={notes}
          disabled={!canReview || loading}
          onChange={(event) => setNotes(event.target.value)}
        />
      </label>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          className="rounded bg-teal-700 px-3 py-1.5 text-sm text-white disabled:opacity-50"
          disabled={!canReview || loading}
          onClick={() => void review(DRAFT_SUGGESTION_STATUS.ACCEPTED_FOR_MANUAL_USE)}
        >
          Use as drafting aid
        </button>
        <button
          type="button"
          className="rounded border border-slate-300 px-3 py-1.5 text-sm text-slate-800 disabled:opacity-50"
          disabled={!canReview || loading}
          onClick={() => void review(DRAFT_SUGGESTION_STATUS.REJECTED)}
        >
          Reject
        </button>
        <button
          type="button"
          className="rounded border border-slate-300 px-3 py-1.5 text-sm text-slate-800 disabled:opacity-50"
          disabled={!canReview || loading}
          onClick={() => void review(DRAFT_SUGGESTION_STATUS.ARCHIVED)}
        >
          Archive
        </button>
      </div>
      {message ? <p className="mt-2 text-sm text-teal-700">{message}</p> : null}
      {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}
    </section>
  )
}
