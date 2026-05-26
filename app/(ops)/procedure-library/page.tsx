import { redirect } from 'next/navigation'
import {
  getOrganizationMemberships,
  getPrimaryOrganizationId,
  getSessionUser,
} from '@/lib/auth/session'
import { canManageSourceBuilder } from '@/lib/rbac/permissions'
import { createServerClient } from '@/lib/supabase/server'
import { ProcedureLibraryClient } from '@/components/procedure-library/procedure-library-client'

export default async function ProcedureLibraryPage() {
  const user = await getSessionUser()
  if (!user) redirect('/login')

  const organizationId = await getPrimaryOrganizationId(user.id)
  if (!organizationId) {
    return (
      <div className="space-y-4 p-6">
        <h1 className="text-2xl font-semibold tracking-tight">Procedure library</h1>
        <p className="text-sm text-muted-foreground">No organization access is available.</p>
      </div>
    )
  }

  const memberships = await getOrganizationMemberships(user.id)
  if (!canManageSourceBuilder(memberships, organizationId)) {
    return (
      <div className="space-y-4 p-6">
        <h1 className="text-2xl font-semibold tracking-tight">Procedure library</h1>
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

  return (
    <ProcedureLibraryClient
      organizationId={organizationId}
      studies={(studies ?? []).map((study) => ({ id: String(study.id), name: String(study.name) }))}
    />
  )
}
