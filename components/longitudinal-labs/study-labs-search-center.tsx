'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { subjectChartTabPath } from '@/lib/ops/paths'
import {
  SIGNAL_KIND,
  type LabSignal,
} from '@/lib/longitudinal-labs/longitudinal-lab-types'
import type {
  LabResultWithSignals,
  LabReportReviewSearchItem,
  StudyLabSearchItem,
} from '@/lib/longitudinal-labs/load-study-lab-results'
import { LabSignalBadge } from './lab-signal-badge'

type SubjectOption = {
  id: string
  label: string
}

type FilterOptions = {
  labTests: string[]
  labCategories: string[]
  reviewStatuses: string[]
  piClassifications: string[]
  reportTypes: string[]
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

const STATUS_LABELS: Record<string, string> = {
  pending_review: 'Pending Review',
  under_review: 'Under Review',
  reviewed: 'Reviewed',
  rejected: 'Rejected',
}

const PI_LABELS: Record<string, string> = {
  cs: 'CS',
  ncs: 'NCS',
  follow_up_required: 'Follow-Up Required',
}

type Filters = {
  search: string
  subjectId: string
  labTestCode: string
  labCategory: string
  dateFrom: string
  dateTo: string
  signalKinds: string[]
  reviewStatus: string
  piClassification: string
  reportType: string
}

const EMPTY_FILTERS: Filters = {
  search: '',
  subjectId: '',
  labTestCode: '',
  labCategory: '',
  dateFrom: '',
  dateTo: '',
  signalKinds: [],
  reviewStatus: '',
  piClassification: '',
  reportType: '',
}

function isReviewItem(
  item: StudyLabSearchItem,
): item is LabReportReviewSearchItem {
  return 'resultType' in item && item.resultType === 'lab_report_review'
}

function isStructuredItem(
  item: StudyLabSearchItem,
): item is LabResultWithSignals {
  return 'resultType' in item && item.resultType === 'structured_result'
}

export function StudyLabsSearchCenter({
  studyId,
  subjects,
}: StudyLabsSearchCenterProps) {
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS)
  const [results, setResults] = useState<StudyLabSearchItem[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [filterOptions, setFilterOptions] = useState<FilterOptions>({
    labTests: [],
    labCategories: [],
    reviewStatuses: [],
    piClassifications: [],
    reportTypes: [],
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
        if (currentFilters.reviewStatus) params.set('reviewStatus', currentFilters.reviewStatus)
        if (currentFilters.piClassification) params.set('piClassification', currentFilters.piClassification)
        if (currentFilters.reportType) params.set('reportType', currentFilters.reportType)

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
        setFilterOptions(data.filterOptions ?? {
          labTests: [],
          labCategories: [],
          reviewStatuses: [],
          piClassifications: [],
          reportTypes: [],
        })
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

  const structuredCount = results.filter(isStructuredItem).length
  const reviewCount = results.filter(isReviewItem).length

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

      {/* Review filters */}
      {filterOptions.reviewStatuses.length > 0 ||
      filterOptions.piClassifications.length > 0 ||
      filterOptions.reportTypes.length > 0 ? (
        <div className="flex flex-wrap items-end gap-3 rounded-lg border bg-muted/30 p-3">
          {filterOptions.reviewStatuses.length > 0 ? (
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">
                Review Status
              </label>
              <select
                value={filters.reviewStatus}
                onChange={(e) => updateFilter('reviewStatus', e.target.value)}
                className="h-7 w-40 rounded-md border border-input bg-background px-2 text-[11px]"
              >
                <option value="">All statuses</option>
                {filterOptions.reviewStatuses.map((s) => (
                  <option key={s} value={s}>
                    {STATUS_LABELS[s] ?? s}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
          {filterOptions.piClassifications.length > 0 ? (
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">
                PI Classification
              </label>
              <select
                value={filters.piClassification}
                onChange={(e) => updateFilter('piClassification', e.target.value)}
                className="h-7 w-36 rounded-md border border-input bg-background px-2 text-[11px]"
              >
                <option value="">All</option>
                {filterOptions.piClassifications.map((c) => (
                  <option key={c} value={c}>
                    {PI_LABELS[c] ?? c}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
          {filterOptions.reportTypes.length > 0 ? (
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">
                Report Type
              </label>
              <select
                value={filters.reportType}
                onChange={(e) => updateFilter('reportType', e.target.value)}
                className="h-7 w-32 rounded-md border border-input bg-background px-2 text-[11px]"
              >
                <option value="">All</option>
                {filterOptions.reportTypes.map((t) => (
                  <option key={t} value={t}>
                    {t === 'scanned' ? 'Scanned PDF' : 'Extractable'}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
        </div>
      ) : null}

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
                <th className="sticky top-0 bg-muted/50 px-3 py-2">Type</th>
                <th className="sticky top-0 bg-muted/50 px-3 py-2">Subject</th>
                <th className="sticky top-0 bg-muted/50 px-3 py-2">Visit</th>
                <th className="sticky top-0 bg-muted/50 px-3 py-2">Collection Date</th>
                <th className="sticky top-0 bg-muted/50 px-3 py-2">Test / Document</th>
                <th className="sticky top-0 bg-muted/50 px-3 py-2">Result</th>
                <th className="sticky top-0 bg-muted/50 px-3 py-2">Reference Range</th>
                <th className="sticky top-0 bg-muted/50 px-3 py-2">Status</th>
                <th className="sticky top-0 bg-muted/50 px-3 py-2">Signals</th>
              </tr>
            </thead>
            <tbody>
              {results.map((row) => {
                if (isReviewItem(row)) {
                  return (
                    <tr
                      key={`review-${row.id}`}
                      className="border-b last:border-b-0 hover:bg-muted/30 transition-colors"
                    >
                      <td className="px-3 py-2.5">
                        <span className="inline-flex items-center rounded-full border bg-blue-50 px-2 py-0.5 text-[10px] font-medium text-blue-700 border-blue-200 whitespace-nowrap">
                          Review
                        </span>
                      </td>
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
                        {formatDate(row.createdAt)}
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="text-xs text-foreground max-w-[200px] truncate">
                          {row.documentFileName ?? '—'}
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-xs text-muted-foreground">
                        <span className="text-[10px] italic">Manual review</span>
                      </td>
                      <td className="px-3 py-2.5 text-xs text-muted-foreground">
                        —
                      </td>
                      <td className="px-3 py-2.5">
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium border ${
                          row.reviewStatus === 'reviewed'
                            ? 'bg-green-50 text-green-700 border-green-200'
                            : row.reviewStatus === 'rejected'
                            ? 'bg-red-50 text-red-700 border-red-200'
                            : row.reviewStatus === 'under_review'
                            ? 'bg-yellow-50 text-yellow-700 border-yellow-200'
                            : 'bg-gray-50 text-gray-700 border-gray-200'
                        }`}>
                          {STATUS_LABELS[row.reviewStatus] ?? row.reviewStatus}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-[10px] text-muted-foreground">
                        —
                      </td>
                    </tr>
                  )
                }

                const structured = row as LabResultWithSignals
                return (
                  <tr
                    key={structured.id}
                    className="border-b last:border-b-0 hover:bg-muted/30 transition-colors"
                  >
                    <td className="px-3 py-2.5">
                      <span className="inline-flex items-center rounded-full border bg-green-50 px-2 py-0.5 text-[10px] font-medium text-green-700 border-green-200 whitespace-nowrap">
                        Result
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
                      <Link
                        href={subjectChartTabPath(
                          studyId,
                          structured.subjectId,
                          'labs',
                        )}
                        className="text-xs font-medium text-primary hover:underline"
                      >
                        {structured.subjectNumber ?? '—'}
                      </Link>
                    </td>
                    <td className="px-3 py-2.5 text-xs text-foreground max-w-[160px] truncate">
                      {structured.visitName ?? '—'}
                    </td>
                    <td className="px-3 py-2.5 text-xs text-foreground whitespace-nowrap">
                      {formatDate(structured.collectionDate)}
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="text-xs font-medium text-foreground">
                        {structured.labTestName}
                      </div>
                      <div className="text-[10px] text-muted-foreground">
                        {structured.labTestCode}
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-xs text-foreground whitespace-nowrap">
                      <span className="font-medium">
                        {structured.resultValue != null ? structured.resultValue : '—'}
                      </span>
                      {structured.resultUnit ? (
                        <span className="text-muted-foreground ml-0.5">
                          {structured.resultUnit}
                        </span>
                      ) : null}
                    </td>
                    <td className="px-3 py-2.5 text-xs text-muted-foreground whitespace-nowrap">
                      {formatRange(structured.referenceLow, structured.referenceHigh)}
                    </td>
                    <td className="px-3 py-2.5 text-xs text-muted-foreground">
                      —
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex flex-wrap gap-1">
                        {structured.signals.length > 0 ? (
                          structured.signals.map((s: LabSignal, idx: number) => (
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
                )
              })}
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
            {structuredCount > 0 || reviewCount > 0
              ? ` (${structuredCount} structured, ${reviewCount} reviews)`
              : ''}
          </span>
          {totalCount > results.length ? (
            <span>Refine your filters to narrow results.</span>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
