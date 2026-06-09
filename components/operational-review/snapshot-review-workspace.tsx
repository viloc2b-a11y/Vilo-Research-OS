'use client'

import { useEffect, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import type { LoadedSnapshotReviewWorkspace } from '@/lib/operational-review/operational-review-types'
import { CompleteReviewButton } from './complete-review-button'
import { CreateReviewPanel } from './create-review-panel'
import { OpenQueryPanel } from './open-query-panel'
import { QueryEventTimeline } from './query-event-timeline'
import { QueryList } from './query-list'
import { ReviewStatusBanner } from './review-status-banner'

type SnapshotReviewWorkspaceProps = {
  organizationId: string
  snapshotId: string
  refreshKey: number
  onUpdated: () => void
}

export function SnapshotReviewWorkspace({
  organizationId,
  snapshotId,
  refreshKey,
  onUpdated,
}: SnapshotReviewWorkspaceProps) {
  const router = useRouter()
  const pathname = usePathname()
  const currentSearchParams = useSearchParams()
  const [workspace, setWorkspace] = useState<LoadedSnapshotReviewWorkspace | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const querySearch = currentSearchParams.get('query_q') ?? ''
  const hasActiveFilter = Boolean(querySearch.trim())

  function updateQuerySearch(value: string) {
    const nextValue = value.trim()
    const params = new URLSearchParams(currentSearchParams.toString())
    if (nextValue) params.set('query_q', nextValue)
    else params.delete('query_q')
    const nextUrl = params.toString() ? `${pathname}?${params.toString()}` : pathname
    router.replace(nextUrl, { scroll: false })
  }

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch(
          `/api/operational-review/workspace/${encodeURIComponent(snapshotId)}?organization_id=${encodeURIComponent(organizationId)}&query_q=${encodeURIComponent(querySearch)}`,
        )
        const data = (await res.json()) as LoadedSnapshotReviewWorkspace & { error?: string }
        if (!res.ok) throw new Error(data.error || 'Failed to load workspace')
        if (!cancelled) {
          setWorkspace({
            snapshot: data.snapshot,
            review: data.review ?? null,
            queries: data.queries ?? [],
            events: data.events ?? [],
          })
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load workspace')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [organizationId, snapshotId, querySearch, refreshKey])

  if (loading) return <p className="text-sm text-slate-500">Loading review workspace…</p>
  if (error) return <p className="text-sm text-red-600">{error}</p>
  if (!workspace) return <p className="text-sm text-slate-500">Workspace not found.</p>

  const { snapshot, review, queries, events } = workspace
  const reviewActive =
    review?.reviewStatus === 'in_review' || review?.reviewStatus === 'queries_open'
  const reviewComplete = review?.reviewStatus === 'completed'

  const procedureOptions = snapshot.snapshotJson.procedures.map((procedure) => ({
    procedureInstanceId: procedure.procedure_instance_id,
    procedureCode: procedure.procedure_code,
    procedureName: procedure.procedure_name,
    fields: Object.keys(procedure.field_values).map((fieldId) => ({
      field_id: fieldId,
      label: fieldId,
    })),
  }))

  return (
    <div className="space-y-6">
      <ReviewStatusBanner review={review} snapshotHash={snapshot.snapshotHash} />

      <div className="rounded-md border border-slate-200 bg-white p-4 text-sm">
        <h2 className="font-semibold text-slate-900">
          {snapshot.snapshotJson.visit_instance.visit_code} ·{' '}
          {snapshot.snapshotJson.visit_instance.visit_name}
        </h2>
        <p className="mt-1 text-xs text-slate-500">
          Subject {snapshot.subjectId.slice(0, 8)}… · locked{' '}
          {new Date(snapshot.lockedAt).toLocaleString()}
        </p>
      </div>

      <CreateReviewPanel
        organizationId={organizationId}
        studyId={snapshot.studyId}
        subjectId={snapshot.subjectId}
        snapshotId={snapshot.id}
        hasReview={Boolean(review)}
        reviewId={review?.id ?? null}
        reviewStatus={review?.reviewStatus ?? null}
        onUpdated={onUpdated}
      />

      {reviewActive ? (
        <>
          <OpenQueryPanel
            organizationId={organizationId}
            studyId={snapshot.studyId}
            subjectId={snapshot.subjectId}
            snapshotId={snapshot.id}
            reviewId={review?.id ?? null}
            procedures={procedureOptions}
            onOpened={onUpdated}
          />
          <section>
            <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-slate-800">Queries</h3>
                <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  Filter status
                </span>
                {hasActiveFilter ? (
                  <span className="inline-flex items-center rounded-full bg-teal-50 px-2.5 py-1 text-xs font-semibold text-teal-800 ring-1 ring-inset ring-teal-200">
                    Active: {querySearch}
                  </span>
                ) : (
                  <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
                    No active filter
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={querySearch}
                  onChange={(e) => updateQuerySearch(e.target.value)}
                  placeholder="Search queries..."
                  className="h-9 w-[220px] rounded border border-slate-300 px-3 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
                />
                {querySearch ? (
                  <button
                    type="button"
                    className="h-9 rounded border border-slate-300 px-3 text-xs font-medium text-slate-700 hover:bg-slate-50"
                    onClick={() => updateQuerySearch('')}
                  >
                    Clear
                  </button>
                ) : null}
              </div>
            </div>
            <QueryList
              queries={queries}
              organizationId={organizationId}
              onUpdated={onUpdated}
              searchQuery={querySearch}
            />
          </section>
          {review?.id ? (
            <CompleteReviewButton
              onComplete={async () => {
                const res = await fetch(
                  `/api/operational-review/reviews/${encodeURIComponent(review.id)}/complete`,
                  {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ organization_id: organizationId }),
                  },
                )
                const data = (await res.json()) as { error?: string }
                if (!res.ok) throw new Error(data.error || 'Failed to complete review')
                onUpdated()
              }}
            />
          ) : null}
        </>
      ) : null}

      {reviewComplete ? (
        <p className="text-sm text-emerald-800">Review complete.</p>
      ) : null}

      <section>
        <h3 className="mb-2 text-sm font-semibold text-slate-800">Query timeline</h3>
        <QueryEventTimeline events={events} />
      </section>
    </div>
  )
}
