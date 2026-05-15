import { redirect } from 'next/navigation'
import { OpsShell } from '@/components/shell/ops-shell'
import {
  getOrganizationMemberships,
  getSessionUser,
} from '@/lib/auth/session'

export default async function OpsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await getSessionUser()

  if (!user) {
    redirect('/login')
  }

  const memberships = await getOrganizationMemberships(user.id)
  const primaryOrg = memberships[0]?.organizations

  return (
    <OpsShell
      userEmail={user.email}
      organizationName={primaryOrg?.name ?? null}
    >
      {children}
    </OpsShell>
  )
}
