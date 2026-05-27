import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import {
  getOrganizationMemberships,
  getPrimaryOrganizationId,
  getSessionUser,
} from '@/lib/auth/session'
import { canAccessCoordinatorWorkspace } from '@/lib/rbac/permissions'
import { loadCoordinatorCommandCenter } from '@/lib/coordinator-command-center'
import { CoordinatorCommandCenterView } from '@/components/coordinator-command-center/coordinator-command-center-view'

type CoordinatorCommandCenterPageProps = {
  searchParams: Promise<{ study_id?: string }>
}

function LoadingFallback() {
  return (
    <div className="space-y-5 p-6">
      <div className="h-8 w-80 animate-pulse rounded bg-slate-100" />
      <div className="grid gap-3 md:grid-cols-3">
        <div className="h-24 animate-pulse rounded-md bg-slate-100" />
        <div className="h-24 animate-pulse rounded-md bg-slate-100" />
        <div className="h-24 animate-pulse rounded-md bg-slate-100" />
      </div>
      <div className="h-72 animate-pulse rounded-md bg-slate-100" />
    </div>
  )
}

async function CoordinatorCommandCenterContent({
  initialStudyId,
}: {
  initialStudyId: string | null
}) {
  const user = await getSessionUser()
  if (!user) redirect('/login')

  const organizationId = await getPrimaryOrganizationId(user.id)
  if (!organizationId) {
    return (
      <div className="space-y-4 p-6">
        <h1 className="text-2xl font-semibold tracking-tight">Coordinator Command Center</h1>
        <p className="text-sm text-muted-foreground">No organization access is available.</p>
      </div>
    )
  }

  const memberships = await getOrganizationMemberships(user.id)
  if (!canAccessCoordinatorWorkspace(memberships, organizationId)) {
    return (
      <div className="space-y-4 p-6">
        <h1 className="text-2xl font-semibold tracking-tight">Coordinator Command Center</h1>
        <p className="text-sm text-muted-foreground">Access denied.</p>
      </div>
    )
  }

  const model = await loadCoordinatorCommandCenter({
    organizationId,
    selectedStudyId: initialStudyId,
  })

  return <CoordinatorCommandCenterView model={model} />
}

export default async function CoordinatorCommandCenterPage({
  searchParams,
}: CoordinatorCommandCenterPageProps) {
  const params = await searchParams
  const initialStudyId = params.study_id?.trim() || null

  return (
    <Suspense fallback={<LoadingFallback />}>
      <CoordinatorCommandCenterContent initialStudyId={initialStudyId} />
    </Suspense>
  )
}
