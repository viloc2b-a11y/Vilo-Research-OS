'use client'

import type { VisitSnapshotReviewRow } from '@/lib/operational-review/operational-review-types'

type ReviewStatusBannerProps = {
  review: VisitSnapshotReviewRow | null
  snapshotHash: string
}

export function ReviewStatusBanner({ review, snapshotHash }: ReviewStatusBannerProps) {
  return (
    <div className="rounded-md border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
      <p className="font-medium">Review locked visit</p>
      <p className="mt-1 font-mono text-xs text-slate-500 break-all">Snapshot hash: {snapshotHash}</p>
      {review ? (
        <p className="mt-1 text-xs text-slate-600">
          Review status: {review.reviewStatus} · type: {review.reviewType}
        </p>
      ) : (
        <p className="mt-1 text-xs text-slate-600">No operational review started yet.</p>
      )}
    </div>
  )
}
