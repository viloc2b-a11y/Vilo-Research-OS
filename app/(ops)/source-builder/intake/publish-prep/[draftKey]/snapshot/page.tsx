import { redirect } from 'next/navigation'
import { SnapshotWorkspace } from '@/components/source-builder/publish-prep/snapshot-workspace'
import { loadPublishCandidateApproval } from '@/lib/protocol-intake-publish-prep/approval'
import { runSnapshotReadiness } from '@/lib/protocol-intake-publish-prep/snapshot-readiness'
import { resolvePublishPrepStatus } from '@/lib/protocol-intake-publish-prep/status'
import { loadPublishCandidate } from '@/lib/protocol-intake-publish-prep/write-artifacts'
import { loadSourcePackageSnapshot } from '@/lib/protocol-intake-publish-prep/write-snapshot'
import {
  getOrganizationMemberships,
  getPrimaryOrganizationId,
  getSessionUser,
} from '@/lib/auth/session'
import {
  canManageSourceDocuments,
  canPrepareSourceDrafts,
} from '@/lib/rbac/permissions'

type PageProps = { params: Promise<{ draftKey: string }> }

export default async function SourcePackageSnapshotPage({ params }: PageProps) {
  const { draftKey } = await params
  const user = await getSessionUser()
  const organizationId = user ? await getPrimaryOrganizationId(user.id) : null
  const memberships = user ? await getOrganizationMemberships(user.id) : []
  const canAccess =
    canPrepareSourceDrafts(memberships, organizationId ?? undefined)
    || canManageSourceDocuments(memberships, organizationId ?? undefined)

  if (!canAccess) {
    return (
      <div className="p-6 text-sm text-muted-foreground">Access denied.</div>
    )
  }

  const candidate = loadPublishCandidate(draftKey)
  if (!candidate) {
    redirect(`/source-builder/intake/publish-prep/${draftKey}`)
  }

  const approval = loadPublishCandidateApproval(draftKey)
  if (!approval) {
    redirect(`/source-builder/intake/publish-prep/${draftKey}/review`)
  }

  const prep = resolvePublishPrepStatus(draftKey)
  const snapshotReadiness = runSnapshotReadiness(draftKey, candidate, approval)
  const snapshot = loadSourcePackageSnapshot(draftKey)

  return (
    <div className="p-6">
      <SnapshotWorkspace
        draftKey={draftKey}
        packageLabel={draftKey}
        status={prep.status}
        candidate={candidate}
        approval={approval}
        snapshotReadiness={snapshotReadiness}
        snapshot={snapshot}
      />
    </div>
  )
}
