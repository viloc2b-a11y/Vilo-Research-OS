import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { BookOpen, CheckCircle, AlertTriangle, Clock } from 'lucide-react'
import type { SubjectAmendmentImpactRow } from '@/lib/subject/amendment-impacts/load-subject-amendment-impacts'

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pending',
  submitted: 'Submitted',
  irb_review: 'IRB Review',
  approved: 'IRB Approved',
  activated: 'Activated',
}

const STATUS_CLASSES: Record<string, string> = {
  pending: 'bg-slate-100 text-slate-700',
  submitted: 'bg-blue-100 text-blue-800',
  irb_review: 'bg-violet-100 text-violet-800',
  approved: 'bg-amber-100 text-amber-800',
  activated: 'bg-green-100 text-green-800',
}

type Props = {
  impacts: SubjectAmendmentImpactRow[]
  studyId: string | null
}

export function SubjectAmendmentImpactPanel({ impacts, studyId }: Props) {
  const pendingReconsent = impacts.filter((i) => i.requiresReconsent && !i.reconsentCompletedAt).length
  const pendingTraining = impacts.filter((i) => i.requiresTrainingReview && !i.trainingReviewCompletedAt).length
  const pendingCount = pendingReconsent + pendingTraining

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <BookOpen className="size-4 text-violet-500" />
          Protocol Amendments
          {pendingCount > 0 ? (
            <Badge className="bg-amber-100 text-amber-800 border-0 text-xs">
              {pendingCount} pending
            </Badge>
          ) : impacts.length > 0 ? (
            <Badge variant="secondary" className="text-xs">{impacts.length} on record</Badge>
          ) : null}
          {studyId && (
            <Link
              href={`/studies/${studyId}/amendments`}
              className="ml-auto text-xs font-medium text-primary hover:underline"
            >
              View in Amendments
            </Link>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {impacts.length === 0 ? (
          <p className="text-sm text-muted-foreground">No protocol amendments affecting this subject.</p>
        ) : (
          <ul className="space-y-2">
            {impacts.map((impact) => {
              const reconsentOk = !impact.requiresReconsent || Boolean(impact.reconsentCompletedAt)
              const trainingOk = !impact.requiresTrainingReview || Boolean(impact.trainingReviewCompletedAt)
              const allClear = reconsentOk && trainingOk

              return (
                <li key={impact.id} className="rounded-md border px-3 py-2 text-sm">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="font-mono text-xs text-slate-500">
                      {impact.protocolVersionId.slice(0, 8)}…
                    </span>
                    {impact.amendmentStatus && (
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                          STATUS_CLASSES[impact.amendmentStatus] ?? 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {STATUS_LABELS[impact.amendmentStatus] ?? impact.amendmentStatus}
                      </span>
                    )}
                    {allClear && (
                      <span className="ml-auto flex items-center gap-1 text-xs text-green-600">
                        <CheckCircle className="size-3" />
                        No action required
                      </span>
                    )}
                  </div>

                  {impact.impactReason && (
                    <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">
                      {impact.impactReason}
                    </p>
                  )}

                  {(impact.requiresReconsent || impact.requiresTrainingReview) && (
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {impact.requiresReconsent && (
                        <span
                          className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${
                            impact.reconsentCompletedAt
                              ? 'border-green-200 bg-green-50 text-green-700'
                              : 'border-red-200 bg-red-50 text-red-700'
                          }`}
                        >
                          {impact.reconsentCompletedAt ? (
                            <><CheckCircle className="size-3" /> Reconsented</>
                          ) : (
                            <><AlertTriangle className="size-3" /> Reconsent Required</>
                          )}
                        </span>
                      )}
                      {impact.requiresTrainingReview && (
                        <span
                          className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${
                            impact.trainingReviewCompletedAt
                              ? 'border-green-200 bg-green-50 text-green-700'
                              : 'border-amber-200 bg-amber-50 text-amber-700'
                          }`}
                        >
                          {impact.trainingReviewCompletedAt ? (
                            <><CheckCircle className="size-3" /> Training Done</>
                          ) : (
                            <><Clock className="size-3" /> Training Required</>
                          )}
                        </span>
                      )}
                    </div>
                  )}

                  {impact.activatedAt && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Activated{' '}
                      {new Date(impact.activatedAt).toLocaleDateString(undefined, {
                        dateStyle: 'medium',
                      })}
                    </p>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
