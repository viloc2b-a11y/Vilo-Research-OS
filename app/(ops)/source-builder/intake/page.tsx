import Link from 'next/link'
import { buttonVariants } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { DocumentIntakeUploadForm } from '@/components/protocol-intake/document-intake-upload'
import {
  getOrganizationMemberships,
  getPrimaryOrganizationId,
  getSessionUser,
} from '@/lib/auth/session'
import {
  canManageSourceDocuments,
  canPrepareSourceDrafts,
} from '@/lib/rbac/permissions'

export default async function ProtocolIntakeReviewListPage() {
  const user = await getSessionUser()
  const organizationId = user ? await getPrimaryOrganizationId(user.id) : null
  const memberships = user ? await getOrganizationMemberships(user.id) : []
  const canAccess =
    canPrepareSourceDrafts(memberships, organizationId ?? undefined)
    || canManageSourceDocuments(memberships, organizationId ?? undefined)

  if (!canAccess) {
    return (
      <div className="space-y-4 p-6">
        <h1 className="text-2xl font-semibold tracking-tight">Protocol intake review</h1>
        <p className="text-sm text-muted-foreground">Access denied.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6 p-6">
      <header className="space-y-2">
        <Link href="/source-builder" className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}>
          ← Source builder
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">Review protocol intake drafts</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Open evidence-backed intake packages for human review. Approve sections and generate an
          approved handoff artifact — never auto-published to runtime.
        </p>
      </header>

      <Card>
        <CardContent className="py-8 text-sm text-muted-foreground">
          Intake fixture packages are not loaded during production builds.
        </CardContent>
      </Card>

      <div className="mt-8">
        <h2 className="text-xl font-semibold tracking-tight mb-4">Phase 1: Schedule of Events Extraction</h2>
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Upload Protocol or SoA Document</CardTitle>
            <CardDescription>
              Upload a PDF or Excel Schedule of Events to extract the Visit × Procedure matrix for review.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <DocumentIntakeUploadForm />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
