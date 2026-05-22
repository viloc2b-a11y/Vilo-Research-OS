import Link from 'next/link'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { buttonVariants } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { discoverIntakePackages } from '@/lib/protocol-intake-review/load-package'
import { workspaceDir } from '@/lib/protocol-intake-review/paths'
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

  const packages = discoverIntakePackages()

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

      {packages.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-sm text-muted-foreground">
            No intake packages found. Run{' '}
            <code className="text-xs">python scripts/phase_12c_protocol_intake.py</code> or seed{' '}
            <code className="text-xs">fixtures/intake-review/</code>.
          </CardContent>
        </Card>
      ) : (
        packages.map((pkg) => {
          const wsApproved = existsSync(
            join(workspaceDir(process.cwd(), pkg.draft_key), 'approved_intake_draft.json'),
          )
          return (
            <Card key={pkg.draft_key}>
              <CardHeader>
                <CardTitle className="text-lg">{pkg.label}</CardTitle>
                <CardDescription>
                  {pkg.artifact_files.length} artifacts · {pkg.study_key}
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-wrap items-center justify-between gap-4">
                <ul className="text-xs text-muted-foreground">
                  {pkg.artifact_files.map((f) => (
                    <li key={f}>{f}</li>
                  ))}
                </ul>
                <Link
                  href={`/source-builder/intake/review/${pkg.draft_key}`}
                  className={cn(buttonVariants())}
                >
                  Open review workspace
                </Link>
                {pkg.has_approved || wsApproved ? (
                  <span className="text-xs text-emerald-700 dark:text-emerald-400">
                    Approved artifact available
                  </span>
                ) : null}
              </CardContent>
            </Card>
          )
        })
      )}
    </div>
  )
}
