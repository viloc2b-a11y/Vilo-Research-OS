import Link from 'next/link'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { SourceBuilderDraftList } from '@/components/source-builder/source-builder-draft-list'
import {
  getOrganizationMemberships,
  getPrimaryOrganizationId,
  getSessionUser,
} from '@/lib/auth/session'

export default async function SourceBuilderPage() {
  const user = await getSessionUser()
  const organizationId = user ? await getPrimaryOrganizationId(user.id) : null
  const memberships = user ? await getOrganizationMemberships(user.id) : []

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Source document builder</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Coordinator-first workspace to build study source packages before publish. Manual builder
          first; PDF Schedule of Events import will use this same workspace later.
        </p>
        {organizationId ? (
          <p className="text-xs text-muted-foreground">
            Organization: {memberships.find((m) => m.organization_id === organizationId)?.organizations?.name ?? organizationId}
          </p>
        ) : null}
      </header>

      <Card className="border-dashed">
        <CardHeader>
          <CardTitle className="text-lg">Manual builder</CardTitle>
          <CardDescription>
            Create visits, attach reusable procedures, customize fields and the visit × procedure
            matrix. Nothing publishes to capture runtime until Phase 6A.6.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Link href="/source-builder/manual" className={cn(buttonVariants())}>
            Start new manual draft
          </Link>
        </CardContent>
      </Card>

      <SourceBuilderDraftList organizationId={organizationId} />
    </div>
  )
}
