'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { buttonVariants } from '@/components/ui/button'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { createPublishCandidateAction } from '@/lib/protocol-intake-publish-prep/actions'
import { PUBLISH_PREP_SAFETY } from '@/lib/protocol-intake-publish-prep/types'
import type { PublishCandidate, PublishPrepStatus, PreflightResult } from '@/lib/protocol-intake-publish-prep/types'
import { PreflightPanel } from '@/components/source-builder/publish-prep/preflight-panel'

const STATUS_LABEL: Partial<Record<PublishPrepStatus, string>> = {
  not_ready: 'Not ready',
  ready_for_candidate: 'Ready for candidate',
  candidate_created: 'Candidate created',
  candidate_pending_review: 'Pending final review',
  candidate_approved: 'Candidate approved',
  candidate_blocked: 'Candidate blocked',
  blocked: 'Blocked',
}

export function PublishPrepWorkspace(props: {
  draftKey: string
  packageLabel: string
  status: PublishPrepStatus
  preflight: PreflightResult | null
  candidate: PublishCandidate | null
}) {
  const { draftKey, packageLabel, status, preflight, candidate } = props
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  const canCreate =
    status === 'ready_for_candidate' && preflight?.passed === true && !pending

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <Link
          href={`/source-builder/intake/review/${draftKey}`}
          className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}
        >
          ← Intake review
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">
          Publish preparation: {packageLabel}
        </h1>
        <p className="max-w-3xl text-sm text-muted-foreground">
          Controlled publish pipeline (12E). Creates a draft publish candidate only — does not
          publish, bind, or mutate runtime.
        </p>
        <div className="flex flex-wrap gap-2 text-xs">
          <span className="rounded border border-red-500/30 bg-red-500/10 px-2 py-1 font-medium text-red-900 dark:text-red-200">
            Not published · Not bound · No runtime mutation
          </span>
        </div>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Preflight</CardTitle>
          <CardDescription>
            All checks must pass before creating a publish candidate artifact.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <PreflightPanel preflight={preflight} statusLabel={STATUS_LABEL[status] ?? status} />
        </CardContent>
      </Card>

      <Card className="border-dashed">
        <CardHeader>
          <CardTitle className="text-lg">Publish candidate</CardTitle>
          <CardDescription>
            Writes data/source-publish-candidates/{draftKey}/publish_candidate.json
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {candidate ? (
            <p className="text-sm text-emerald-700 dark:text-emerald-400">
              Candidate on file · created {candidate.created_at}
              {candidate.created_by ? ` · by ${candidate.created_by}` : ''}
            </p>
          ) : null}
          <Button
            disabled={!canCreate}
            onClick={() =>
              startTransition(async () => {
                await createPublishCandidateAction(draftKey)
                router.refresh()
              })
            }
          >
            Create publish candidate
          </Button>
          {!canCreate && !candidate ? (
            <p className="text-xs text-muted-foreground">
              {status === 'not_ready'
                ? 'Generate an approved draft in intake review first.'
                : 'Resolve all preflight blockers before creating a candidate.'}
            </p>
          ) : null}
          <p className="text-xs text-muted-foreground">
            Safety: publish={String(PUBLISH_PREP_SAFETY.auto_publish)}, bind=
            {String(PUBLISH_PREP_SAFETY.auto_bind)}, runtime=
            {String(PUBLISH_PREP_SAFETY.runtime_mutation)}
          </p>
        </CardContent>
      </Card>

      {candidate ? (
        <Card>
          <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
            <CardTitle className="text-lg">Next: final candidate review</CardTitle>
            <Link
              href={`/source-builder/intake/publish-prep/${draftKey}/review`}
              className={cn(buttonVariants())}
            >
              Open candidate review →
            </Link>
          </CardHeader>
          <CardContent className="grid gap-2 text-sm text-muted-foreground md:grid-cols-2">
            <p>Visits: {candidate.visits.length}</p>
            <p>Procedures: {candidate.procedures.length}</p>
            <p>Composition rows: {candidate.source_composition.length}</p>
            <p>Rejected retained: {candidate.rejected_items.length}</p>
            <p>publish_ready: {String(candidate.publish_ready)}</p>
            <p>runtime_activation: {String(candidate.runtime_activation)}</p>
          </CardContent>
        </Card>
      ) : null}
    </div>
  )
}
