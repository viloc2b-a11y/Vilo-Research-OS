import { redirect } from 'next/navigation'
import { CandidateReviewWorkspace } from '@/components/source-builder/publish-prep/candidate-review-workspace'
import { loadPublishCandidateApproval } from '@/lib/protocol-intake-publish-prep/approval'
import { runFinalReviewChecks } from '@/lib/protocol-intake-publish-prep/final-review'
import { resolvePublishPrepStatus } from '@/lib/protocol-intake-publish-prep/status'
import { loadPublishCandidate } from '@/lib/protocol-intake-publish-prep/write-artifacts'
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

export default async function CandidateReviewPage({ params }: PageProps) {
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

  const prep = resolvePublishPrepStatus(draftKey)
  const finalReview = runFinalReviewChecks(candidate)
  const approval = loadPublishCandidateApproval(draftKey)

  return (
    <div className="p-6">
      <CandidateReviewWorkspace
        draftKey={draftKey}
        packageLabel={draftKey}
        status={prep.status}
        candidate={candidate}
        finalReview={finalReview}
        approval={approval}
      />
    </div>
  )
}
