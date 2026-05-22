import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { notFound } from 'next/navigation'
import { IntakeReviewWorkspace } from '@/components/source-builder/intake-review/intake-review-workspace'
import { loadIntakePackage } from '@/lib/protocol-intake-review/load-package'
import { workspaceDir } from '@/lib/protocol-intake-review/paths'
import { loadWorkspace } from '@/lib/protocol-intake-review/workspace'
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

export default async function IntakeReviewWorkspacePage({ params }: PageProps) {
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

  const pkg = loadIntakePackage(draftKey)
  if (!pkg) notFound()

  const workspace = loadWorkspace(pkg)
  const hasApproved = existsSync(
    join(workspaceDir(process.cwd(), draftKey), 'approved_intake_draft.json'),
  )

  return (
    <div className="p-6">
      <IntakeReviewWorkspace
        pkg={pkg}
        workspace={workspace}
        hasApprovedArtifact={hasApproved}
      />
    </div>
  )
}
