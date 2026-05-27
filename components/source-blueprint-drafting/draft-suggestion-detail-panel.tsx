'use client'

import type { SourceBlueprintDraftSuggestionRow } from '@/lib/source-blueprint-drafting/draft-suggestion-types'
import { DRAFT_SUGGESTION_TYPE_LABELS } from '@/lib/source-blueprint-drafting/draft-suggestion-types'
import { EvidenceLineagePanel } from './evidence-lineage-panel'
import { SuggestionReviewActionBar } from './suggestion-review-action-bar'

type DraftSuggestionDetailPanelProps = {
  organizationId: string
  studyId: string
  suggestion: SourceBlueprintDraftSuggestionRow | null
  onReviewed: () => void
}

export function DraftSuggestionDetailPanel({
  organizationId,
  studyId,
  suggestion,
  onReviewed,
}: DraftSuggestionDetailPanelProps) {
  if (!suggestion) {
    return (
      <div className="rounded-md border border-dashed border-slate-200 p-8 text-sm text-slate-500">
        Select a Draft Suggestion to review its evidence-backed rationale.
      </div>
    )
  }

  const payload = suggestion.suggestionPayload

  return (
    <div className="vilo-scroll-contained max-h-[80vh] space-y-4 rounded-md border border-slate-200 bg-white p-4">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-sm font-semibold text-slate-900">{payload.title}</h2>
          <span className="rounded bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-800">
            Manual Review Required
          </span>
        </div>
        <p className="mt-1 text-xs text-slate-500">
          Draft Suggestion · {DRAFT_SUGGESTION_TYPE_LABELS[suggestion.suggestionType]} ·{' '}
          {suggestion.suggestionStatus}
        </p>
      </div>

      <section>
        <h3 className="text-xs font-medium text-slate-700">Suggested drafting aid</h3>
        <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">{payload.body}</p>
      </section>

      <section>
        <h3 className="text-xs font-medium text-slate-700">Evidence excerpt</h3>
        <p className="mt-1 max-h-40 overflow-y-auto text-sm text-slate-700">
          {payload.sourceText}
        </p>
      </section>

      <EvidenceLineagePanel payload={payload} />

      <p className="rounded border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
        Use as drafting aid only. Blueprint, source, runtime, reconciliation, and published source
        changes require separate manual workflows.
      </p>

      <SuggestionReviewActionBar
        organizationId={organizationId}
        studyId={studyId}
        suggestion={suggestion}
        onReviewed={onReviewed}
      />
    </div>
  )
}
