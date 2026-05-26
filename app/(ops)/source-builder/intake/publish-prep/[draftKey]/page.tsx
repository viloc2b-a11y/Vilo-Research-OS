import { PublishPrepWorkspace } from '@/components/source-builder/publish-prep/publish-prep-workspace'
import { loadPublishCandidate } from '@/lib/protocol-intake-publish-prep/write-artifacts'
import { resolvePublishPrepStatus } from '@/lib/protocol-intake-publish-prep/status'
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

export default async function PublishPrepPage({ params }: PageProps) {
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

  const prep = resolvePublishPrepStatus(draftKey)
  const candidate = loadPublishCandidate(draftKey)

  return (
    <div className="p-6">
      <PublishPrepWorkspace
        draftKey={draftKey}
        packageLabel={draftKey}
        status={prep.status}
        preflight={prep.preflight}
        candidate={candidate}
      />
    </div>
  )
}
