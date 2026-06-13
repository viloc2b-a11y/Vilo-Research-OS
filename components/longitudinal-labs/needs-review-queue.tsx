'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import type { NeedsReviewQueueItem, NeedsReviewQueueResponse } from '@/lib/longitudinal-labs/load-needs-review-queue'

type NeedsReviewQueueProps = {
  studyId: string
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

const PRIORITY_LABELS: Record<string, string> = {
  high: 'High',
  medium: 'Medium',
  low: 'Low',
}

const PRIORITY_STYLES: Record<string, string> = {
  high: 'bg-red-50 text-red-700 border-red-200',
  medium: 'bg-yellow-50 text-yellow-700 border-yellow-200',
  low: 'bg-blue-50 text-blue-700 border-blue-200',
}

const TYPE_LABELS: Record<string, string> = {
  signal: 'Signal',
  review: 'Review',
  signature: 'Signature',
}

const STATUS_LABELS: Record<string, string> = {
  out_of_range: 'Out of Range',
  clinically_significant: 'Clinically Significant',
  trend_up: 'Trend Up',
  trend_down: 'Trend Down',
  rapid_change: 'Rapid Change',
  pending_review: 'Pending Review',
  under_review: 'Under Review',
  signature_pending: 'Signature Pending',
}

type Filters = {
  priority: string
  type: string
  status: string
  subjectId: string
}

const EMPTY_FILTERS: Filters = {
  priority: '',
  type: '',
  status: '',
  subjectId: '',
}

export function NeedsReviewQueue({ studyId }: NeedsReviewQueueProps) {
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS)
  const [data, setData] = useState<NeedsReviewQueueResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hasLoaded, setHasLoaded] = useState(false)
  const abortRef = useRef<AbortController | null>(null)

  const fetchQueue = useCallback(
    async (currentFilters: Filters) => {
      abortRef.current?.abort()
      const abort = new AbortController()
      abortRef.current = abort

      setLoading(true)
      setError(null)

      try {
        const params = new URLSearchParams()
        if (currentFilters.priority) params.set('priority', currentFilters.priority)
        if (currentFilters.type) params.set('type', currentFilters.type)
        if (currentFilters.status) params.set('status', currentFilters.status)
        if (currentFilters.subjectId) params.set('subjectId', currentFilters.subjectId)

        const res = await fetch(
          `/api/study-workspace/${studyId}/needs-review?${params.toString()}`,
          { signal: abort.signal },
        )

        if (!res.ok) {
          const body = await res.json().catch(() => ({}))
          throw new Error(body.error ?? `Request failed (${res.status})`)
        }

        const json = await res.json()
        setData(json)
        setHasLoaded(true)
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') return
        setError(err instanceof Error ? err.message : 'Failed to load queue')
      } finally {
        setLoading(false)
      }
    },
    [studyId],
  )

  useEffect(() => {
    fetchQueue(EMPTY_FILTERS)
    return () => abortRef.current?.abort()
  }, [fetchQueue])

  function updateFilter(key: keyof Filters, value: string) {
    setFilters((prev) => ({ ...prev, [key]: value }))
  }

  function applyFilters() {
    fetchQueue(filters)
  }

  function clearFilters() {
    setFilters(EMPTY_FILTERS)
    fetchQueue(EMPTY_FILTERS)
  }

  const counts = data?.counts ?? { high: 0, medium: 0, low: 0 }

  return (
    <div className="flex flex-col h-full gap-4">
      {/* Count badges */}
      <div className="flex items-center gap-3">
        <span className="text-xs font-medium text-muted-foreground">Priority:</span>
        <span className="inline-flex items-center rounded-full border border-red-200 bg-red-50 px-2.5 py-0.5 text-xs font-medium text-red-700">
          High {counts.high}
        </span>
        <span className="inline-flex items-center rounded-full border border-yellow-200 bg-yellow-50 px-2.5 py-0.5 text-xs font-medium text-yellow-700">
          Medium {counts.medium}
        </span>
        <span className="inline-flex items-center rounded-full border border-blue-200 bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700">
          Low {counts.low}
        </span>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-end gap-3 rounded-lg border bg-card p-4">
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Priority</label>
          <select
            value={filters.priority}
            onChange={(e) => updateFilter('priority', e.target.value)}
            className="h-8 w-28 rounded-md border border-input bg-background px-2 text-xs"
          >
            <option value="">All</option>
            {data?.filterOptions.priorities.map((p) => (
              <option key={p} value={p}>{PRIORITY_LABELS[p] ?? p}</option>
            )) ?? null}
          </select>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Type</label>
          <select
            value={filters.type}
            onChange={(e) => updateFilter('type', e.target.value)}
            className="h-8 w-28 rounded-md border border-input bg-background px-2 text-xs"
          >
            <option value="">All</option>
            {data?.filterOptions.types.map((t) => (
              <option key={t} value={t}>{TYPE_LABELS[t] ?? t}</option>
            )) ?? null}
          </select>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Status</label>
          <select
            value={filters.status}
            onChange={(e) => updateFilter('status', e.target.value)}
            className="h-8 w-36 rounded-md border border-input bg-background px-2 text-xs"
          >
            <option value="">All</option>
            {data?.filterOptions.statuses.map((s) => (
              <option key={s} value={s}>{STATUS_LABELS[s] ?? s}</option>
            )) ?? null}
          </select>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Subject</label>
          <select
            value={filters.subjectId}
            onChange={(e) => updateFilter('subjectId', e.target.value)}
            className="h-8 w-32 rounded-md border border-input bg-background px-2 text-xs"
          >
            <option value="">All</option>
            {data?.filterOptions.subjects.map((s) => (
              <option key={s.id} value={s.id}>{s.label}</option>
            )) ?? null}
          </select>
        </div>

        <div className="flex items-end gap-2">
          <button
            onClick={applyFilters}
            disabled={loading}
            className="h-8 rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {loading ? 'Loading...' : 'Filter'}
          </button>
          <button
            onClick={clearFilters}
            className="h-8 rounded-md border border-input px-3 text-xs font-medium text-muted-foreground hover:bg-accent"
          >
            Clear
          </button>
        </div>
      </div>

      {/* Error */}
      {error ? (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-xs text-red-800">{error}</div>
      ) : null}

      {/* Table */}
      <div className="min-h-0 flex-1 overflow-auto rounded-lg border bg-card">
        {loading && !hasLoaded ? (
          <div className="flex items-center justify-center p-12">
            <p className="text-sm text-muted-foreground">Loading...</p>
          </div>
        ) : data && data.items.length === 0 && hasLoaded ? (
          <div className="flex flex-col items-center justify-center p-12">
            <p className="text-sm font-medium text-muted-foreground">No items need review</p>
            <p className="text-xs text-muted-foreground mt-1">All lab items are up to date.</p>
          </div>
        ) : data ? (
          <table className="w-full">
            <thead>
              <tr className="border-b bg-muted/50 text-left text-xs font-medium text-muted-foreground">
                <th className="sticky top-0 bg-muted/50 px-3 py-2">Priority</th>
                <th className="sticky top-0 bg-muted/50 px-3 py-2">Subject</th>
                <th className="sticky top-0 bg-muted/50 px-3 py-2">Visit</th>
                <th className="sticky top-0 bg-muted/50 px-3 py-2">Type</th>
                <th className="sticky top-0 bg-muted/50 px-3 py-2">Description</th>
                <th className="sticky top-0 bg-muted/50 px-3 py-2">Status</th>
                <th className="sticky top-0 bg-muted/50 px-3 py-2">Created</th>
                <th className="sticky top-0 bg-muted/50 px-3 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((item) => (
                <tr
                  key={item.queueItemId}
                  className="border-b last:border-b-0 hover:bg-muted/30 transition-colors"
                >
                  <td className="px-3 py-2.5">
                    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium ${PRIORITY_STYLES[item.priority] ?? ''}`}>
                      {PRIORITY_LABELS[item.priority] ?? item.priority}
                    </span>
                  </td>
                  <td className="px-3 py-2.5">
                    <Link
                      href={item.subjectUrl}
                      className="text-xs font-medium text-primary hover:underline"
                    >
                      {item.subjectIdentifier ?? '—'}
                    </Link>
                  </td>
                  <td className="px-3 py-2.5 text-xs text-foreground max-w-[120px] truncate">
                    {item.visitId ?? '—'}
                  </td>
                  <td className="px-3 py-2.5">
                    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium ${
                      item.sourceType === 'signal'
                        ? 'bg-purple-50 text-purple-700 border-purple-200'
                        : item.sourceType === 'review'
                        ? 'bg-blue-50 text-blue-700 border-blue-200'
                        : 'bg-amber-50 text-amber-700 border-amber-200'
                    }`}>
                      {TYPE_LABELS[item.sourceType] ?? item.sourceType}
                    </span>
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="text-xs text-foreground max-w-[280px] truncate" title={item.description}>
                      {item.title}
                    </div>
                    <div className="text-[10px] text-muted-foreground truncate max-w-[280px]" title={item.description}>
                      {item.description}
                    </div>
                  </td>
                  <td className="px-3 py-2.5">
                    <span className="text-[10px] text-muted-foreground">
                      {STATUS_LABELS[item.status] ?? item.status}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-xs text-muted-foreground whitespace-nowrap">
                    {formatDate(item.createdAt)}
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-1">
                      <Link
                        href={item.subjectUrl}
                        className="h-6 rounded-md border border-input bg-background px-2 text-[10px] font-medium text-foreground hover:bg-accent inline-flex items-center"
                      >
                        Subject
                      </Link>
                      <Link
                        href={item.reviewUrl}
                        className="h-6 rounded-md bg-primary px-2 text-[10px] font-medium text-primary-foreground hover:bg-primary/90 inline-flex items-center"
                      >
                        Review
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}
      </div>

      {/* Footer */}
      {hasLoaded && data ? (
        <div className="text-xs text-muted-foreground">
          {data.items.length} item{data.items.length !== 1 ? 's' : ''} need review
        </div>
      ) : null}
    </div>
  )
}
