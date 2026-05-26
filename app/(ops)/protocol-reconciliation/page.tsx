import { redirect } from 'next/navigation'
import { getOrganizationMemberships, getPrimaryOrganizationId, getSessionUser } from '@/lib/auth/session'
import { canManageSourceBuilder } from '@/lib/rbac/permissions'
import { ProtocolReconciliationClient } from '@/components/protocol-reconciliation/protocol-reconciliation-client'

export default async function ProtocolReconciliationPage() {
  const user = await getSessionUser()
  if (!user) redirect('/login')

  const organizationId = await getPrimaryOrganizationId(user.id)
  if (!organizationId) {
    return (
      <div className="space-y-4 p-6">
        <h1 className="text-2xl font-semibold tracking-tight">Protocol reconciliation</h1>
        <p className="text-sm text-muted-foreground">No organization access is available.</p>
      </div>
    )
  }

  const memberships = await getOrganizationMemberships(user.id)
  if (!canManageSourceBuilder(memberships, organizationId)) {
    return (
      <div className="space-y-4 p-6">
        <h1 className="text-2xl font-semibold tracking-tight">Protocol reconciliation</h1>
        <p className="text-sm text-muted-foreground">Access denied.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6 p-6">
      <header className="max-w-3xl">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Protocol reconciliation</h1>
        <p className="mt-1 text-sm text-slate-500">
          Match extracted procedure candidates to reusable blueprint library entries, reconcile visits and
          procedures with human approval, and produce a runtime-ready mapping layer without modifying source
          candidates.
        </p>
      </header>
      <ProtocolReconciliationClient organizationId={organizationId} />
    </div>
  )
}
