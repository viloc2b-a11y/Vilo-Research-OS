'use client'

import { useState } from 'react'
import type { DocumentIntelligenceSearchResult } from '@/lib/document-intelligence/document-intelligence-types'
import { SEARCH_AREA_OPTIONS } from './document-intelligence-domain-ui'
import { IntelligenceSearchResults } from './intelligence-search-results'

type IntelligenceSearchPanelProps = {
  organizationId: string
  studyId: string
}

export function IntelligenceSearchPanel({
  organizationId,
  studyId,
}: IntelligenceSearchPanelProps) {
  const [query, setQuery] = useState('')
  const [searchArea, setSearchArea] = useState('')
  const [includeSuperseded, setIncludeSuperseded] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [results, setResults] = useState<DocumentIntelligenceSearchResult[]>([])

  async function handleSearch() {
    if (!query.trim() || !studyId) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/document-intelligence/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organization_id: organizationId,
          study_id: studyId,
          query,
          domain: searchArea || null,
          include_superseded: includeSuperseded,
          limit: 8,
        }),
      })
      const data = (await res.json()) as {
        results?: DocumentIntelligenceSearchResult[]
        error?: string
      }
      if (!res.ok) throw new Error(data.error || 'Search failed')
      setResults(data.results ?? [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed')
      setResults([])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="rounded-md border border-slate-200 bg-white p-4">
      <h2 className="text-sm font-semibold text-slate-800">Study-scoped search</h2>
      <p className="mt-1 text-xs text-slate-500">
        Search indexed knowledge chunks for the selected study only. Defaults to active reference
        document versions — enable history to include superseded versions. Never mixes versions
        silently.
      </p>
      <div className="mt-3 flex flex-wrap items-end gap-3">
        <label className="text-sm text-slate-600">
          Search area
          <select
            className="ml-2 rounded border border-slate-300 px-2 py-1.5 text-sm"
            value={searchArea}
            onChange={(e) => setSearchArea(e.target.value)}
          >
            {SEARCH_AREA_OPTIONS.map((option) => (
              <option key={option.value || 'all'} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm text-slate-600">
          <input
            type="checkbox"
            checked={includeSuperseded}
            onChange={(e) => setIncludeSuperseded(e.target.checked)}
          />
          Include superseded / history versions
        </label>
        <label className="min-w-[200px] flex-1 text-sm text-slate-600">
          Query
          <input
            className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
            placeholder="Search study documents…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void handleSearch()
            }}
          />
        </label>
        <button
          type="button"
          className="rounded bg-slate-900 px-3 py-1.5 text-sm text-white disabled:opacity-50"
          disabled={loading || !query.trim()}
          onClick={() => void handleSearch()}
        >
          {loading ? 'Searching…' : 'Search'}
        </button>
      </div>
      {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}
      <IntelligenceSearchResults results={results} />
    </div>
  )
}
