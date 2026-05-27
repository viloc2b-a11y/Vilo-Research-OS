'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import type {
  DraftSuggestionStatus,
  SourceBlueprintDraftSuggestionRow,
} from '@/lib/source-blueprint-drafting/draft-suggestion-types'
import { DRAFT_SUGGESTION_TYPE_LABELS } from '@/lib/source-blueprint-drafting/draft-suggestion-types'
import { DraftSuggestionDetailPanel } from './draft-suggestion-detail-panel'

type StudyOption = { id: string; name: string }

type DraftSuggestionQueueProps = {
  organizationId: string
  studies: StudyOption[]
  initialStudyId?: string | null
}

export function DraftSuggestionQueue({
  organizationId,
  studies,
  initialStudyId = null,
}: DraftSuggestionQueueProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [suggestions, setSuggestions] = useState<SourceBlueprintDraftSuggestionRow[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<DraftSuggestionStatus | ''>('draft')
  const [loading, setLoading] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)

  const studyIds = useMemo(() => new Set(studies.map((study) => study.id)), [studies])
  const studyId = useMemo(() => {
    const fromQuery = searchParams.get('study_id') ?? initialStudyId ?? ''
    return fromQuery && studyIds.has(fromQuery) ? fromQuery : ''
  }, [initialStudyId, searchParams, studyIds])

  const selectedSuggestion = suggestions.find((suggestion) => suggestion.id === selectedId) ?? null

  const loadSuggestions = useCallback(async () => {
    if (!studyId) {
      setSuggestions([])
      return
    }
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({
        organization_id: organizationId,
        study_id: studyId,
      })
      if (statusFilter) params.set('suggestion_status', statusFilter)
      const res = await fetch(`/api/source-blueprint-drafting/list?${params.toString()}`)
      const data = (await res.json()) as {
        suggestions?: SourceBlueprintDraftSuggestionRow[]
        error?: string
      }
      if (!res.ok) throw new Error(data.error || 'Failed to load draft suggestions')
      setSuggestions(data.suggestions ?? [])
    } catch (err) {
      setSuggestions([])
      setError(err instanceof Error ? err.message : 'Failed to load draft suggestions')
    } finally {
      setLoading(false)
    }
  }, [organizationId, statusFilter, studyId])

  useEffect(() => {
    // Existing workspace loaders fetch on scope/filter changes; keep this effect side-effect only.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadSuggestions()
  }, [loadSuggestions, refreshKey])

  function onStudyChange(nextStudyId: string) {
    setSelectedId(null)
    const params = new URLSearchParams(searchParams.toString())
    if (nextStudyId) params.set('study_id', nextStudyId)
    else params.delete('study_id')
    router.replace(
      params.toString()
        ? `/source-blueprint-drafting?${params.toString()}`
        : '/source-blueprint-drafting',
      { scroll: false },
    )
  }

  async function createSuggestions() {
    if (!studyId) return
    setActionLoading(true)
    setError(null)
    setMessage(null)
    try {
      const res = await fetch('/api/source-blueprint-drafting/suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organization_id: organizationId,
          study_id: studyId,
        }),
      })
      const data = (await res.json()) as {
        suggestions?: SourceBlueprintDraftSuggestionRow[]
        error?: string
      }
      if (!res.ok) throw new Error(data.error || 'Failed to create draft suggestions')
      setMessage(`Created ${data.suggestions?.length ?? 0} Draft Suggestion(s).`)
      setRefreshKey((value) => value + 1)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create draft suggestions')
    } finally {
      setActionLoading(false)
    }
  }

  return (
    <div className="space-y-6 p-6">
      <header className="max-w-3xl">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
          K3 · Evidence-backed Blueprint Drafting
        </p>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
          Source Blueprint Drafting
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          Draft Suggestion workspace for mapped evidence. Suggestions are Evidence-backed and
          require manual coordinator review before use.
        </p>
        <p className="mt-2 rounded border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
          No runtime changes occur automatically. Suggestions do not approve reconciliation, mutate
          runtime source packages, publish source, or change visit execution.
        </p>
      </header>

      <div className="rounded-md border border-slate-200 bg-slate-50 p-4">
        <label className="block text-sm font-medium text-slate-700">
          Study scope
          <select
            className="mt-2 w-full max-w-md rounded border border-slate-300 bg-white px-2 py-2 text-sm"
            value={studyId}
            onChange={(event) => onStudyChange(event.target.value)}
          >
            <option value="">Select a study...</option>
            {studies.map((study) => (
              <option key={study.id} value={study.id}>
                {study.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      {!studyId ? (
        <div className="rounded-md border border-dashed border-slate-200 bg-white p-8 text-center text-sm text-slate-600">
          Select a study to create and review Draft Suggestions.
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
          <div className="space-y-4">
            <section className="rounded-md border border-slate-200 bg-white p-3">
              <button
                type="button"
                className="w-full rounded bg-teal-700 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
                disabled={actionLoading}
                onClick={() => void createSuggestions()}
              >
                {actionLoading ? 'Creating...' : 'Create Draft Suggestions'}
              </button>
              <p className="mt-2 text-xs text-slate-500">
                Reads mapped evidence only. Pending, rejected, and superseded candidate evidence is
                not used for drafting.
              </p>
              {message ? <p className="mt-2 text-sm text-teal-700">{message}</p> : null}
              {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}
            </section>

            <section className="rounded-md border border-slate-200 bg-white p-3">
              <label className="text-xs font-medium text-slate-600">
                Status filter
                <select
                  className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
                  value={statusFilter}
                  onChange={(event) => {
                    setSelectedId(null)
                    setStatusFilter(event.target.value as DraftSuggestionStatus | '')
                  }}
                >
                  <option value="">All statuses</option>
                  <option value="draft">Draft</option>
                  <option value="accepted_for_manual_use">Accepted for manual use</option>
                  <option value="rejected">Rejected</option>
                  <option value="archived">Archived</option>
                </select>
              </label>
            </section>

            <section className="rounded-md border border-slate-200 bg-white">
              <div className="border-b border-slate-200 p-3">
                <h2 className="text-sm font-semibold text-slate-800">Draft Suggestion queue</h2>
              </div>
              {loading ? (
                <p className="p-4 text-sm text-slate-500">Loading...</p>
              ) : suggestions.length === 0 ? (
                <p className="p-4 text-sm text-slate-500">No Draft Suggestions found.</p>
              ) : (
                <ul className="max-h-[52vh] overflow-y-auto">
                  {suggestions.map((suggestion) => (
                    <li key={suggestion.id}>
                      <button
                        type="button"
                        className={`w-full border-b border-slate-100 p-3 text-left hover:bg-slate-50 ${
                          selectedId === suggestion.id ? 'bg-teal-50' : ''
                        }`}
                        onClick={() => setSelectedId(suggestion.id)}
                      >
                        <div className="text-sm font-medium text-slate-800">
                          {suggestion.suggestionPayload.title}
                        </div>
                        <div className="mt-1 text-xs text-slate-500">
                          {DRAFT_SUGGESTION_TYPE_LABELS[suggestion.suggestionType]} ·{' '}
                          {suggestion.suggestionStatus}
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>

          <DraftSuggestionDetailPanel
            organizationId={organizationId}
            studyId={studyId}
            suggestion={selectedSuggestion}
            onReviewed={() => setRefreshKey((value) => value + 1)}
          />
        </div>
      )}
    </div>
  )
}
