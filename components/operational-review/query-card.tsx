'use client'

import { useState } from 'react'
import type { VisitSnapshotQueryRow } from '@/lib/operational-review/operational-review-types'

type QueryCardProps = {
  query: VisitSnapshotQueryRow
  organizationId: string
  disabled?: boolean
  onUpdated: () => void
}

export function QueryCard({ query, organizationId, disabled, onUpdated }: QueryCardProps) {
  const [answerText, setAnswerText] = useState(
    typeof query.metadata.answer_text === 'string' ? query.metadata.answer_text : '',
  )
  const [resolutionText, setResolutionText] = useState(query.resolutionText ?? '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function post(path: string, body: Record<string, unknown>) {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ organization_id: organizationId, ...body }),
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

  const scopeLabel =
    query.queryScope === 'field'
      ? `${query.fieldLabel ?? query.fieldId} (${query.procedureCode ?? 'procedure'})`
      : query.queryScope === 'procedure'
        ? procedureNameLabel(query)
        : query.queryScope

  return (
    <div className="rounded-md border border-slate-200 bg-white p-4 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-medium text-slate-900">{scopeLabel}</span>
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs">{query.queryStatus}</span>
        <span className="text-xs text-slate-500">{query.priority}</span>
      </div>
      <p className="mt-2 text-slate-700">{query.queryText}</p>

      {query.queryStatus === 'open' || query.queryStatus === 'answered' ? (
        <div className="mt-3 space-y-2">
          {(query.queryStatus === 'open' || query.queryStatus === 'answered') && (
            <label className="block text-xs text-slate-600">
              Answer
              <textarea
                className="mt-1 w-full rounded border border-slate-300 p-2 text-sm"
                rows={2}
                disabled={disabled || loading}
                value={answerText}
                onChange={(e) => setAnswerText(e.target.value)}
              />
            </label>
          )}
          {query.queryStatus === 'answered' && (
            <label className="block text-xs text-slate-600">
              Resolution
              <textarea
                className="mt-1 w-full rounded border border-slate-300 p-2 text-sm"
                rows={2}
                disabled={disabled || loading}
                value={resolutionText}
                onChange={(e) => setResolutionText(e.target.value)}
              />
            </label>
          )}
          <div className="flex flex-wrap gap-2">
            {query.queryStatus === 'open' ? (
              <button
                type="button"
                className="rounded bg-slate-800 px-3 py-1 text-xs text-white disabled:opacity-50"
                disabled={disabled || loading}
                onClick={() =>
                  void post(`/api/operational-review/queries/${encodeURIComponent(query.id)}/answer`, {
                    answer_text: answerText,
                  })
                }
              >
                Answer query
              </button>
            ) : null}
            {query.queryStatus === 'answered' ? (
              <button
                type="button"
                className="rounded bg-emerald-800 px-3 py-1 text-xs text-white disabled:opacity-50"
                disabled={disabled || loading}
                onClick={() =>
                  void post(`/api/operational-review/queries/${encodeURIComponent(query.id)}/resolve`, {
                    resolution_text: resolutionText,
                  })
                }
              >
                Resolve query
              </button>
            ) : null}
            <button
              type="button"
              className="rounded border border-slate-300 px-3 py-1 text-xs text-slate-700 disabled:opacity-50"
              disabled={disabled || loading}
              onClick={() => {
                const reason = window.prompt('Cancel reason (optional):')
                if (reason === null) return
                void post(`/api/operational-review/queries/${encodeURIComponent(query.id)}/cancel`, {
                  reason,
                })
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}

      {error ? <p className="mt-2 text-xs text-red-600">{error}</p> : null}
    </div>
  )
}

function procedureNameLabel(query: VisitSnapshotQueryRow): string {
  return query.procedureCode ?? query.procedureInstanceId ?? 'Procedure'
}
