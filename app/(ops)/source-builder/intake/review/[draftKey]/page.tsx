import { notFound } from 'next/navigation'
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

  void draftKey
  notFound()
}
