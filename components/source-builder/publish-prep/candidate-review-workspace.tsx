'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { buttonVariants } from '@/components/ui/button'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { approvePublishCandidateAction } from '@/lib/protocol-intake-publish-prep/actions'
import { FinalReviewPanel } from '@/components/source-builder/publish-prep/final-review-panel'
import type {
  FinalReviewResult,
  PublishCandidate,
  PublishCandidateApproval,
  PublishPrepStatus,
} from '@/lib/protocol-intake-publish-prep/types'

const STATUS_LABEL: Record<
  'candidate_pending_review' | 'candidate_approved' | 'candidate_blocked',
  string
> = {
  candidate_pending_review: 'Pending final approval',
  candidate_approved: 'Candidate approved',
  candidate_blocked: 'Candidate blocked',
}

function metaLine(meta: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const v = meta[key]
    if (typeof v === 'string' && v.trim()) return v.trim()
  }
  return '—'
}

export function CandidateReviewWorkspace(props: {
  draftKey: string
  packageLabel: string
  status: PublishPrepStatus
  candidate: PublishCandidate
  finalReview: FinalReviewResult | null
  approval: PublishCandidateApproval | null
}) {
  const { draftKey, packageLabel, status, candidate, finalReview, approval } = props
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [reason, setReason] = useState('')

  const reviewStatus =
    status === 'candidate_approved'
      ? 'candidate_approved'
      : status === 'candidate_blocked'
        ? 'candidate_blocked'
        : 'candidate_pending_review'

  const canApprove =
    reviewStatus === 'candidate_pending_review'
    && finalReview?.passed === true
    && !approval
    && reason.trim().length > 0
    && !pending

  const meta = candidate.study_metadata ?? {}

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <Link
          href={`/source-builder/intake/publish-prep/${draftKey}`}
          className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}
        >
          ← Publish prep
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">
          Candidate review: {packageLabel}
        </h1>
        <p className="max-w-3xl text-sm text-muted-foreground">
          Final human gate (12E-B) before any future publish activation. Does not publish, bind,
          or mutate runtime.
        </p>
        <span className="inline-block rounded border border-red-500/30 bg-red-500/10 px-2 py-1 text-xs font-medium text-red-900 dark:text-red-200">
          Not published · Not bound · No runtime activation
        </span>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Candidate summary</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2 text-sm md:grid-cols-2">
          <p>
            <span className="font-medium text-foreground">Protocol: </span>
            {metaLine(meta, ['protocol_number', 'protocol_id'])}
          </p>
          <p>
            <span className="font-medium text-foreground">Title: </span>
            {metaLine(meta, ['protocol_title', 'title', 'brief_title'])}
          </p>
          <p>Visits: {candidate.visits.length}</p>
          <p>Procedures: {candidate.procedures.length}</p>
          <p>Composition sections: {candidate.source_composition.length}</p>
          <p>Rejected items retained: {candidate.rejected_items.length}</p>
          <p>Audit entries: {candidate.edit_history_ref.entry_count}</p>
          <p className="md:col-span-2 text-xs text-muted-foreground">
            Audit: {candidate.edit_history_ref.audit_path}
          </p>
          <p>auto_publish: {String(candidate.safety.auto_publish)}</p>
          <p>auto_bind: {String(candidate.safety.auto_bind)}</p>
          <p>runtime_mutation: {String(candidate.safety.runtime_mutation)}</p>
          <p>publish_ready: {String(candidate.publish_ready)}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Final blocking checks</CardTitle>
          <CardDescription>
            All must pass before approving the publish candidate.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FinalReviewPanel
            finalReview={finalReview}
            statusLabel={STATUS_LABEL[reviewStatus]}
          />
        </CardContent>
      </Card>

      <Card className="border-dashed">
        <CardHeader>
          <CardTitle className="text-lg">Approve publish candidate</CardTitle>
          <CardDescription>
            Writes publish_candidate_approval.json — not a live source package.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {approval ? (
            <p className="text-sm text-emerald-700 dark:text-emerald-400">
              Approved {approval.approved_at}
              {approval.approved_by ? ` · ${approval.approved_by}` : ''}
              <br />
              Reason: {approval.approval_reason}
            </p>
          ) : (
            <>
              <Textarea
                placeholder="Approval reason (required)"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={3}
                disabled={reviewStatus !== 'candidate_pending_review' || pending}
              />
              <Button
                disabled={!canApprove}
                onClick={() =>
                  startTransition(async () => {
                    await approvePublishCandidateAction({
                      draft_key: draftKey,
                      approval_reason: reason,
                    })
                    router.refresh()
                  })
                }
              >
                Approve publish candidate
              </Button>
              {!canApprove && reviewStatus === 'candidate_pending_review' ? (
                <p className="text-xs text-muted-foreground">
                  {!(finalReview?.passed)
                    ? 'Resolve final review blockers first.'
                    : !reason.trim()
                      ? 'Enter an approval reason.'
                      : null}
                </p>
              ) : null}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
