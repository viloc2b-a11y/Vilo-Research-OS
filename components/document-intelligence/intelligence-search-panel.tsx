'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import type { DocumentIntelligenceSearchResult } from '@/lib/document-intelligence/document-intelligence-types'
import { SEARCH_AREA_OPTIONS } from './document-intelligence-domain-ui'
import { IntelligenceSearchResults } from './intelligence-search-results'

type IntelligenceSearchPanelProps = {
  organizationId: string
  studyId: string
  initialQuery?: string
  initialSearchArea?: string
  initialIncludeSuperseded?: boolean
}

export function IntelligenceSearchPanel({
  organizationId,
  studyId,
  initialQuery = '',
  initialSearchArea = '',
  initialIncludeSuperseded = false,
}: IntelligenceSearchPanelProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [query, setQuery] = useState(initialQuery)
  const [searchArea, setSearchArea] = useState(initialSearchArea)
  const [includeSuperseded, setIncludeSuperseded] = useState(initialIncludeSuperseded)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [results, setResults] = useState<DocumentIntelligenceSearchResult[]>([])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setQuery(initialQuery)
  }, [initialQuery])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSearchArea(initialSearchArea)
  }, [initialSearchArea])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIncludeSuperseded(initialIncludeSuperseded)
  }, [initialIncludeSuperseded])

  const hasActiveFilter = useMemo(
    () => Boolean(query.trim()) || Boolean(searchArea) || includeSuperseded,
    [includeSuperseded, query, searchArea],
  )

  const syncUrl = useCallback(
    (nextQuery: string, nextSearchArea: string, nextIncludeSuperseded: boolean) => {
      const params = new URLSearchParams(searchParams.toString())
      params.set('study_id', studyId)
      if (nextQuery.trim()) {
        params.set('q', nextQuery.trim())
      } else {
        params.delete('q')
      }
      if (nextSearchArea) {
        params.set('domain', nextSearchArea)
      } else {
        params.delete('domain')
      }
      if (nextIncludeSuperseded) {
        params.set('history', '1')
      } else {
        params.delete('history')
      }
      router.replace(`${pathname}?${params.toString()}`, { scroll: false })
    },
    [pathname, router, searchParams, studyId],
  )

  async function handleSearch(
    nextQuery: string = query,
    nextSearchArea: string = searchArea,
    nextIncludeSuperseded: boolean = includeSuperseded,
    persistUrl = true,
  ) {
    const sanitizedQuery = nextQuery.trim()
    if (!sanitizedQuery || !studyId) return
    if (persistUrl) {
      syncUrl(sanitizedQuery, nextSearchArea, nextIncludeSuperseded)
    }
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/document-intelligence/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organization_id: organizationId,
          study_id: studyId,
          query: sanitizedQuery,
          domain: nextSearchArea || null,
          include_superseded: nextIncludeSuperseded,
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
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-md border border-slate-200 bg-slate-50/80 px-3 py-2 text-sm">
        <div className="flex flex-wrap items-center gap-2 text-slate-600">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            Filter status
          </span>
          {hasActiveFilter ? (
            <span className="inline-flex items-center rounded-full bg-teal-50 px-2.5 py-1 text-xs font-semibold text-teal-800 ring-1 ring-inset ring-teal-200">
              Active: {query.trim() || 'search filters'}
              {searchArea ? ` · ${searchArea}` : ''}
              {includeSuperseded ? ' · history' : ''}
            </span>
          ) : (
            <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
              No active filter
            </span>
          )}
        </div>
        {hasActiveFilter ? (
          <button
            type="button"
            onClick={() => {
              setQuery('')
              setSearchArea('')
              setIncludeSuperseded(false)
              setResults([])
              const params = new URLSearchParams(searchParams.toString())
              params.set('study_id', studyId)
              params.delete('q')
              params.delete('domain')
              params.delete('history')
              router.replace(`${pathname}?${params.toString()}`, { scroll: false })
            }}
            className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
          >
            Clear filter
          </button>
        ) : null}
      </div>
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
