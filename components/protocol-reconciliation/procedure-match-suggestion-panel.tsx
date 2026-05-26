'use client'

import type { ProcedureMatchSuggestion } from '@/lib/protocol-reconciliation/protocol-reconciliation-types'

export function ProcedureMatchSuggestionPanel(props: {
  suggestions: ProcedureMatchSuggestion[]
  onApply: (suggestion: ProcedureMatchSuggestion) => void
  loading?: boolean
}) {
  if (props.suggestions.length === 0) {
    return <p className="text-xs text-slate-500">No match suggestions yet. Run suggest matches.</p>
  }

  return (
    <div className="space-y-1">
      <p className="text-xs font-medium text-slate-700">Suggested library matches</p>
      {props.suggestions.slice(0, 3).map((suggestion) => (
        <button
          key={suggestion.procedureId}
          type="button"
          disabled={props.loading}
          onClick={() => props.onApply(suggestion)}
          className="block w-full rounded border border-slate-200 px-2 py-1 text-left text-xs hover:bg-slate-50"
        >
          {suggestion.procedureCode} · {suggestion.procedureName} ({Math.round(suggestion.confidence * 100)}% ·{' '}
          {suggestion.matchingMethod})
        </button>
      ))}
    </div>
  )
}
