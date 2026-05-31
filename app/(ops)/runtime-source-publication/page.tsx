import { redirect } from 'next/navigation'
import {
  getOrganizationMemberships,
  getPrimaryOrganizationId,
  getSessionUser,
} from '@/lib/auth/session'
import { canManageSourceBuilder } from '@/lib/rbac/permissions'
import { createServerClient } from '@/lib/supabase/server'
import { RuntimeSourcePublicationClient } from '@/components/runtime-source-publication/runtime-source-publication-client'

function firstParam(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) return value[0] ?? null
  return value ?? null
}

type RuntimeSourcePublicationPageProps = {
  searchParams?: Promise<{ study_id?: string | string[] }>
}

export default async function RuntimeSourcePublicationPage({
  searchParams,
}: RuntimeSourcePublicationPageProps) {
  const params = (await searchParams) ?? {}
  const initialStudyId = firstParam(params.study_id)

  const user = await getSessionUser()
  if (!user) redirect('/login')

  const organizationId = await getPrimaryOrganizationId(user.id)
  if (!organizationId) {
    return (
      <div className="space-y-4 p-6">
        <h1 className="text-2xl font-semibold tracking-tight">Runtime source publication</h1>
        <p className="text-sm text-muted-foreground">No organization access is available.</p>
      </div>
    )
  }

  const memberships = await getOrganizationMemberships(user.id)
  if (!canManageSourceBuilder(memberships, organizationId)) {
    return (
      <div className="space-y-4 p-6">
        <h1 className="text-2xl font-semibold tracking-tight">Runtime source publication</h1>
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

  return (
    <div className="space-y-6 p-6">
      <header className="max-w-3xl">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Runtime source publication</h1>
        <p className="mt-1 text-sm text-slate-500">
          Publish an approved source package as a published source version and generate signature placeholders.
          This prepares the package for execution workflows.
        </p>
      </header>
      <RuntimeSourcePublicationClient
        organizationId={organizationId}
        studies={studyList}
        initialStudyId={initialStudyId}
      />
    </div>
  )
}

