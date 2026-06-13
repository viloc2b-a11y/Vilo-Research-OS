'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { subjectChartTabPath } from '@/lib/ops/paths'
import {
  SIGNAL_KIND,
  type LabSignal,
} from '@/lib/longitudinal-labs/longitudinal-lab-types'
import type { LabResultWithSignals } from '@/lib/longitudinal-labs/load-study-lab-results'
import { LabSignalBadge } from './lab-signal-badge'

type SubjectOption = {
  id: string
  label: string
}

type FilterOptions = {
  labTests: string[]
  labCategories: string[]
}

type StudyLabsSearchCenterProps = {
  studyId: string
  subjects: SubjectOption[]
}

function formatDate(d: string | null): string {
  if (!d) return '—'
  try {
    return new Date(d).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  } catch {
    return d
  }
}

function formatRange(low: number | null, high: number | null): string {
  if (low == null && high == null) return '—'
  if (low == null) return `≤ ${high}`
  if (high == null) return `≥ ${low}`
  return `${low} – ${high}`
}

const SIGNAL_FILTER_OPTIONS = [
  { value: SIGNAL_KIND.OUT_OF_RANGE, label: 'Out of Range' },
  { value: SIGNAL_KIND.CLINICALLY_SIGNIFICANT, label: 'Clinically Significant' },
  { value: SIGNAL_KIND.TREND_UP, label: 'Trend Up' },
  { value: SIGNAL_KIND.TREND_DOWN, label: 'Trend Down' },
  { value: SIGNAL_KIND.RAPID_CHANGE, label: 'Rapid Change' },
] as const

type Filters = {
  search: string
  subjectId: string
  labTestCode: string
  labCategory: string
  dateFrom: string
  dateTo: string
  signalKinds: string[]
}

const EMPTY_FILTERS: Filters = {
  search: '',
  subjectId: '',
  labTestCode: '',
  labCategory: '',
  dateFrom: '',
  dateTo: '',
  signalKinds: [],
}

export function StudyLabsSearchCenter({
  studyId,
  subjects,
}: StudyLabsSearchCenterProps) {
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS)
  const [results, setResults] = useState<LabResultWithSignals[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [filterOptions, setFilterOptions] = useState<FilterOptions>({
    labTests: [],
    labCategories: [],
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hasLoaded, setHasLoaded] = useState(false)
  const abortRef = useRef<AbortController | null>(null)

  const fetchResults = useCallback(
    async (currentFilters: Filters) => {
      abortRef.current?.abort()
      const abort = new AbortController()
      abortRef.current = abort

      setLoading(true)
      setError(null)

      try {
        const params = new URLSearchParams()
        if (currentFilters.search) params.set('search', currentFilters.search)
        if (currentFilters.subjectId) params.set('subjectId', currentFilters.subjectId)
        if (currentFilters.labTestCode) params.set('labTestCode', currentFilters.labTestCode)
        if (currentFilters.labCategory) params.set('labCategory', currentFilters.labCategory)
        if (currentFilters.dateFrom) params.set('dateFrom', currentFilters.dateFrom)
        if (currentFilters.dateTo) params.set('dateTo', currentFilters.dateTo)
        for (const sk of currentFilters.signalKinds) {
          params.append('signalKind', sk)
        }

        const res = await fetch(
          `/api/study-workspace/${studyId}/labs?${params.toString()}`,
          { signal: abort.signal },
        )

        if (!res.ok) {
          const body = await res.json().catch(() => ({}))
          throw new Error(body.error ?? `Request failed (${res.status})`)
        }

        const data = await res.json()
        setResults(data.results ?? [])
        setTotalCount(data.totalCount ?? 0)
        setFilterOptions(data.filterOptions ?? { labTests: [], labCategories: [] })
        setHasLoaded(true)
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') return
        setError(err instanceof Error ? err.message : 'Failed to load results')
      } finally {
        setLoading(false)
      }
    },
    [studyId],
  )

  useEffect(() => {
    fetchResults(EMPTY_FILTERS)
    return () => abortRef.current?.abort()
  }, [fetchResults])

  function updateFilter(key: keyof Filters, value: string | string[]) {
    setFilters((prev) => ({ ...prev, [key]: value }))
  }

  function applyFilters() {
    fetchResults(filters)
  }

  function clearFilters() {
    setFilters(EMPTY_FILTERS)
    fetchResults(EMPTY_FILTERS)
  }

  function toggleSignalKind(kind: string) {
    setFilters((prev) => {
      const has = prev.signalKinds.includes(kind)
      return {
        ...prev,
        signalKinds: has
          ? prev.signalKinds.filter((k) => k !== kind)
          : [...prev.signalKinds, kind],
      }
    })
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') applyFilters()
  }

  return (
    <div className="flex flex-col h-full gap-4">
      {/* Filter bar */}
      <div className="flex flex-wrap items-end gap-3 rounded-lg border bg-card p-4">
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">
            Search
          </label>
          <input
            type="text"
            value={filters.search}
            onChange={(e) => updateFilter('search', e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Test name, code..."
            className="h-8 w-48 rounded-md border border-input bg-background px-2 text-xs"
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">
            Subject
          </label>
          <select
            value={filters.subjectId}
            onChange={(e) => updateFilter('subjectId', e.target.value)}
            className="h-8 w-40 rounded-md border border-input bg-background px-2 text-xs"
          >
            <option value="">All subjects</option>
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">
            Lab Test
          </label>
          <select
            value={filters.labTestCode}
            onChange={(e) => updateFilter('labTestCode', e.target.value)}
            className="h-8 w-36 rounded-md border border-input bg-background px-2 text-xs"
          >
            <option value="">All tests</option>
            {filterOptions.labTests.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">
            Category
          </label>
          <select
            value={filters.labCategory}
            onChange={(e) => updateFilter('labCategory', e.target.value)}
            className="h-8 w-32 rounded-md border border-input bg-background px-2 text-xs"
          >
            <option value="">All</option>
            {filterOptions.labCategories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">
            From
          </label>
          <input
            type="date"
            value={filters.dateFrom}
            onChange={(e) => updateFilter('dateFrom', e.target.value)}
            className="h-8 w-36 rounded-md border border-input bg-background px-2 text-xs"
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">
            To
          </label>
          <input
            type="date"
            value={filters.dateTo}
            onChange={(e) => updateFilter('dateTo', e.target.value)}
            className="h-8 w-36 rounded-md border border-input bg-background px-2 text-xs"
          />
        </div>

        <div className="flex items-end gap-3">
          <button
            onClick={applyFilters}
            disabled={loading}
            className="h-8 rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {loading ? 'Loading...' : 'Search'}
          </button>
          <button
            onClick={clearFilters}
            className="h-8 rounded-md border border-input px-3 text-xs font-medium text-muted-foreground hover:bg-accent"
          >
            Clear
          </button>
        </div>
      </div>

      {/* Signal kind toggles */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium text-muted-foreground">
          Signals:
        </span>
        {SIGNAL_FILTER_OPTIONS.map((opt) => {
          const active = filters.signalKinds.includes(opt.value)
          return (
            <button
              key={opt.value}
              onClick={() => {
                toggleSignalKind(opt.value)
              }}
              className={`rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors ${
                active
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-card text-muted-foreground border-border hover:border-primary/50'
              }`}
            >
              {opt.label}
            </button>
          )
        })}
      </div>

      {/* Error */}
      {error ? (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-xs text-red-800">
          {error}
        </div>
      ) : null}

      {/* Results table */}
      <div className="min-h-0 flex-1 overflow-auto rounded-lg border bg-card">
        {loading && !hasLoaded ? (
          <div className="flex items-center justify-center p-12">
            <p className="text-sm text-muted-foreground">Loading...</p>
          </div>
        ) : results.length === 0 && hasLoaded ? (
          <div className="flex flex-col items-center justify-center p-12">
            <p className="text-sm font-medium text-muted-foreground">
              No results found
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Try adjusting your filters.
            </p>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b bg-muted/50 text-left text-xs font-medium text-muted-foreground">
                <th className="sticky top-0 bg-muted/50 px-3 py-2">Subject</th>
                <th className="sticky top-0 bg-muted/50 px-3 py-2">Visit</th>
                <th className="sticky top-0 bg-muted/50 px-3 py-2">Collection Date</th>
                <th className="sticky top-0 bg-muted/50 px-3 py-2">Test</th>
                <th className="sticky top-0 bg-muted/50 px-3 py-2">Result</th>
                <th className="sticky top-0 bg-muted/50 px-3 py-2">Reference Range</th>
                <th className="sticky top-0 bg-muted/50 px-3 py-2">Signals</th>
              </tr>
            </thead>
            <tbody>
              {results.map((row) => (
                <tr
                  key={row.id}
                  className="border-b last:border-b-0 hover:bg-muted/30 transition-colors"
                >
                  <td className="px-3 py-2.5">
                    <Link
                      href={subjectChartTabPath(
                        studyId,
                        row.subjectId,
                        'labs',
                      )}
                      className="text-xs font-medium text-primary hover:underline"
                    >
                      {row.subjectNumber ?? '—'}
                    </Link>
                  </td>
                  <td className="px-3 py-2.5 text-xs text-foreground max-w-[160px] truncate">
                    {row.visitName ?? '—'}
                  </td>
                  <td className="px-3 py-2.5 text-xs text-foreground whitespace-nowrap">
                    {formatDate(row.collectionDate)}
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="text-xs font-medium text-foreground">
                      {row.labTestName}
                    </div>
                    <div className="text-[10px] text-muted-foreground">
                      {row.labTestCode}
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-xs text-foreground whitespace-nowrap">
                    <span className="font-medium">
                      {row.resultValue != null ? row.resultValue : '—'}
                    </span>
                    {row.resultUnit ? (
                      <span className="text-muted-foreground ml-0.5">
                        {row.resultUnit}
                      </span>
                    ) : null}
                  </td>
                  <td className="px-3 py-2.5 text-xs text-muted-foreground whitespace-nowrap">
                    {formatRange(row.referenceLow, row.referenceHigh)}
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex flex-wrap gap-1">
                      {row.signals.length > 0 ? (
                        row.signals.map((s: LabSignal, idx: number) => (
                          <LabSignalBadge
                            key={`${s.kind}-${idx}`}
                            signal={s}
                          />
                        ))
                      ) : (
                        <span className="text-[10px] text-muted-foreground">
                          —
                        </span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Footer */}
      {hasLoaded ? (
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>
            {results.length}
            {results.length !== totalCount ? ` of ${totalCount}` : ''} result
            {results.length !== 1 ? 's' : ''}
          </span>
          {totalCount > results.length ? (
            <span>Refine your filters to narrow results.</span>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
