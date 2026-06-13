import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import type {
  SubjectLabTestEntry,
} from '@/lib/longitudinal-labs/longitudinal-lab-types'
import type { LabReportReviewTimelineItem } from '@/lib/longitudinal-labs/lab-report-review-types'
import { LabSignalBadge } from './lab-signal-badge'
import { ReviewActions } from './review-actions'

function formatValue(value: number | null, unit: string | null): string {
  if (value == null) return '—'
  return unit ? `${value} ${unit}` : String(value)
}

function formatRange(low: number | null, high: number | null): string {
  if (low == null && high == null) return '—'
  if (low == null) return `≤ ${high}`
  if (high == null) return `≥ ${low}`
  return `${low} – ${high}`
}

function formatChange(value: number | null, pct: number | null): string {
  if (value == null) return '—'
  const sign = value > 0 ? '+' : ''
  const pctStr = pct != null ? ` (${sign}${pct.toFixed(1)}%)` : ''
  return `${sign}${value}${pctStr}`
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

function LabTestRow({ entry }: { entry: SubjectLabTestEntry }) {
  return (
    <div className="flex items-start gap-4 rounded-lg border bg-card p-4">
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex items-center gap-2">
          <h4 className="font-medium text-sm">{entry.labTestName}</h4>
          <span className="text-xs text-muted-foreground">
            ({entry.labTestCode})
          </span>
          {entry.signals.length > 0 ? (
            <div className="flex flex-wrap gap-1">
              {entry.signals.map((signal, idx) => (
                <LabSignalBadge key={`${signal.kind}-${idx}`} signal={signal} />
              ))}
            </div>
          ) : null}
        </div>

        <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
          <div>
            <span className="text-muted-foreground">Latest:</span>{' '}
            <span className="font-medium">
              {formatValue(
                entry.latestResult?.resultValue ?? null,
                entry.latestResult?.resultUnit ?? null,
              )}
            </span>
          </div>
          <div>
            <span className="text-muted-foreground">Reference:</span>{' '}
            {formatRange(
              entry.latestResult?.referenceLow ?? null,
              entry.latestResult?.referenceHigh ?? null,
            )}
          </div>
          <div>
            <span className="text-muted-foreground">Baseline:</span>{' '}
            {formatValue(
              entry.baselineResult?.resultValue ?? null,
              entry.baselineResult?.resultUnit ?? null,
            )}
          </div>
          <div>
            <span className="text-muted-foreground">Change:</span>{' '}
            {formatChange(
              entry.changeFromBaseline,
              entry.percentChangeFromBaseline,
            )}
          </div>
        </div>

        <div className="flex gap-3 text-xs text-muted-foreground">
          <span>{entry.resultCount} result{entry.resultCount !== 1 ? 's' : ''}</span>
          {entry.latestResult?.collectionDate ? (
            <span>Last: {formatDate(entry.latestResult.collectionDate)}</span>
          ) : null}
        </div>
      </div>
    </div>
  )
}

function ReviewRow({ review }: { review: LabReportReviewTimelineItem }) {
  const statusLabels: Record<string, string> = {
    pending_review: 'Pending Review',
    under_review: 'Under Review',
    reviewed: 'Reviewed',
    rejected: 'Rejected',
  }

  const piLabels: Record<string, string> = {
    cs: 'CS',
    ncs: 'NCS',
    follow_up_required: 'Follow-Up Required',
  }

  return (
    <div className="flex items-start gap-4 rounded-lg border bg-card p-4">
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center rounded-full border bg-blue-50 px-2 py-0.5 text-[10px] font-medium text-blue-700 border-blue-200">
            Lab Report
          </span>
          <span className="text-xs font-medium">
            {review.documentFileName ?? 'Scanned Report'}
          </span>
          <span className="text-[10px] rounded-full border px-2 py-0.5 text-muted-foreground">
            {review.reportType === 'scanned' ? 'Scanned PDF' : 'Extractable'}
          </span>
          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${
            review.reviewStatus === 'reviewed'
              ? 'bg-green-50 text-green-700 border-green-200'
              : review.reviewStatus === 'rejected'
              ? 'bg-red-50 text-red-700 border-red-200'
              : review.reviewStatus === 'under_review'
              ? 'bg-yellow-50 text-yellow-700 border-yellow-200'
              : 'bg-gray-50 text-gray-700 border-gray-200'
          } border`}>
            {statusLabels[review.reviewStatus] ?? review.reviewStatus}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
          {review.visitName || review.visitId ? (
            <div>
              <span className="text-muted-foreground">Visit:</span>{' '}
              <span className="font-medium">{review.visitName ?? review.visitId}</span>
            </div>
          ) : null}
          {review.piClassification ? (
            <div>
              <span className="text-muted-foreground">PI Classification:</span>{' '}
              <span className="font-medium">
                {piLabels[review.piClassification] ?? review.piClassification}
              </span>
            </div>
          ) : (
            <div>
              <span className="text-muted-foreground">PI Classification:</span>{' '}
              <span className="text-muted-foreground">—</span>
            </div>
          )}
          {review.reviewedAt ? (
            <div>
              <span className="text-muted-foreground">Reviewed:</span>{' '}
              <span>{formatDate(review.reviewedAt)}</span>
            </div>
          ) : null}
          {review.signatureRequestId ? (
            <div>
              <span className="text-muted-foreground">Signoff:</span>{' '}
              <span className="font-medium text-green-600">Signature requested</span>
            </div>
          ) : null}
        </div>

        <div className="flex gap-3 text-xs text-muted-foreground">
          <span>Report uploaded {formatDate(review.createdAt)}</span>
        </div>
      </div>

      <ReviewActions
        reviewId={review.reviewId}
        organizationId={review.organizationId}
        studyId={review.studyId}
        initialStatus={review.reviewStatus}
        initialClassification={review.piClassification}
        initialNotes={review.reviewNotes}
        signatureRequestId={review.signatureRequestId}
      />
    </div>
  )
}

export function SubjectLabTimeline({
  tests,
  reviews,
}: {
  tests: SubjectLabTestEntry[]
  reviews: LabReportReviewTimelineItem[]
}) {
  const hasTests = tests.length > 0
  const hasReviews = reviews.length > 0

  if (!hasTests && !hasReviews) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Labs</CardTitle>
          <CardDescription>
            No lab results or report reviews recorded for this subject.
          </CardDescription>
        </CardHeader>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Labs</h2>
        <p className="text-sm text-muted-foreground">
          Structured lab results with automated signal detection.
        </p>
      </div>

      {hasTests ? (
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-muted-foreground">
            Structured Results ({tests.length})
          </h3>
          {tests.map((entry) => (
            <LabTestRow key={entry.labTestCode} entry={entry} />
          ))}
        </div>
      ) : null}

      {hasReviews ? (
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-muted-foreground">
            Lab Report Reviews ({reviews.length})
          </h3>
          {reviews.map((review) => (
            <ReviewRow key={review.reviewId} review={review} />
          ))}
        </div>
      ) : null}
    </div>
  )
}
