import { redirect } from 'next/navigation'
import {
  getOrganizationMemberships,
  getPrimaryOrganizationId,
  getSessionUser,
} from '@/lib/auth/session'
import { canManageSourceBuilder } from '@/lib/rbac/permissions'
import { createServerClient } from '@/lib/supabase/server'
import { listCompositionSnapshots } from '@/lib/runtime-source-package/load-composition-snapshot'
import { RuntimeSourcePackageClient } from '@/components/runtime-source-package/runtime-source-package-client'

function firstParam(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) return value[0] ?? null
  return value ?? null
}

type RuntimeSourcePackagesPageProps = {
  searchParams?: Promise<{ study_id?: string | string[] }>
}

export default async function RuntimeSourcePackagesPage({
  searchParams,
}: RuntimeSourcePackagesPageProps) {
  const params = (await searchParams) ?? {}
  const initialStudyId = firstParam(params.study_id)

  const user = await getSessionUser()
  if (!user) redirect('/login')

  const organizationId = await getPrimaryOrganizationId(user.id)
  if (!organizationId) {
    return (
      <div className="space-y-4 p-6">
        <h1 className="text-2xl font-semibold tracking-tight">Runtime source packages</h1>
        <p className="text-sm text-muted-foreground">No organization access is available.</p>
      </div>
    )
  }

  const memberships = await getOrganizationMemberships(user.id)
  if (!canManageSourceBuilder(memberships, organizationId)) {
    return (
      <div className="space-y-4 p-6">
        <h1 className="text-2xl font-semibold tracking-tight">Runtime source packages</h1>
        <p className="text-sm text-muted-foreground">Access denied.</p>
      </div>
    )
  }

  const supabase = await createServerClient()
  const { data: studies } = await supabase
    .from('studies')
    .select('id, name')
    .eq('organization_id', organizationId)
    .order('name', { ascending: true })

  const studyList = (studies ?? []).map((study) => ({ id: String(study.id), name: String(study.name) }))
  const snapshotsByStudy: Record<string, { id: string; graphHash: string; createdAt: string }[]> = {}

  for (const study of studyList) {
    snapshotsByStudy[study.id] = await listCompositionSnapshots(supabase, organizationId, study.id)
  }

  return (
    <div className="space-y-6 p-6">
      <header className="max-w-3xl">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Runtime source packages</h1>
        <p className="mt-1 text-sm text-slate-500">
          Generate draft source packages from compiled study runtime graphs. Review visit and procedure
          shells before executable workspaces exist.
        </p>
      </header>
      <RuntimeSourcePackageClient
        organizationId={organizationId}
        studies={studyList}
        snapshotsByStudy={snapshotsByStudy}
        initialStudyId={initialStudyId}
      />
    </div>
  )
}
