'use client'

import { useEffect, useState } from 'react'
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
  const [workspace, setWorkspace] = useState<LoadedSnapshotReviewWorkspace | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch(
          `/api/operational-review/workspace/${encodeURIComponent(snapshotId)}?organization_id=${encodeURIComponent(organizationId)}`,
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
  }, [organizationId, snapshotId, refreshKey])

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
            <h3 className="mb-2 text-sm font-semibold text-slate-800">Queries</h3>
            <QueryList
              queries={queries}
              organizationId={organizationId}
              onUpdated={onUpdated}
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
