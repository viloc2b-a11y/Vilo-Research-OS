'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import type { SourceBlueprintDraftSuggestionRow } from '@/lib/source-blueprint-drafting/draft-suggestion-types'
import type {
  SourceBlueprintAuditExportRow,
  SourceBlueprintDraftSignoffRow,
} from '@/lib/source-blueprint-signoff/signoff-types'

type StudyOption = { id: string; name: string }

export function SourceBlueprintSignoffClient({
  organizationId,
  studies,
  initialStudyId = null,
}: {
  organizationId: string
  studies: StudyOption[]
  initialStudyId?: string | null
}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [suggestions, setSuggestions] = useState<SourceBlueprintDraftSuggestionRow[]>([])
  const [signoffs, setSignoffs] = useState<SourceBlueprintDraftSignoffRow[]>([])
  const [selectedSuggestionIds, setSelectedSuggestionIds] = useState<string[]>([])
  const [statement, setStatement] = useState(
    'Manual review completed for evidence-backed draft suggestions.',
  )
  const [selectedSignoffId, setSelectedSignoffId] = useState('')
  const [lastExport, setLastExport] = useState<SourceBlueprintAuditExportRow | null>(null)
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

  const loadWorkspace = useCallback(async () => {
    if (!studyId) {
      setSuggestions([])
      setSignoffs([])
      return
    }
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({
        organization_id: organizationId,
        study_id: studyId,
      })
      const suggestionParams = new URLSearchParams(params)
      suggestionParams.set('suggestion_status', 'accepted_for_manual_use')
      const [suggestionRes, signoffRes] = await Promise.all([
        fetch(`/api/source-blueprint-drafting/list?${suggestionParams.toString()}`),
        fetch(`/api/source-blueprint-signoff/list?${params.toString()}`),
      ])
      const suggestionData = (await suggestionRes.json()) as {
        suggestions?: SourceBlueprintDraftSuggestionRow[]
        error?: string
      }
      const signoffData = (await signoffRes.json()) as {
        signoffs?: SourceBlueprintDraftSignoffRow[]
        error?: string
      }
      if (!suggestionRes.ok) throw new Error(suggestionData.error || 'Failed to load suggestions')
      if (!signoffRes.ok) throw new Error(signoffData.error || 'Failed to load sign-offs')
      setSuggestions(suggestionData.suggestions ?? [])
      setSignoffs(signoffData.signoffs ?? [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load sign-off workspace')
    } finally {
      setLoading(false)
    }
  }, [organizationId, studyId])

  useEffect(() => {
    // Workspace loader follows selected study and refresh state.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadWorkspace()
  }, [loadWorkspace, refreshKey])

  function onStudyChange(nextStudyId: string) {
    setSelectedSuggestionIds([])
    setSelectedSignoffId('')
    setLastExport(null)
    const params = new URLSearchParams(searchParams.toString())
    if (nextStudyId) params.set('study_id', nextStudyId)
    else params.delete('study_id')
    router.replace(
      params.toString()
        ? `/source-blueprint-signoff?${params.toString()}`
        : '/source-blueprint-signoff',
      { scroll: false },
    )
  }

  function toggleSuggestion(id: string) {
    setSelectedSuggestionIds((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    )
  }

  async function signSelected() {
    if (!studyId) return
    setActionLoading(true)
    setError(null)
    setMessage(null)
    setLastExport(null)
    try {
      const res = await fetch('/api/source-blueprint-signoff/sign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organization_id: organizationId,
          study_id: studyId,
          suggestion_ids: selectedSuggestionIds,
          signoff_statement: statement,
        }),
      })
      const data = (await res.json()) as { signoff?: SourceBlueprintDraftSignoffRow; error?: string }
      if (!res.ok) throw new Error(data.error || 'Sign-off failed')
      setMessage('Formal sign-off recorded.')
      setSelectedSuggestionIds([])
      setSelectedSignoffId(data.signoff?.id ?? '')
      setRefreshKey((value) => value + 1)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign-off failed')
    } finally {
      setActionLoading(false)
    }
  }

  async function exportSelected() {
    const signoffId = selectedSignoffId || signoffs[0]?.id
    if (!studyId || !signoffId) return
    setActionLoading(true)
    setError(null)
    setMessage(null)
    try {
      const res = await fetch('/api/source-blueprint-signoff/audit-export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organization_id: organizationId,
          study_id: studyId,
          signoff_id: signoffId,
        }),
      })
      const data = (await res.json()) as {
        auditExport?: SourceBlueprintAuditExportRow
        error?: string
      }
      if (!res.ok) throw new Error(data.error || 'Audit export failed')
      setLastExport(data.auditExport ?? null)
      setMessage('Audit package generated.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Audit export failed')
    } finally {
      setActionLoading(false)
    }
  }

  return (
    <div className="space-y-6 p-6">
      <header className="max-w-3xl">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
          K4 · Formal Sign-off + Audit Export
        </p>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
          Source Blueprint Sign-off
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          Complete manual review for evidence-backed draft suggestions and generate an audit
          package for the sign-off trail.
        </p>
        <p className="mt-2 rounded border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
          Sign-off records review intent only. Runtime, reconciliation, visit execution, and
          published source remain unchanged.
        </p>
      </header>

      <section className="rounded-md border border-slate-200 bg-slate-50 p-4">
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
      </section>

      {!studyId ? (
        <div className="rounded-md border border-dashed border-slate-200 bg-white p-8 text-center text-sm text-slate-600">
          Select a study to sign off accepted draft suggestions.
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
          <section className="rounded-md border border-slate-200 bg-white">
            <div className="border-b border-slate-200 p-3">
              <h2 className="text-sm font-semibold text-slate-800">
                Accepted suggestions for sign-off
              </h2>
              <p className="mt-1 text-xs text-slate-500">
                Select only suggestions already accepted for manual use.
              </p>
            </div>
            {loading ? (
              <p className="p-4 text-sm text-slate-500">Loading...</p>
            ) : suggestions.length === 0 ? (
              <p className="p-4 text-sm text-slate-500">
                No accepted draft suggestions are available for sign-off.
              </p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {suggestions.map((suggestion) => (
                  <li key={suggestion.id} className="p-3">
                    <label className="flex gap-3 text-sm">
                      <input
                        type="checkbox"
                        className="mt-1"
                        checked={selectedSuggestionIds.includes(suggestion.id)}
                        onChange={() => toggleSuggestion(suggestion.id)}
                      />
                      <span>
                        <span className="block font-medium text-slate-800">
                          {suggestion.suggestionPayload.title}
                        </span>
                        <span className="mt-1 block text-xs text-slate-500">
                          {suggestion.suggestionType} · evidence {suggestion.evidenceId.slice(0, 8)}
                        </span>
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <aside className="space-y-4">
            <section className="rounded-md border border-slate-200 bg-white p-3">
              <h2 className="text-sm font-semibold text-slate-800">Formal sign-off</h2>
              <label className="mt-3 block text-xs font-medium text-slate-700">
                Sign-off statement
                <textarea
                  className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
                  rows={4}
                  value={statement}
                  onChange={(event) => setStatement(event.target.value)}
                />
              </label>
              <button
                type="button"
                className="mt-3 w-full rounded bg-teal-700 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
                disabled={actionLoading || selectedSuggestionIds.length === 0}
                onClick={() => void signSelected()}
              >
                Record sign-off
              </button>
            </section>

            <section className="rounded-md border border-slate-200 bg-white p-3">
              <h2 className="text-sm font-semibold text-slate-800">Audit package</h2>
              <select
                className="mt-3 w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
                value={selectedSignoffId}
                onChange={(event) => setSelectedSignoffId(event.target.value)}
              >
                <option value="">Latest signed review</option>
                {signoffs.map((signoff) => (
                  <option key={signoff.id} value={signoff.id}>
                    {new Date(signoff.signedAt).toLocaleString()} · {signoff.id.slice(0, 8)}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="mt-3 w-full rounded border border-slate-300 px-3 py-2 text-sm font-medium text-slate-800 disabled:opacity-50"
                disabled={actionLoading || signoffs.length === 0}
                onClick={() => void exportSelected()}
              >
                Generate audit package
              </button>
              {lastExport ? (
                <div className="mt-3 rounded bg-slate-50 p-2 text-xs text-slate-600">
                  <p>Package hash</p>
                  <p className="break-all font-mono">{lastExport.packageHash}</p>
                </div>
              ) : null}
            </section>

            {message ? <p className="text-sm text-teal-700">{message}</p> : null}
            {error ? <p className="text-sm text-red-600">{error}</p> : null}
          </aside>
        </div>
      )}
    </div>
  )
}
