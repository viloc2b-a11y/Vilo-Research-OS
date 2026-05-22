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
import { createSourcePackageSnapshotAction } from '@/lib/protocol-intake-publish-prep/actions'
import { SnapshotReadinessPanel } from '@/components/source-builder/publish-prep/snapshot-readiness-panel'
import type {
  PublishCandidate,
  PublishCandidateApproval,
  PublishPrepStatus,
  SnapshotReadinessResult,
  SourcePackageSnapshot,
} from '@/lib/protocol-intake-publish-prep/types'

const STATUS_LABEL: Partial<Record<PublishPrepStatus, string>> = {
  snapshot_ready: 'Ready for snapshot',
  snapshot_created: 'Snapshot created',
  snapshot_blocked: 'Snapshot blocked',
  candidate_approved: 'Candidate approved',
}

export function SnapshotWorkspace(props: {
  draftKey: string
  packageLabel: string
  status: PublishPrepStatus
  candidate: PublishCandidate
  approval: PublishCandidateApproval
  snapshotReadiness: SnapshotReadinessResult | null
  snapshot: SourcePackageSnapshot | null
}) {
  const { draftKey, packageLabel, status, candidate, approval, snapshotReadiness, snapshot } =
    props
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  const canCreate =
    status === 'snapshot_ready'
    && snapshotReadiness?.passed === true
    && !snapshot
    && !pending

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <Link
          href={`/source-builder/intake/publish-prep/${draftKey}/review`}
          className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}
        >
          ← Candidate review
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">
          Source package snapshot: {packageLabel}
        </h1>
        <p className="max-w-3xl text-sm text-muted-foreground">
          Controlled publish snapshot (12E-C). Writes an immutable filesystem artifact only.
        </p>
        <span className="inline-block rounded border border-red-500/30 bg-red-500/10 px-2 py-1 text-xs font-medium text-red-900 dark:text-red-200">
          This does not activate runtime.
        </span>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Candidate approved</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1 text-sm text-muted-foreground">
          <p>Approved {approval.approved_at}</p>
          <p>Reason: {approval.approval_reason}</p>
          <p>
            Visits {candidate.visits.length} · Procedures {candidate.procedures.length} ·
            Composition {candidate.source_composition.length}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Snapshot readiness</CardTitle>
          <CardDescription>
            All checks must pass before creating the immutable snapshot.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <SnapshotReadinessPanel
            readiness={snapshotReadiness}
            statusLabel={STATUS_LABEL[status] ?? status}
          />
        </CardContent>
      </Card>

      <Card className="border-dashed">
        <CardHeader>
          <CardTitle className="text-lg">Create snapshot</CardTitle>
          <CardDescription>
            Writes data/source-publish-snapshots/{draftKey}/source_package_snapshot.json
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {snapshot ? (
            <div className="text-sm text-emerald-700 dark:text-emerald-400">
              <p>Snapshot on file: {snapshot.snapshot_id}</p>
              <p>Checksum: {snapshot.content_checksum.slice(0, 16)}…</p>
              <p>immutable={String(snapshot.immutable)} · runtime_activation=
                {String(snapshot.runtime_activation)}
              </p>
            </div>
          ) : (
            <>
              <Button disabled={!canCreate} onClick={() =>
                startTransition(async () => {
                  await createSourcePackageSnapshotAction(draftKey)
                  router.refresh()
                })
              }>
                Create snapshot
              </Button>
              {!canCreate ? (
                <p className="text-xs text-muted-foreground">
                  Resolve snapshot blockers or complete candidate approval first.
                </p>
              ) : null}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
