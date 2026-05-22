import Link from 'next/link'
import { CompositionPreviewPanel } from '@/components/source-builder/composition-preview-panel'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  getOrganizationMemberships,
  getPrimaryOrganizationId,
  getSessionUser,
} from '@/lib/auth/session'
import {
  canManageSourceDocuments,
  canPrepareSourceDrafts,
} from '@/lib/rbac/permissions'

export default async function SourceBuilderCompositionPage() {
  const user = await getSessionUser()
  const organizationId = user ? await getPrimaryOrganizationId(user.id) : null
  const memberships = user ? await getOrganizationMemberships(user.id) : []
  const canAccess =
    canPrepareSourceDrafts(memberships, organizationId ?? undefined)
    || canManageSourceDocuments(memberships, organizationId ?? undefined)

  if (!canAccess) {
    return (
      <div className="space-y-4 p-6">
        <h1 className="text-2xl font-semibold tracking-tight">Source composition</h1>
        <p className="text-sm text-muted-foreground">You do not have access to source composition preview.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6 p-6">
      <header className="space-y-2">
        <div className="flex flex-wrap items-center gap-3">
          <Link href="/source-builder" className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}>
            ← Source builder
          </Link>
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">Canonical source composition</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Phase 12B manifests compose canonical libraries into deterministic field lists. Published
          SDVs freeze the resolved snapshot in provenance — later library edits do not change published
          documents.
        </p>
      </header>
      <CompositionPreviewPanel />
    </div>
  )
}
